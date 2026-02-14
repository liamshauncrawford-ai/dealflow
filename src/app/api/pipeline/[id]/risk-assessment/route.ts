import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assessDealRisk } from "@/lib/ai/risk-assessment";
import { isAIEnabled } from "@/lib/ai/claude-client";
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

    const latest = await prisma.aIAnalysisResult.findFirst({
      where: {
        opportunityId,
        analysisType: "RISK_ASSESSMENT",
      },
      orderBy: { createdAt: "desc" },
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

    // Check for cached result (if less than 24 hours old, return it)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cached = await prisma.aIAnalysisResult.findFirst({
      where: {
        opportunityId,
        analysisType: "RISK_ASSESSMENT",
        createdAt: { gte: oneDayAgo },
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

    // Generate new assessment
    const { result, inputTokens, outputTokens, modelUsed } =
      await assessDealRisk(opportunityId);

    // Cache the result
    const analysis = await prisma.aIAnalysisResult.create({
      data: {
        opportunityId,
        analysisType: "RISK_ASSESSMENT",
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

    const updated = await prisma.aIAnalysisResult.update({
      where: { id: analysisId },
      data: { resultData: resultData as object },
    });

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
