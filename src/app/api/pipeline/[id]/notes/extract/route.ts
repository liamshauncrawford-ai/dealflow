import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAIEnabled } from "@/lib/ai/claude-client";
import { extractMeetingNotes } from "@/lib/ai/meeting-notes-extractor";
import { getOpportunityNotesContext } from "@/lib/ai/note-context";
import { generateAnalysis, getLatestAnalysis, editAnalysis, deleteAnalysis } from "@/lib/ai/analysis-manager";
import { z } from "zod";

// ─────────────────────────────────────────────
// GET /api/pipeline/[id]/notes/extract
//
// Returns the latest cached meeting notes extraction for an opportunity.
// ─────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: opportunityId } = await params;

    const latest = await getLatestAnalysis({
      opportunityId,
      analysisType: "MEETING_NOTES_EXTRACTION",
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
    console.error("[meeting-notes-extract] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch meeting notes extraction" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// POST /api/pipeline/[id]/notes/extract
//
// Ingests raw meeting notes, saves them, runs AI extraction,
// and saves the structured analysis as a second note.
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: "AI features are not configured (missing ANTHROPIC_API_KEY)" },
        { status: 503 },
      );
    }

    const { id: opportunityId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const { content, title } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "content is required and must be a string" },
        { status: 400 },
      );
    }

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, title: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 },
      );
    }

    // Save raw meeting notes (always created, not part of the cache layer)
    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const rawNote = await prisma.note.create({
      data: {
        content,
        title: title || `Meeting Notes — ${dateStr}`,
        noteType: "MEETING_NOTES",
        opportunityId,
      },
    });

    // Use generateAnalysis for the AI extraction + caching
    const { result: analysis } = await generateAnalysis({
      opportunityId,
      analysisType: "MEETING_NOTES_EXTRACTION",
      cacheHours: 0, // Always regenerate for new meeting notes
      generateFn: async () => {
        // Gather existing notes context for richer extraction
        const existingContext = await getOpportunityNotesContext(opportunityId);

        // Run AI extraction
        const { extractedContent, inputTokens, outputTokens } =
          await extractMeetingNotes(
            content,
            opportunity.title,
            existingContext || undefined,
          );

        // Save extracted insights as a second note
        const extractedNote = await prisma.note.create({
          data: {
            content: extractedContent,
            title: `AI Analysis — Meeting Notes (${dateStr})`,
            noteType: "AI_ANALYSIS",
            opportunityId,
          },
        });

        return {
          resultData: {
            rawNoteId: rawNote.id,
            extractedNoteId: extractedNote.id,
          },
          inputTokens,
          outputTokens,
          modelUsed: "claude-sonnet-4-5",
        };
      },
    });

    // Fetch the extractedNote from the resultData so we can return it
    const resultData = analysis.resultData as { rawNoteId: string; extractedNoteId: string };
    const extractedNote = await prisma.note.findUnique({
      where: { id: resultData.extractedNoteId },
    });

    return NextResponse.json({
      analysisId: analysis.id,
      rawNote,
      extractedNote,
      tokens: { input: analysis.inputTokens, output: analysis.outputTokens },
    });
  } catch (err) {
    console.error("[meeting-notes-extract] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to extract meeting notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/pipeline/[id]/notes/extract
//
// Updates an existing meeting notes extraction's resultData.
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
        analysisType: "MEETING_NOTES_EXTRACTION",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Meeting notes extraction not found" },
        { status: 404 },
      );
    }

    const updated = await editAnalysis(analysisId, resultData);

    return NextResponse.json({
      analysisId: updated.id,
      result: updated.resultData,
    });
  } catch (err) {
    console.error("[meeting-notes-extract] PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update meeting notes extraction" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// DELETE /api/pipeline/[id]/notes/extract
//
// Deletes a specific meeting notes extraction by analysisId.
// ─────────────────────────────────────────────

const deleteSchema = z.object({
  analysisId: z.string(),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: opportunityId } = await params;
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

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
        analysisType: "MEETING_NOTES_EXTRACTION",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Meeting notes extraction not found" },
        { status: 404 },
      );
    }

    await deleteAnalysis(analysisId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[meeting-notes-extract] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete meeting notes extraction" },
      { status: 500 },
    );
  }
}
