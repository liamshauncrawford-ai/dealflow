import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeFitScore, type FitScoreInput } from "@/lib/scoring";

/**
 * POST /api/listings/[id]/score
 * Manually recompute fit score for a listing
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

    const scoreInput: FitScoreInput = {
      primaryTrade: listing.primaryTrade,
      secondaryTrades: listing.secondaryTrades as string[],
      revenue: listing.revenue ? Number(listing.revenue) : null,
      established: listing.established,
      state: listing.state,
      metroArea: listing.metroArea,
      certifications: listing.certifications as string[],
      dcCertifications: listing.dcCertifications as string[],
      dcRelevanceScore: listing.dcRelevanceScore,
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

    await prisma.listing.update({
      where: { id },
      data: {
        fitScore: result.fitScore,
        compositeScore: result.fitScore, // AI score applied when available
        deterministicScore: result.fitScore,
        thesisAlignment,
        recommendedAction,
        lastScoredAt: new Date(),
        scoreChange,
      },
    });

    return NextResponse.json({
      fitScore: result.fitScore,
      compositeScore: result.fitScore,
      thesisAlignment,
      recommendedAction,
      scoreChange,
      breakdown: result.breakdown,
    });
  } catch (error) {
    console.error("Error computing fit score:", error);
    return NextResponse.json(
      { error: "Failed to compute fit score" },
      { status: 500 }
    );
  }
}
