import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWeeklyBrief } from "@/lib/ai/weekly-brief";
import { isAIEnabled } from "@/lib/ai/claude-client";
import { requireCronOrAuth } from "@/lib/auth-helpers";
import { PRIMARY_TRADES } from "@/lib/constants";

/**
 * POST /api/cron/weekly-brief
 * Generates a weekly intelligence brief by gathering pipeline, listing,
 * and scoring data, then calling Claude for strategic analysis.
 * Auth: CRON_SECRET (external scheduler) or session cookie (dashboard).
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCronOrAuth(request);
    if (!authResult.authorized) return authResult.error;

    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 503 },
      );
    }

    const agentRun = await prisma.aIAgentRun.create({
      data: { agentName: "weekly_brief", status: "running" },
    });

    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // ── Gather pipeline summary ──────────────────

    const opportunities = await prisma.opportunity.findMany({
      select: {
        stage: true,
        dealValue: true,
        updatedAt: true,
      },
    });

    const stageCounts: Record<string, number> = {};
    let totalPipelineValue = 0;
    let stalledDeals = 0;

    for (const opp of opportunities) {
      stageCounts[opp.stage] = (stageCounts[opp.stage] ?? 0) + 1;
      if (opp.dealValue) totalPipelineValue += opp.dealValue;
      if (opp.updatedAt < fourteenDaysAgo) stalledDeals++;
    }

    const pipelineSummary = [
      `Total opportunities: ${opportunities.length}`,
      `Stages: ${Object.entries(stageCounts).map(([s, c]) => `${s}: ${c}`).join(", ") || "none"}`,
      `Total deal value: $${totalPipelineValue.toLocaleString()}`,
      `Stalled deals (no update in 14 days): ${stalledDeals}`,
    ].join("\n");

    // ── Gather listing activity ──────────────────

    const [newListings7d, totalListings, scoredListings, avgScoreResult] =
      await Promise.all([
        prisma.listing.count({
          where: { isHidden: false, createdAt: { gte: sevenDaysAgo } },
        }),
        prisma.listing.count({
          where: { isHidden: false },
        }),
        prisma.listing.count({
          where: { isHidden: false, compositeScore: { not: null } },
        }),
        prisma.listing.aggregate({
          where: { isHidden: false, compositeScore: { not: null } },
          _avg: { compositeScore: true },
        }),
      ]);

    const avgCompositeScore = avgScoreResult._avg.compositeScore ?? 0;

    const listingActivity = [
      `New listings (last 7 days): ${newListings7d}`,
      `Total active listings: ${totalListings}`,
      `Scored listings: ${scoredListings}`,
      `Average composite score: ${Math.round(avgCompositeScore)}`,
    ].join("\n");

    // ── Thesis config ────────────────────────────

    const tradeLabels = Object.entries(PRIMARY_TRADES)
      .map(([key, val]) => `${key}: ${val.label}`)
      .join(", ");

    const thesisConfig = `Target trades (11 categories): ${tradeLabels}`;

    // ── Score distribution ───────────────────────

    const [range0_20, range21_40, range41_60, range61_80, range81_100] =
      await Promise.all([
        prisma.listing.count({
          where: {
            isHidden: false,
            compositeScore: { gte: 0, lte: 20 },
          },
        }),
        prisma.listing.count({
          where: {
            isHidden: false,
            compositeScore: { gte: 21, lte: 40 },
          },
        }),
        prisma.listing.count({
          where: {
            isHidden: false,
            compositeScore: { gte: 41, lte: 60 },
          },
        }),
        prisma.listing.count({
          where: {
            isHidden: false,
            compositeScore: { gte: 61, lte: 80 },
          },
        }),
        prisma.listing.count({
          where: {
            isHidden: false,
            compositeScore: { gte: 81, lte: 100 },
          },
        }),
      ]);

    const scoreDistribution = [
      `0-20: ${range0_20}`,
      `21-40: ${range21_40}`,
      `41-60: ${range41_60}`,
      `61-80: ${range61_80}`,
      `81-100: ${range81_100}`,
    ].join("\n");

    // ── Generate the brief ───────────────────────

    const result = await generateWeeklyBrief({
      pipelineSummary,
      listingActivity,
      thesisConfig,
      scoreDistribution,
    });

    const totalTokens = result.inputTokens + result.outputTokens;
    const totalCost =
      (result.inputTokens / 1_000_000) * 3.0 +
      (result.outputTokens / 1_000_000) * 15.0;

    // ── Delete previous briefs (keep-latest-only) ──
    await prisma.weeklyBrief.deleteMany({});

    // ── Store WeeklyBrief ────────────────────────

    await prisma.weeklyBrief.create({
      data: {
        weekStart: sevenDaysAgo,
        weekEnd: now,
        thesisHealth: result.thesisHealth,
        marketMomentum: result.marketMomentum,
        rawBrief: result as object,
        keyDevelopments: result.keyDevelopments,
        recommendedActions: result.recommendedActions,
        pipelineMetrics: result.pipelineMetrics as object,
        marketMetrics: result.marketMetrics as object,
      },
    });

    // ── Store MarketMetric snapshot ───────────────

    const actionableCount = await prisma.listing.count({
      where: { isHidden: false, compositeScore: { gte: 50 } },
    });

    await prisma.marketMetric.create({
      data: {
        recordedAt: now,
        targetsTracked: totalListings,
        actionableTargets: actionableCount,
        newListingsThisPeriod: newListings7d,
        weightedPipelineValue: totalPipelineValue,
      },
    });

    // ── Create notification ──────────────────────

    await prisma.notification.create({
      data: {
        type: "WEEKLY_BRIEF",
        title: `Weekly Brief: Thesis ${result.thesisHealth.charAt(0).toUpperCase() + result.thesisHealth.slice(1)}`,
        message: `Market momentum: ${result.marketMomentum}. ${result.keyDevelopments[0] ?? ""}`,
        priority: result.thesisHealth === "weak" ? "high" : "normal",
        entityType: "brief",
        actionUrl: "/market-intel/overview",
      },
    });

    // ── Finalize agent run ───────────────────────

    await prisma.aIAgentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "success",
        itemsProcessed: 1,
        itemsCreated: 1,
        apiCallsMade: 1,
        totalTokens,
        totalCost,
        summary: `Weekly brief: thesis ${result.thesisHealth}, momentum ${result.marketMomentum}`,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Weekly brief generated",
      thesisHealth: result.thesisHealth,
      marketMomentum: result.marketMomentum,
      keyDevelopments: result.keyDevelopments,
      recommendedActions: result.recommendedActions,
      pipelineMetrics: result.pipelineMetrics,
      marketMetrics: result.marketMetrics,
      cost: `$${totalCost.toFixed(3)}`,
    });
  } catch (error) {
    console.error("Weekly brief error:", error);

    // Try to mark the agent run as failed
    try {
      const latestRun = await prisma.aIAgentRun.findFirst({
        where: { agentName: "weekly_brief", status: "running" },
        orderBy: { startedAt: "desc" },
      });
      if (latestRun) {
        await prisma.aIAgentRun.update({
          where: { id: latestRun.id },
          data: {
            status: "error",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          },
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      {
        error: "Weekly brief generation failed",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}
