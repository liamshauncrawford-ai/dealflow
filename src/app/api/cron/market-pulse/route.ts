import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateWeeklyBrief,
  type WeeklyDataSnapshot,
} from "@/lib/ai/market-pulse";
import { requireCronOrAuth } from "@/lib/auth-helpers";

/**
 * POST /api/cron/market-pulse
 * Weekly thesis drift monitor — aggregates pipeline, news, and score data
 * from the past 7 days, sends to Claude for strategic assessment.
 * Auth: CRON_SECRET (external scheduler) or session cookie (dashboard).
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCronOrAuth(request);
    if (!authResult.authorized) return authResult.error;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 503 },
      );
    }

    const agentRun = await prisma.aIAgentRun.create({
      data: { agentName: "market_pulse", status: "running" },
    });

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Aggregate pipeline data
    const [
      totalTargets,
      actionableTargets,
      highScoreTargets,
      newListings,
      recentScoreChanges,
      recentNews,
      topTargets,
    ] = await Promise.all([
      prisma.listing.count({ where: { isHidden: false } }),
      prisma.listing.count({
        where: { isHidden: false, compositeScore: { gte: 50 } },
      }),
      prisma.listing.count({
        where: { isHidden: false, compositeScore: { gte: 70 } },
      }),
      prisma.listing.count({
        where: { isHidden: false, createdAt: { gte: weekAgo } },
      }),
      prisma.listing.findMany({
        where: {
          isHidden: false,
          scoreChange: { not: 0 },
          lastScoredAt: { gte: weekAgo },
        },
        select: {
          businessName: true,
          title: true,
          compositeScore: true,
          scoreChange: true,
        },
        orderBy: { scoreChange: "desc" },
        take: 10,
      }),
      prisma.newsItem.findMany({
        where: {
          fetchedAt: { gte: weekAgo },
          category: { not: "irrelevant" },
        },
        select: {
          headline: true,
          category: true,
          urgency: true,
          impactOnThesis: true,
        },
        orderBy: { fetchedAt: "desc" },
        take: 20,
      }),
      prisma.listing.findMany({
        where: {
          isHidden: false,
          compositeScore: { not: null },
        },
        select: {
          businessName: true,
          title: true,
          compositeScore: true,
          primaryTrade: true,
          thesisAlignment: true,
        },
        orderBy: { compositeScore: "desc" },
        take: 10,
      }),
    ]);

    // Build snapshot for Claude
    const snapshot: WeeklyDataSnapshot = {
      totalTargetsTracked: totalTargets,
      actionableTargets,
      highScoreTargets,
      newListingsThisWeek: newListings,
      scoreChanges: recentScoreChanges.map((l) => ({
        name: l.businessName || l.title,
        from: (l.compositeScore ?? 0) - (l.scoreChange ?? 0),
        to: l.compositeScore ?? 0,
      })),
      newsThisWeek: recentNews.map((n) => ({
        headline: n.headline ?? "",
        category: n.category ?? "unknown",
        urgency: n.urgency ?? "background",
        impact: n.impactOnThesis ?? "neutral",
      })),
      topTargets: topTargets.map((t) => ({
        name: t.businessName || t.title,
        score: t.compositeScore ?? 0,
        trade: t.primaryTrade,
        thesisAlignment: t.thesisAlignment,
      })),
    };

    // Generate the brief
    const { result, inputTokens, outputTokens } = await generateWeeklyBrief(snapshot);
    const totalTokens = inputTokens + outputTokens;
    const totalCost = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;

    // Store the weekly brief
    const now = new Date();
    const weekStart = weekAgo;
    const weekEnd = now;

    await prisma.weeklyBrief.create({
      data: {
        weekStart,
        weekEnd,
        thesisHealth: result.thesis_health,
        marketMomentum: result.market_momentum,
        rawBrief: result as object,
        keyDevelopments: result.key_developments,
        recommendedActions: result.recommended_actions_this_week,
        pipelineMetrics: result.pipeline_assessment as object,
        marketMetrics: result.market_metrics as object,
      },
    });

    // Create weekly digest notification
    await prisma.notification.create({
      data: {
        type: "WEEKLY_BRIEF",
        title: `Weekly Brief: Thesis ${result.thesis_health.charAt(0).toUpperCase() + result.thesis_health.slice(1)}`,
        message: result.thesis_health_reasoning,
        priority: result.thesis_health === "at_risk" || result.thesis_health === "caution"
          ? "high"
          : "normal",
        entityType: "brief",
        actionUrl: "/intelligence",
      },
    });

    // If thesis health is concerning, add a separate high-priority alert
    if (result.thesis_health === "at_risk") {
      await prisma.notification.create({
        data: {
          type: "AGENT_ERROR",
          title: "Thesis At Risk — Immediate Attention Required",
          message: result.thesis_health_reasoning,
          priority: "high",
          entityType: "brief",
          actionUrl: "/intelligence",
        },
      });
    }

    // Finalize agent run
    await prisma.aIAgentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "success",
        itemsProcessed: 1,
        itemsCreated: 1,
        apiCallsMade: 1,
        totalTokens,
        totalCost,
        summary: `Weekly brief: thesis ${result.thesis_health}, momentum ${result.market_momentum}`,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Market pulse complete",
      thesisHealth: result.thesis_health,
      marketMomentum: result.market_momentum,
      keyDevelopments: result.key_developments.length,
      cost: `$${totalCost.toFixed(3)}`,
    });
  } catch (error) {
    console.error("Market pulse error:", error);

    try {
      const latestRun = await prisma.aIAgentRun.findFirst({
        where: { agentName: "market_pulse", status: "running" },
        orderBy: { startedAt: "desc" },
      });
      if (latestRun) {
        await prisma.aIAgentRun.update({
          where: { id: latestRun.id },
          data: {
            status: "error",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          },
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      { error: "Market pulse failed", detail: error instanceof Error ? error.message : undefined },
      { status: 500 },
    );
  }
}
