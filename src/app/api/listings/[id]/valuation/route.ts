import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeValuation, type ValuationInput } from "@/lib/scoring";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        opportunity: {
          include: {
            contacts: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const opp = listing.opportunity;
    const ebitdaVal = opp?.actualEbitda
      ? Number(opp.actualEbitda)
      : listing.ebitda
        ? Number(listing.ebitda)
        : listing.inferredEbitda
          ? Number(listing.inferredEbitda)
          : null;

    const sdeVal = listing.sde
      ? Number(listing.sde)
      : listing.inferredSde
        ? Number(listing.inferredSde)
        : null;

    const input: ValuationInput = {
      ebitda: ebitdaVal,
      sde: sdeVal,
      baseMultipleLow: listing.targetMultipleLow ?? 3.0,
      baseMultipleHigh: listing.targetMultipleHigh ?? 5.0,
      recurringRevenuePct: opp?.recurringRevenuePct ?? null,
      revenueTrend: opp?.revenueTrend ?? null,
      customerConcentration: opp?.customerConcentration ?? null,
      dcExperience: listing.dcExperience ?? null,
      keyPersonRisk: opp?.keyPersonRisk ?? null,
    };

    const result = computeValuation(input);

    return NextResponse.json({
      input,
      result,
    });
  } catch (error) {
    console.error("Error computing valuation:", error);
    return NextResponse.json(
      { error: "Failed to compute valuation" },
      { status: 500 }
    );
  }
}
