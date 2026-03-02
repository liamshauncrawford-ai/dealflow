import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { extractPdfText } from "@/lib/import/pdf-parser";
import { parseCIMWithAI } from "@/lib/ai/cim-parser";
import { isAIEnabled } from "@/lib/ai/claude-client";
import { getOpportunityNotesContext } from "@/lib/ai/note-context";
import { generateAnalysis, getLatestAnalysis, editAnalysis, deleteAnalysis } from "@/lib/ai/analysis-manager";

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

const analyzeCIMSchema = z.object({
  documentId: z.string().min(1, "documentId is required"),
});

// ─────────────────────────────────────────────
// GET /api/pipeline/[id]/analyze-cim?documentId=xxx
//
// Returns the latest cached CIM analysis for an opportunity + document.
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: opportunityId } = await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    const latest = await getLatestAnalysis({
      opportunityId,
      ...(documentId ? { documentId } : {}),
      analysisType: "CIM_EXTRACTION",
    });

    if (!latest) {
      return NextResponse.json({ result: null });
    }

    return NextResponse.json({
      analysisId: latest.id,
      result: latest.resultData,
      modelUsed: latest.modelUsed,
      inputTokens: latest.inputTokens,
      outputTokens: latest.outputTokens,
      createdAt: latest.createdAt,
    });
  } catch (err) {
    console.error("[analyze-cim] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch CIM analysis" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// POST /api/pipeline/[id]/analyze-cim
//
// Extracts text from a PDF document, sends it to Claude Sonnet 4.5,
// and returns structured CIM extraction results. Caches the result
// in AIAnalysisResult for future reference.
//
// Does NOT auto-save to opportunity — use /apply-cim for that.
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check AI is configured
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: "AI features are not configured (missing ANTHROPIC_API_KEY)" },
        { status: 503 },
      );
    }

    const { id: opportunityId } = await params;

    // Validate body
    const { data, error } = await parseBody(analyzeCIMSchema, request);
    if (error) return error;

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, title: true },
    });
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Fetch document with file data
    const document = await prisma.dealDocument.findFirst({
      where: {
        id: data.documentId,
        opportunityId,
      },
      select: {
        id: true,
        fileName: true,
        fileData: true,
        mimeType: true,
        category: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!document.fileData) {
      return NextResponse.json(
        { error: "Document has no file data (imported reference only)" },
        { status: 400 },
      );
    }

    if (document.mimeType !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF documents can be analyzed" },
        { status: 400 },
      );
    }

    const { result: analysis, cached } = await generateAnalysis({
      opportunityId,
      documentId: data.documentId,
      analysisType: "CIM_EXTRACTION",
      cacheHours: 24,
      generateFn: async () => {
        // Extract text from PDF
        const pdfBuffer = Buffer.from(document.fileData!);
        const pdfText = await extractPdfText(pdfBuffer);

        if (!pdfText || pdfText.trim().length < 100) {
          throw new Error("Could not extract sufficient text from PDF. The document may be scanned/image-based.");
        }

        // Fetch notes context for additional analysis context
        const notesContext = await getOpportunityNotesContext(opportunityId);
        const fullText = pdfText + (notesContext ? `\n\n---\n\nADDITIONAL CONTEXT FROM RESEARCH NOTES:\n${notesContext}` : "");

        // Send to Claude for analysis
        const { result, inputTokens, outputTokens, modelUsed } =
          await parseCIMWithAI(fullText);

        return { resultData: result, inputTokens, outputTokens, modelUsed };
      },
    });

    return NextResponse.json({
      analysisId: analysis.id,
      result: analysis.resultData,
      modelUsed: analysis.modelUsed,
      inputTokens: analysis.inputTokens,
      outputTokens: analysis.outputTokens,
      cached,
    });
  } catch (err) {
    console.error("[analyze-cim] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to analyze CIM";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/pipeline/[id]/analyze-cim
//
// Updates an existing CIM analysis's resultData.
// ─────────────────────────────────────────────

const patchSchema = z.object({
  analysisId: z.string(),
  resultData: z.record(z.string(), z.unknown()),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: opportunityId } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { analysisId, resultData } = parsed.data;

    // Verify the analysis belongs to this opportunity
    const existing = await prisma.aIAnalysisResult.findFirst({
      where: {
        id: analysisId,
        opportunityId,
        analysisType: "CIM_EXTRACTION",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "CIM analysis not found" },
        { status: 404 },
      );
    }

    const updated = await editAnalysis(analysisId, resultData);

    return NextResponse.json({
      analysisId: updated.id,
      result: updated.resultData,
    });
  } catch (err) {
    console.error("[analyze-cim] PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update CIM analysis" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// DELETE /api/pipeline/[id]/analyze-cim
//
// Deletes a specific CIM analysis by analysisId.
// ─────────────────────────────────────────────

const deleteBodySchema = z.object({
  analysisId: z.string(),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: opportunityId } = await params;
    const body = await request.json();
    const parsed = deleteBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { analysisId } = parsed.data;

    // Verify the analysis belongs to this opportunity
    const existing = await prisma.aIAnalysisResult.findFirst({
      where: {
        id: analysisId,
        opportunityId,
        analysisType: "CIM_EXTRACTION",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "CIM analysis not found" },
        { status: 404 },
      );
    }

    await deleteAnalysis(analysisId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[analyze-cim] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete CIM analysis" },
      { status: 500 },
    );
  }
}
