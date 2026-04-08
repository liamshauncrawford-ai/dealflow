import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCronOrAuth } from "@/lib/auth-helpers";
import {
  scoreAcquisitionTarget,
  loadScoringConfig,
  clearScoringConfigCache,
  type AcquisitionScoreInput,
} from "@/lib/scoring/acquisition-scorer";

/**
 * POST /api/admin/setup-acquisition
 *
 * One-shot endpoint that:
 * 1. Seeds AcquisitionThesisConfig (4 ranks)
 * 2. Seeds acquisition_scoring_config AppSetting
 * 3. Maps existing listings by primaryTrade → targetRank
 * 4. Rescores all active listings with new rubric
 *
 * Idempotent (uses upserts). Safe to call multiple times.
 * Auth: CRON_SECRET or authenticated user session.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireCronOrAuth(request);
  if (!authResult.authorized) return authResult.error;

  const log: string[] = [];

  try {
    // ── 1. Seed AcquisitionThesisConfig ──────────────────
    const RANK_CONFIGS = [
      {
        targetRank: 1,
        rankLabel: "MSP",
        description: "Managed IT Services Provider — highest synergy target. MRR funds PMS turnaround. Same commercial client base.",
        synergyDescription: "MSPs serve the same commercial clients that need AV integration. Liam takes over sales/BD while existing techs continue service delivery.",
        hardFilterMinRevenue: 800000, hardFilterMinEbitda: 150000, hardFilterMinEbitdaMargin: 0.10,
        hardFilterMinMrrPct: 0.30, hardFilterMinYears: 5,
        softFilterRevenueLow: 1000000, softFilterRevenueHigh: 3000000,
        softFilterEbitdaLow: 250000, softFilterEbitdaHigh: 425000,
        valuationMultipleLow: 4.0, valuationMultipleMid: 5.0, valuationMultipleHigh: 6.0,
        impliedPriceLow: 1000000, impliedPriceHigh: 2100000,
        sicCodes: ["7376", "7379", "7374"],
        naicsCodes: ["541512", "541513", "541519", "518210"],
      },
      {
        targetRank: 2,
        rankLabel: "UCaaS",
        description: "Unified Communications / Teams Rooms / VoIP — direct AV overlap with seat-based MRR.",
        synergyDescription: "UCaaS providers sell into the same meeting rooms PMS installs AV in. Teams Rooms and VoIP create sticky monthly revenue.",
        hardFilterMinRevenue: 500000, hardFilterMinEbitda: 100000, hardFilterMinEbitdaMargin: 0.08,
        hardFilterMinMrrPct: 0.40, hardFilterMinYears: 3,
        softFilterRevenueLow: 500000, softFilterRevenueHigh: 2000000,
        softFilterEbitdaLow: 150000, softFilterEbitdaHigh: 350000,
        valuationMultipleLow: 4.0, valuationMultipleMid: 5.0, valuationMultipleHigh: 6.0,
        impliedPriceLow: 600000, impliedPriceHigh: 2100000,
        sicCodes: ["4813", "7372", "7379", "4899"],
        naicsCodes: ["517312", "517911", "541512", "519190"],
      },
      {
        targetRank: 3,
        rankLabel: "Security Integration",
        description: "Commercial security integration with monitoring contracts — recurring monitoring MRR, same job sites.",
        synergyDescription: "Security integrators wire the same commercial buildings PMS does AV for. Monitoring contracts provide sticky MRR.",
        hardFilterMinRevenue: 500000, hardFilterMinEbitda: 100000, hardFilterMinEbitdaMargin: 0.08,
        hardFilterMinMrrPct: 0.20, hardFilterMinYears: 5,
        softFilterRevenueLow: 500000, softFilterRevenueHigh: 2500000,
        softFilterEbitdaLow: 150000, softFilterEbitdaHigh: 350000,
        valuationMultipleLow: 3.0, valuationMultipleMid: 4.0, valuationMultipleHigh: 4.5,
        impliedPriceLow: 450000, impliedPriceHigh: 1600000,
        sicCodes: ["7382", "7381", "1731", "5065"],
        naicsCodes: ["561621", "238210", "423690"],
      },
      {
        targetRank: 4,
        rankLabel: "Structured Cabling",
        description: "Structured cabling / low-voltage contractor — operational bolt-on capturing margin PMS currently leaves on table.",
        synergyDescription: "PMS subcontracts cabling today at 0% margin. Owning a cabling company captures that margin internally.",
        hardFilterMinRevenue: 300000, hardFilterMinEbitda: 80000, hardFilterMinEbitdaMargin: 0.08,
        hardFilterMinMrrPct: null, hardFilterMinYears: 3,
        softFilterRevenueLow: 500000, softFilterRevenueHigh: 2000000,
        softFilterEbitdaLow: 120000, softFilterEbitdaHigh: 280000,
        valuationMultipleLow: 2.5, valuationMultipleMid: 3.5, valuationMultipleHigh: 4.0,
        impliedPriceLow: 300000, impliedPriceHigh: 1100000,
        sicCodes: ["1731", "1799", "1711"],
        naicsCodes: ["238210", "238290", "561990"],
      },
    ];

    for (const config of RANK_CONFIGS) {
      await prisma.acquisitionThesisConfig.upsert({
        where: { targetRank: config.targetRank },
        update: config,
        create: config,
      });
    }
    log.push("Seeded 4 AcquisitionThesisConfig ranks");

    // ── 2. Seed scoring config AppSetting ────────────────
    const scoringConfig = {
      financial: {
        ebitdaMargin: { thresholds: [0.20, 0.15, 0.10, 0.05], points: [10, 8, 5, 0] },
        mrrPct: { thresholds: [0.50, 0.30, 0.15, 0.0], points: [10, 8, 5, 0] },
        revenueTrend: { values: { "Growing >10%": 10, "Growing 0-10%": 8, "Flat": 5, "Declining 0-10%": 2, "Declining >10%": 0 } },
        clientConcentration: { thresholds: [0.10, 0.15, 0.25, 0.40], points: [10, 8, 5, 0] },
      },
      strategic: {
        targetRank: { values: { "1": 12, "2": 8, "3": 5, "4": 5, "null": 0 } },
        clientOverlap: { values: { Direct: 12, Moderate: 8, Partial: 5, None: 0 } },
        geography: {
          denverMetroCities: ["Denver","Aurora","Lakewood","Arvada","Westminster","Thornton","Centennial","Highlands Ranch","Boulder","Longmont","Loveland","Fort Collins","Greeley","Castle Rock","Parker","Broomfield","Commerce City","Northglenn","Brighton","Littleton","Englewood","Sheridan","Golden","Wheat Ridge","Federal Heights","Lone Tree","Superior","Louisville","Lafayette","Erie"],
          points: { denverMetro: 12, colorado: 8, neighboringState: 5, other: 0 },
          neighboringStates: ["WY","NE","KS","NM","UT"],
        },
        ownerSituation: { values: { Strong: 12, Moderate: 8, Weak: 5, Unknown: 0 } },
        cap: 35,
      },
      operatorFit: {
        ownerIsPrimarySales: { "true": 12, "false": 5, "null": 0 },
        technicalStaff: { thresholds: [3, 2, 1, 0], points: [12, 10, 5, 0] },
        sbaEligible: { "true": 12, "false": 0, "null": 5 },
        cap: 25,
      },
      tiers: { A: 80, B: 65, C: 50, Inactive: 0 },
      disqualifiers: {
        ownerIsSoleTech: true, topClientPctMax: 0.40, residentialOnly: true,
        outsideColorado: true, negativeEbitdaUnlessCheap: { priceThreshold: 100000 },
        activeLitigation: true, keyManInsuranceLapse: true, revenueDecliningHard: true,
      },
      pms: { monthlyBurn: 28583, location: "Sheridan, CO 80110", ownerSalaryForSdeAdjustment: 95000 },
    };

    await prisma.appSetting.upsert({
      where: { key: "acquisition_scoring_config" },
      update: { value: JSON.stringify(scoringConfig) },
      create: { key: "acquisition_scoring_config", value: JSON.stringify(scoringConfig) },
    });
    log.push("Seeded acquisition_scoring_config AppSetting");

    // ── 3. Map existing listings by primaryTrade ─────────
    const TRADE_TO_RANK: Record<string, { rank: number; label: string }> = {
      SECURITY_FIRE_ALARM: { rank: 3, label: "Security Integration" },
      STRUCTURED_CABLING: { rank: 4, label: "Structured Cabling" },
      ELECTRICAL: { rank: 4, label: "Structured Cabling" },
    };

    const allListings = await prisma.listing.findMany({
      where: { isActive: true },
    });

    let ranked = 0;
    let unranked = 0;

    for (const listing of allListings) {
      const mapping = listing.primaryTrade ? TRADE_TO_RANK[listing.primaryTrade] : null;
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          targetRank: mapping?.rank ?? null,
          targetRankLabel: mapping?.label ?? null,
        },
      });
      if (mapping) ranked++;
      else unranked++;
    }
    log.push(`Mapped ${ranked} listings to ranks, ${unranked} unranked`);

    // ── 4. Rescore all with new rubric ───────────────────
    clearScoringConfigCache();
    const config = await loadScoringConfig();

    const tierCounts: Record<string, number> = { A: 0, B: 0, C: 0, Inactive: 0 };
    let disqualified = 0;

    for (const listing of allListings) {
      const input: AcquisitionScoreInput = {
        targetRank: listing.targetRank,
        ebitda: listing.ebitda ? Number(listing.ebitda) : (listing.inferredEbitda ? Number(listing.inferredEbitda) : null),
        revenue: listing.revenue ? Number(listing.revenue) : null,
        askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
        mrrPctOfRevenue: listing.mrrPctOfRevenue,
        revenueTrendDetail: listing.revenueTrendDetail,
        topClientPct: listing.topClientPct,
        clientIndustryOverlap: listing.clientIndustryOverlap,
        state: listing.state,
        city: listing.city,
        metroArea: listing.metroArea,
        ownerRetirementSignal: listing.ownerRetirementSignal,
        ownerIsPrimarySales: listing.ownerIsPrimarySales,
        technicalStaffCount: listing.technicalStaffCount,
        sbaEligible: listing.sbaEligible,
        ownerIsSoleTech: listing.ownerIsSoleTech,
        clientBaseType: listing.clientBaseType,
        hasActiveLitigation: listing.hasActiveLitigation,
        hasKeyManInsurance: listing.hasKeyManInsurance,
      };

      const result = scoreAcquisitionTarget(input, config);

      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          acquisitionScore: result.total,
          financialScore: result.financialScore,
          strategicScore: result.strategicScore,
          operatorScore: result.operatorScore,
          acquisitionTier: result.tier,
          acquisitionDisqualifiers: result.disqualifiers,
        },
      });

      tierCounts[result.tier]++;
      if (result.disqualifiers.length > 0) disqualified++;
    }
    log.push(`Scored ${allListings.length} listings: A=${tierCounts.A} B=${tierCounts.B} C=${tierCounts.C} Inactive=${tierCounts.Inactive} (${disqualified} disqualified)`);

    return NextResponse.json({ success: true, steps: log, tierCounts });
  } catch (error) {
    console.error("setup-acquisition error:", error);
    return NextResponse.json(
      { error: "Failed", steps: log, detail: String(error) },
      { status: 500 }
    );
  }
}
