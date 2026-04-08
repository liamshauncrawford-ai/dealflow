import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCronOrAuth } from "@/lib/auth-helpers";
import {
  scoreAcquisitionTarget,
  loadScoringConfig,
  type AcquisitionScoreInput,
} from "@/lib/scoring/acquisition-scorer";
import type { Decimal } from "@prisma/client/runtime/library";

/** Safely convert Prisma Decimal to number, preserving zero and null. */
function toNum(val: Decimal | null): number | null {
  return val !== null ? Number(val) : null;
}

/**
 * POST /api/listings/rescore-all
 * Recompute acquisition scores for all active listings.
 * Auth: CRON_SECRET or authenticated user session.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireCronOrAuth(request);
  if (!authResult.authorized) return authResult.error;

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
        ebitda: toNum(listing.ebitda) ?? toNum(listing.inferredEbitda),
        revenue: toNum(listing.revenue),
        askingPrice: toNum(listing.askingPrice),
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
