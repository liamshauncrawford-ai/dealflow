import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkStaleAndOverdue } from "@/lib/workflow-engine";
import { loadThesisConfig } from "@/lib/thesis-loader";
import { getOpportunityValueRange } from "@/lib/valuation";
import type { PipelineStage } from "@prisma/client";

export async function GET() {
  try {
    // Run stale/overdue detection (rate-limited internally to once per 5 min)
    await checkStaleAndOverdue();

    // Load configurable thesis parameters from DB (with defaults fallback)
    const thesisConfig = await loadThesisConfig();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Platform query: if a specific listing is designated, fetch it; otherwise fall back to tier=OWNED
    const platformListingQuery = thesisConfig.platformListingId
      ? prisma.listing.findMany({
          where: { id: thesisConfig.platformListingId },
          select: { revenue: true, ebitda: true, inferredEbitda: true },
        })
      : prisma.listing.findMany({
          where: { isActive: true, tier: "OWNED" },
          select: { revenue: true, ebitda: true, inferredEbitda: true },
        });

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
      pipelineOppsForValue,
      ownedListings,
      closedWonOpps,
      upcomingFollowUps,
      tier1PrimaryContacts,
      // Offer price stats
      offerPriceAgg,
      dealsWithBothPrices,
    ] = await Promise.all([
      // Total active listings meeting threshold (uses configurable thresholds)
      prisma.listing.count({
        where: {
          isActive: true,
          isHidden: false,
          OR: [
            { ebitda: { gte: thesisConfig.minimumEbitda } },
            { sde: { gte: thesisConfig.minimumSde } },
            { inferredEbitda: { gte: thesisConfig.minimumEbitda } },
            { inferredSde: { gte: thesisConfig.minimumSde } },
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

      // Pipeline Value: configurable stages
      prisma.opportunity.findMany({
        where: {
          stage: { in: thesisConfig.pipelineValueStages as PipelineStage[] },
        },
        select: {
          id: true,
          stage: true,
          dealValue: true,
          offerPrice: true,
          actualEbitda: true,
          listing: {
            select: {
              ebitda: true,
              inferredEbitda: true,
              askingPrice: true,
              targetMultipleLow: true,
              targetMultipleHigh: true,
            },
          },
        },
      }),

      // Platform: OWNED listings (or specific platform listing)
      platformListingQuery,

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

      // Average offer price across active pipeline deals
      prisma.opportunity.aggregate({
        where: {
          offerPrice: { not: null },
          stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
        },
        _avg: { offerPrice: true },
        _sum: { offerPrice: true },
        _count: { offerPrice: true },
      }),

      // Active pipeline deals with offerPrice + linked listing askingPrice (for avg discount)
      prisma.opportunity.findMany({
        where: {
          offerPrice: { not: null },
          stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
          listing: { askingPrice: { not: null } },
        },
        select: {
          offerPrice: true,
          listing: { select: { askingPrice: true } },
        },
      }),
    ]);

    const winRate = (wonCount + lostCount) > 0
      ? wonCount / (wonCount + lostCount)
      : null;

    // Pipeline Value (sum across configured pipeline opportunities)
    // Uses shared 5-tier waterfall: dealValue → offerPrice → actualEbitda × mult → listing EBITDA × mult → askingPrice
    let pipelineValueLow = 0;
    let pipelineValueHigh = 0;
    let pipelineValuedCount = 0;
    const valueByStageMap = new Map<string, { valueLow: number; valueHigh: number }>();
    for (const opp of pipelineOppsForValue) {
      const range = getOpportunityValueRange(opp);
      if (range) {
        pipelineValueLow += range.low;
        pipelineValueHigh += range.high;
        pipelineValuedCount++;

        // Accumulate per stage
        const stageKey = opp.stage;
        const existing = valueByStageMap.get(stageKey) ?? { valueLow: 0, valueHigh: 0 };
        existing.valueLow += range.low;
        existing.valueHigh += range.high;
        valueByStageMap.set(stageKey, existing);
      }
    }

    const pipelineValueByStage = Array.from(valueByStageMap.entries()).map(
      ([stage, { valueLow, valueHigh }]) => ({ stage, valueLow, valueHigh })
    );

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

    // Implied Platform Multiple & MOIC (using configurable exit multiples)
    const impliedPlatformMultiple = platformEbitda > 0 && capitalDeployed > 0
      ? capitalDeployed / platformEbitda
      : null;
    const platformValuationLow = platformEbitda * thesisConfig.exitMultipleLow;
    const platformValuationHigh = platformEbitda * thesisConfig.exitMultipleHigh;
    const targetMoic = capitalDeployed > 0
      ? platformValuationLow / capitalDeployed
      : null;

    // Offer price metrics
    const avgOfferPrice = offerPriceAgg._avg.offerPrice
      ? Number(offerPriceAgg._avg.offerPrice)
      : null;
    const totalPipelineOfferValue = offerPriceAgg._sum.offerPrice
      ? Number(offerPriceAgg._sum.offerPrice)
      : 0;
    const pipelineDealsWithOffer = offerPriceAgg._count.offerPrice ?? 0;

    // Average discount from asking price
    let avgDiscount: number | null = null;
    if (dealsWithBothPrices.length > 0) {
      const discounts = dealsWithBothPrices.map((d) => {
        const ask = Number(d.listing!.askingPrice);
        const offer = Number(d.offerPrice);
        return ask > 0 ? ((ask - offer) / ask) * 100 : 0;
      });
      avgDiscount = discounts.reduce((a, b) => a + b, 0) / discounts.length;
    }

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
      pipelineValuedCount,
      pipelineOppCount: pipelineOppsForValue.length,
      capitalDeployed,
      platformRevenue,
      platformEbitda,
      impliedPlatformMultiple: impliedPlatformMultiple
        ? Math.round(impliedPlatformMultiple * 10) / 10
        : null,
      platformValuationLow,
      platformValuationHigh,
      exitMultipleLow: thesisConfig.exitMultipleLow,
      exitMultipleHigh: thesisConfig.exitMultipleHigh,
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

      // Offer price metrics
      avgOfferPrice,
      totalPipelineOfferValue,
      pipelineDealsWithOffer,
      avgDiscount: avgDiscount !== null ? Math.round(avgDiscount * 10) / 10 : null,

      // Pipeline value by stage (for charts)
      pipelineValueByStage,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
