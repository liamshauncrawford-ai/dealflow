import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/market-intel/overview
 * Returns a combined market intelligence snapshot:
 * - Latest weekly brief
 * - Recent market metric series (last 90 days)
 * - Trade distribution across active listings
 * - Pipeline stage distribution
 * - Top-scoring targets
 */
export async function GET() {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [
      latestBrief,
      metricSeries,
      tradeDistribution,
      totalActive,
      averageScore,
      topTargets,
      recentListings,
    ] = await Promise.all([
      // Latest weekly brief
      prisma.weeklyBrief.findFirst({
        orderBy: { createdAt: "desc" },
      }),

      // Market metrics (last 90 days)
      prisma.marketMetric.findMany({
        where: { recordedAt: { gte: ninetyDaysAgo } },
        orderBy: { recordedAt: "asc" },
      }),

      // Trade distribution across non-hidden listings
      prisma.listing.groupBy({
        by: ["primaryTrade"],
        where: { isHidden: false, primaryTrade: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),

      // Total active listings
      prisma.listing.count({ where: { isHidden: false } }),

      // Average fit score
      prisma.listing.aggregate({
        where: { isHidden: false, fitScore: { not: null } },
        _avg: { fitScore: true },
      }),

      // Top 10 targets by composite score
      prisma.listing.findMany({
        where: {
          isHidden: false,
          compositeScore: { not: null },
        },
        select: {
          id: true,
          title: true,
          businessName: true,
          primaryTrade: true,
          compositeScore: true,
          thesisAlignment: true,
          tier: true,
          city: true,
          state: true,
          revenue: true,
        },
        orderBy: { compositeScore: "desc" },
        take: 10,
      }),

      // 5 most recent listings
      prisma.listing.findMany({
        where: { isHidden: false },
        select: {
          id: true,
          title: true,
          businessName: true,
          primaryTrade: true,
          city: true,
          state: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      brief: latestBrief
        ? {
            id: latestBrief.id,
            weekStart: latestBrief.weekStart.toISOString(),
            weekEnd: latestBrief.weekEnd.toISOString(),
            thesisHealth: latestBrief.thesisHealth,
            marketMomentum: latestBrief.marketMomentum,
            keyDevelopments: latestBrief.keyDevelopments,
            recommendedActions: latestBrief.recommendedActions,
            pipelineMetrics: latestBrief.pipelineMetrics,
            marketMetrics: latestBrief.marketMetrics,
            createdAt: latestBrief.createdAt.toISOString(),
          }
        : null,

      metricSeries: metricSeries.map((m) => ({
        recordedAt: m.recordedAt.toISOString(),
        targetsTracked: m.targetsTracked,
        actionableTargets: m.actionableTargets,
        newListingsThisPeriod: m.newListingsThisPeriod,
        listingsForSaleVolume: m.listingsForSaleVolume,
        weightedPipelineValue: m.weightedPipelineValue
          ? Number(m.weightedPipelineValue)
          : 0,
      })),

      tradeDistribution: tradeDistribution.map((t) => ({
        trade: t.primaryTrade,
        count: t._count.id,
      })),

      summary: {
        totalActive,
        avgFitScore: averageScore._avg.fitScore
          ? Math.round(averageScore._avg.fitScore)
          : null,
      },

      topTargets: topTargets.map((t) => ({
        id: t.id,
        name: t.businessName || t.title,
        primaryTrade: t.primaryTrade,
        score: t.compositeScore,
        thesisAlignment: t.thesisAlignment,
        tier: t.tier,
        location: [t.city, t.state].filter(Boolean).join(", "),
        revenue: t.revenue ? Number(t.revenue) : null,
      })),

      recentListings: recentListings.map((l) => ({
        id: l.id,
        name: l.businessName || l.title,
        primaryTrade: l.primaryTrade,
        location: [l.city, l.state].filter(Boolean).join(", "),
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Market overview error:", error);
    return NextResponse.json(
      { error: "Failed to fetch market overview" },
      { status: 500 },
    );
  }
}
