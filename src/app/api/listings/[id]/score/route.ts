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

    await prisma.listing.update({
      where: { id },
      data: { fitScore: result.fitScore },
    });

    return NextResponse.json({
      fitScore: result.fitScore,
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
