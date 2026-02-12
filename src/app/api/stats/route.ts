import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MINIMUM_EBITDA, MINIMUM_SDE } from "@/lib/constants";

export async function GET() {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

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
      // Thesis KPIs
      tier1Listings,
      ownedListings,
      closedWonOpps,
      upcomingFollowUps,
      tier1PrimaryContacts,
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

      // ── Thesis KPIs ──

      // Pipeline Value: Tier 1 listings for valuation sum
      prisma.listing.findMany({
        where: { isActive: true, tier: "TIER_1_ACTIVE" },
        select: { ebitda: true, inferredEbitda: true, targetMultipleLow: true, targetMultipleHigh: true },
      }),

      // Platform: OWNED listings
      prisma.listing.findMany({
        where: { isActive: true, tier: "OWNED" },
        select: { revenue: true, ebitda: true, inferredEbitda: true },
      }),

      // Closed Won opportunities (capital deployed + platform metrics)
      prisma.opportunity.findMany({
        where: { stage: "CLOSED_WON" },
        include: { listing: { select: { revenue: true, ebitda: true, inferredEbitda: true } } },
      }),

      // Upcoming follow-ups (next 7 days)
      prisma.contact.findMany({
        where: {
          nextFollowUpDate: { gte: now, lte: sevenDaysFromNow },
        },
        include: { opportunity: { select: { id: true, title: true } } },
        orderBy: { nextFollowUpDate: "asc" },
        take: 10,
      }),

      // Tier 1 primary contacts for "days since last contact" alert
      prisma.contact.findMany({
        where: {
          isPrimary: true,
          opportunity: { listing: { tier: "TIER_1_ACTIVE" } },
        },
        include: { opportunity: { select: { id: true, title: true, updatedAt: true } } },
      }),
    ]);

    const winRate = (wonCount + lostCount) > 0
      ? wonCount / (wonCount + lostCount)
      : null;

    // Pipeline Value (sum of implied EV ranges for Tier 1 targets)
    let pipelineValueLow = 0;
    let pipelineValueHigh = 0;
    for (const l of tier1Listings) {
      const ebitdaVal = l.ebitda ? Number(l.ebitda) : (l.inferredEbitda ? Number(l.inferredEbitda) : 0);
      if (ebitdaVal > 0) {
        pipelineValueLow += ebitdaVal * (l.targetMultipleLow ?? 3.0);
        pipelineValueHigh += ebitdaVal * (l.targetMultipleHigh ?? 5.0);
      }
    }

    // Platform Revenue/EBITDA (owned + closed won)
    let platformRevenue = 0;
    let platformEbitda = 0;
    for (const l of ownedListings) {
      platformRevenue += l.revenue ? Number(l.revenue) : 0;
      platformEbitda += l.ebitda ? Number(l.ebitda) : (l.inferredEbitda ? Number(l.inferredEbitda) : 0);
    }
    let capitalDeployed = 0;
    for (const opp of closedWonOpps) {
      capitalDeployed += opp.offerPrice ? Number(opp.offerPrice) : 0;
      if (opp.listing) {
        platformRevenue += opp.listing.revenue ? Number(opp.listing.revenue) : 0;
        platformEbitda += opp.listing.ebitda ? Number(opp.listing.ebitda) : (opp.listing.inferredEbitda ? Number(opp.listing.inferredEbitda) : 0);
      }
    }

    // Implied Platform Multiple & MOIC
    const impliedPlatformMultiple = platformEbitda > 0 && capitalDeployed > 0
      ? capitalDeployed / platformEbitda
      : null;
    const platformValuation7x = platformEbitda * 7;
    const targetMoic = capitalDeployed > 0
      ? platformValuation7x / capitalDeployed
      : null;

    // Stale Tier 1 contacts (>30 days since last activity)
    const staleT1Contacts = tier1PrimaryContacts
      .filter((c) => {
        const lastActivity = c.lastInteractionDate ?? c.opportunity?.updatedAt;
        return !lastActivity || new Date(lastActivity) < thirtyDaysAgo;
      })
      .map((c) => ({
        contactName: c.name,
        opportunityId: c.opportunity?.id,
        opportunityTitle: c.opportunity?.title,
        daysSinceContact: c.lastInteractionDate
          ? Math.floor((now.getTime() - new Date(c.lastInteractionDate).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      }));

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

      // Thesis KPIs
      pipelineValueLow,
      pipelineValueHigh,
      capitalDeployed,
      platformRevenue,
      platformEbitda,
      impliedPlatformMultiple: impliedPlatformMultiple
        ? Math.round(impliedPlatformMultiple * 10) / 10
        : null,
      platformValuation7x,
      platformValuation10x: platformEbitda * 10,
      targetMoic: targetMoic
        ? Math.round(targetMoic * 10) / 10
        : null,
      upcomingFollowUps: upcomingFollowUps.map((c) => ({
        contactName: c.name,
        opportunityId: c.opportunity?.id,
        opportunityTitle: c.opportunity?.title,
        followUpDate: c.nextFollowUpDate,
      })),
      staleT1Contacts,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
