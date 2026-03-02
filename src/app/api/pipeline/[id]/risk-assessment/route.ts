import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assessDealRisk } from "@/lib/ai/risk-assessment";
import { isAIEnabled } from "@/lib/ai/claude-client";
import { generateAnalysis, getLatestAnalysis, editAnalysis, deleteAnalysis } from "@/lib/ai/analysis-manager";
import { z } from "zod";

// ─────────────────────────────────────────────
// GET /api/pipeline/[id]/risk-assessment
//
// Returns the latest cached AI risk assessment for an opportunity,
// or null if none exists.
// ─────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: opportunityId } = await params;

    const latest = await getLatestAnalysis({
      opportunityId,
      analysisType: "RISK_ASSESSMENT",
    });

    if (!latest) {
      return NextResponse.json({ result: null });
    }

    return NextResponse.json({
      analysisId: latest.id,
      result: latest.resultData,
      modelUsed: latest.modelUsed,
      createdAt: latest.createdAt,
    });
  } catch (err) {
    console.error("[risk-assessment] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch risk assessment" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// POST /api/pipeline/[id]/risk-assessment
//
// Generates a comprehensive AI risk assessment for an opportunity.
// Gathers all available data (financials, contacts, CIM data, emails)
// and sends to Claude Sonnet 4.5 for analysis.
//
// Caches result in AIAnalysisResult table.
// ─────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
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

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, title: true },
    });
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const { result: analysis, cached } = await generateAnalysis({
      opportunityId,
      analysisType: "RISK_ASSESSMENT",
      cacheHours: 24,
      generateFn: async () => {
        const { result, inputTokens, outputTokens, modelUsed } =
          await assessDealRisk(opportunityId);
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
    console.error("[risk-assessment] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate risk assessment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/pipeline/[id]/risk-assessment
//
// Updates the latest risk assessment's resultData (for editing
// recommendation, strengths, concerns, etc.)
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
        analysisType: "RISK_ASSESSMENT",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk assessment not found" },
        { status: 404 },
      );
    }

    const updated = await editAnalysis(analysisId, resultData);

    return NextResponse.json({
      analysisId: updated.id,
      result: updated.resultData,
    });
  } catch (err) {
    console.error("[risk-assessment] PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update risk assessment" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// DELETE /api/pipeline/[id]/risk-assessment
//
// Deletes a specific risk assessment by analysisId.
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

    // Verify the analysis belongs to this opportunity and is a risk assessment
    const existing = await prisma.aIAnalysisResult.findFirst({
      where: {
        id: analysisId,
        opportunityId,
        analysisType: "RISK_ASSESSMENT",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk assessment not found" },
        { status: 404 },
      );
    }

    await deleteAnalysis(analysisId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[risk-assessment] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete risk assessment" },
      { status: 500 },
    );
  }
}
