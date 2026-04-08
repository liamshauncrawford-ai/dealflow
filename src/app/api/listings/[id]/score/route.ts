import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeFitScore, type FitScoreInput } from "@/lib/scoring";
import {
  scoreAcquisitionTarget,
  loadScoringConfig,
  type AcquisitionScoreInput,
} from "@/lib/scoring/acquisition-scorer";

/**
 * POST /api/listings/[id]/score
 * Manually recompute fit score AND acquisition score for a listing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        opportunity: {
          include: {
            contacts: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const primaryContact = listing.opportunity?.contacts?.[0] ?? null;

    // ── Legacy fit score (backward compat) ──
    const scoreInput: FitScoreInput = {
      primaryTrade: listing.primaryTrade,
      secondaryTrades: listing.secondaryTrades as string[],
      revenue: listing.revenue ? Number(listing.revenue) : null,
      established: listing.established,
      state: listing.state,
      metroArea: listing.metroArea,
      certifications: listing.certifications as string[],
      askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
      ebitda: listing.ebitda ? Number(listing.ebitda) : null,
      inferredEbitda: listing.inferredEbitda ? Number(listing.inferredEbitda) : null,
      targetMultipleLow: listing.targetMultipleLow,
      targetMultipleHigh: listing.targetMultipleHigh,
      estimatedAgeRange: primaryContact?.estimatedAgeRange ?? null,
      keyPersonRisk: listing.opportunity?.keyPersonRisk ?? null,
      recurringRevenuePct: listing.opportunity?.recurringRevenuePct ?? null,
    };

    const result = computeFitScore(scoreInput);

    // Calculate score change delta
    const previousScore = listing.compositeScore ?? listing.fitScore;
    const scoreChange = previousScore != null ? result.fitScore - previousScore : 0;

    // Determine thesis alignment from score
    let thesisAlignment: string;
    let recommendedAction: string;
    if (result.fitScore >= 75) {
      thesisAlignment = "strong";
      recommendedAction = "pursue_immediately";
    } else if (result.fitScore >= 60) {
      thesisAlignment = "moderate";
      recommendedAction = "research_further";
    } else if (result.fitScore >= 40) {
      thesisAlignment = "weak";
      recommendedAction = "monitor";
    } else {
      thesisAlignment = "disqualified";
      recommendedAction = "pass";
    }

    // ── New acquisition score ──
    const config = await loadScoringConfig();

    // Safe Decimal→number conversion (preserves zero, converts null to null)
    const toNum = (val: unknown): number | null => val !== null && val !== undefined ? Number(val) : null;

    const acqInput: AcquisitionScoreInput = {
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

    const acqResult = scoreAcquisitionTarget(acqInput, config);

    // ── Persist both scores ──
    await prisma.listing.update({
      where: { id },
      data: {
        // Legacy fit score fields
        fitScore: result.fitScore,
        compositeScore: result.fitScore,
        deterministicScore: result.fitScore,
        thesisAlignment,
        recommendedAction,
        lastScoredAt: new Date(),
        scoreChange,
        // New acquisition score fields
        acquisitionScore: acqResult.total,
        financialScore: acqResult.financialScore,
        strategicScore: acqResult.strategicScore,
        operatorScore: acqResult.operatorScore,
        acquisitionTier: acqResult.tier,
        acquisitionDisqualifiers: acqResult.disqualifiers,
      },
    });

    return NextResponse.json({
      // Legacy
      fitScore: result.fitScore,
      compositeScore: result.fitScore,
      thesisAlignment,
      recommendedAction,
      scoreChange,
      breakdown: result.breakdown,
      // Acquisition
      acquisitionScore: acqResult.total,
      financialScore: acqResult.financialScore,
      strategicScore: acqResult.strategicScore,
      operatorScore: acqResult.operatorScore,
      acquisitionTier: acqResult.tier,
      acquisitionDisqualifiers: acqResult.disqualifiers,
      financialDetails: acqResult.financialDetails,
      strategicDetails: acqResult.strategicDetails,
      operatorDetails: acqResult.operatorDetails,
    });
  } catch (error) {
    console.error("Error computing scores:", error);
    return NextResponse.json(
      { error: "Failed to compute scores" },
      { status: 500 }
    );
  }
}
