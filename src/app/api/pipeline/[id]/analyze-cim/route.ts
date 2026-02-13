import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { extractPdfText } from "@/lib/import/pdf-parser";
import { parseCIMWithAI } from "@/lib/ai/cim-parser";
import { isAIEnabled } from "@/lib/ai/claude-client";

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

const analyzeCIMSchema = z.object({
  documentId: z.string().min(1, "documentId is required"),
});

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

    // Check for cached result
    const cached = await prisma.aIAnalysisResult.findFirst({
      where: {
        opportunityId,
        documentId: data.documentId,
        analysisType: "CIM_EXTRACTION",
      },
      orderBy: { createdAt: "desc" },
    });

    if (cached) {
      return NextResponse.json({
        analysisId: cached.id,
        result: cached.resultData,
        modelUsed: cached.modelUsed,
        inputTokens: cached.inputTokens,
        outputTokens: cached.outputTokens,
        cached: true,
      });
    }

    // Extract text from PDF
    const pdfBuffer = Buffer.from(document.fileData);
    const pdfText = await extractPdfText(pdfBuffer);

    if (!pdfText || pdfText.trim().length < 100) {
      return NextResponse.json(
        { error: "Could not extract sufficient text from PDF. The document may be scanned/image-based." },
        { status: 400 },
      );
    }

    // Send to Claude for analysis
    const { result, inputTokens, outputTokens, modelUsed } =
      await parseCIMWithAI(pdfText);

    // Cache the result
    const analysis = await prisma.aIAnalysisResult.create({
      data: {
        opportunityId,
        documentId: data.documentId,
        analysisType: "CIM_EXTRACTION",
        resultData: result as object,
        modelUsed,
        inputTokens,
        outputTokens,
      },
    });

    return NextResponse.json({
      analysisId: analysis.id,
      result,
      modelUsed,
      inputTokens,
      outputTokens,
      cached: false,
    });
  } catch (err) {
    console.error("[analyze-cim] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to analyze CIM";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
