import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MINIMUM_EBITDA, MINIMUM_SDE } from "@/lib/constants";

export async function GET() {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalActive,
      newThisWeek,
      pipelineActive,
      pipelineByStage,
      avgAskingPrice,
      recentListings,
      platformCounts,
      wonCount,
      lostCount,
      avgDealValue,
      lostReasonBreakdown,
      tierBreakdown,
      avgFitScore,
    ] = await Promise.all([
      // Total active listings meeting threshold
      prisma.listing.count({
        where: {
          isActive: true,
          isHidden: false,
          OR: [
            { ebitda: { gte: MINIMUM_EBITDA } },
            { sde: { gte: MINIMUM_SDE } },
            { inferredEbitda: { gte: MINIMUM_EBITDA } },
            { inferredSde: { gte: MINIMUM_SDE } },
            {
              AND: [
                { ebitda: null },
                { sde: null },
                { inferredEbitda: null },
                { inferredSde: null },
              ],
            },
          ],
        },
      }),

      // New listings this week
      prisma.listing.count({
        where: {
          isActive: true,
          firstSeenAt: { gte: weekAgo },
        },
      }),

      // Active pipeline opportunities (not closed or on hold)
      prisma.opportunity.count({
        where: {
          stage: {
            notIn: ["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"],
          },
        },
      }),

      // Pipeline counts by stage
      prisma.opportunity.groupBy({
        by: ["stage"],
        _count: { id: true },
      }),

      // Average asking price
      prisma.listing.aggregate({
        where: {
          isActive: true,
          isHidden: false,
          askingPrice: { not: null },
        },
        _avg: { askingPrice: true },
      }),

      // 10 most recent listings
      prisma.listing.findMany({
        where: { isActive: true, isHidden: false },
        include: { sources: true },
        orderBy: { firstSeenAt: "desc" },
        take: 10,
      }),

      // Listings count by platform
      prisma.listingSource.groupBy({
        by: ["platform"],
        _count: { id: true },
      }),

      // Win/loss counts
      prisma.opportunity.count({ where: { stage: "CLOSED_WON" } }),
      prisma.opportunity.count({ where: { stage: "CLOSED_LOST" } }),

      // Average deal value
      prisma.opportunity.aggregate({
        where: { dealValue: { not: null } },
        _avg: { dealValue: true },
      }),

      // Loss reason breakdown
      prisma.opportunity.groupBy({
        by: ["lostCategory"],
        where: { stage: "CLOSED_LOST", lostCategory: { not: null } },
        _count: { id: true },
      }),

      // Tier breakdown
      prisma.listing.groupBy({
        by: ["tier"],
        where: { isActive: true, tier: { not: null } },
        _count: { id: true },
      }),

      // Average fit score
      prisma.listing.aggregate({
        where: { isActive: true, fitScore: { not: null } },
        _avg: { fitScore: true },
      }),
    ]);

    const winRate = (wonCount + lostCount) > 0
      ? wonCount / (wonCount + lostCount)
      : null;

    return NextResponse.json({
      totalActive,
      newThisWeek,
      pipelineActive,
      pipelineByStage: pipelineByStage.map((s) => ({
        stage: s.stage,
        count: s._count.id,
      })),
      avgAskingPrice: avgAskingPrice._avg.askingPrice
        ? Number(avgAskingPrice._avg.askingPrice)
        : null,
      recentListings,
      platformCounts: platformCounts.map((p) => ({
        platform: p.platform,
        count: p._count.id,
      })),
      winRate,
      wonCount,
      lostCount,
      avgDealValue: avgDealValue._avg.dealValue
        ? Number(avgDealValue._avg.dealValue)
        : null,
      lostReasonBreakdown: lostReasonBreakdown.map((r) => ({
        category: r.lostCategory,
        count: r._count.id,
      })),
      tierBreakdown: tierBreakdown.map((t) => ({
        tier: t.tier,
        count: t._count.id,
      })),
      avgFitScore: avgFitScore._avg.fitScore
        ? Math.round(avgFitScore._avg.fitScore)
        : null,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
