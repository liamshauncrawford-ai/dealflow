import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  scoreAcquisitionTarget,
  loadScoringConfig,
  type AcquisitionScoreInput,
} from "@/lib/scoring/acquisition-scorer";

/**
 * POST /api/listings/rescore-all
 * Recompute acquisition scores for all active listings.
 */
export async function POST() {
  try {
    const config = await loadScoringConfig();

    const listings = await prisma.listing.findMany({
      where: { isActive: true },
    });

    let scored = 0;
    let disqualified = 0;
    const tierCounts: Record<string, number> = { A: 0, B: 0, C: 0, Inactive: 0 };

    for (const listing of listings) {
      const input: AcquisitionScoreInput = {
        targetRank: listing.targetRank,
        ebitda: Number(listing.ebitda) || Number(listing.inferredEbitda) || null,
        revenue: Number(listing.revenue) || null,
        askingPrice: Number(listing.askingPrice) || null,
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

      scored++;
      if (result.disqualifiers.length > 0) disqualified++;
      tierCounts[result.tier] = (tierCounts[result.tier] ?? 0) + 1;
    }

    return NextResponse.json({ scored, disqualified, tierCounts });
  } catch (error) {
    console.error("Error rescoring all listings:", error);
    return NextResponse.json(
      { error: "Failed to rescore listings" },
      { status: 500 }
    );
  }
}
