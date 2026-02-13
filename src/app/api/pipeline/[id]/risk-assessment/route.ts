import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assessDealRisk } from "@/lib/ai/risk-assessment";
import { isAIEnabled } from "@/lib/ai/claude-client";

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
