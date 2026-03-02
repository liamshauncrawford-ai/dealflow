import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAIEnabled } from "@/lib/ai/claude-client";
import { extractMeetingNotes } from "@/lib/ai/meeting-notes-extractor";
import { getOpportunityNotesContext } from "@/lib/ai/note-context";

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

    // Save raw meeting notes
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

    // Cache the AI analysis result
    await prisma.aIAnalysisResult.create({
      data: {
        opportunityId,
        analysisType: "MEETING_NOTES_EXTRACTION",
        resultData: {
          rawNoteId: rawNote.id,
          extractedNoteId: extractedNote.id,
        },
        modelUsed: "claude-sonnet-4-5",
        inputTokens,
        outputTokens,
      },
    });

    return NextResponse.json({
      rawNote,
      extractedNote,
      tokens: { input: inputTokens, output: outputTokens },
    });
  } catch (err) {
    console.error("[meeting-notes-extract] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to extract meeting notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
