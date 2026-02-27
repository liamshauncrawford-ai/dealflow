import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/pipeline/active-companies
 *
 * Returns all active pipeline opportunities (excluding CLOSED_LOST / CLOSED_WON)
 * with financial data for use in the Roll-Up Model, Valuation, and other
 * financial analysis tools.
 *
 * Includes linked Listing data as fallback for financial fields — many
 * pipeline deals were originally sourced from listings that carry SDE,
 * inferred EBITDA, asking price, etc.
 */
export async function GET() {
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: {
        stage: { notIn: ["CLOSED_LOST", "CLOSED_WON"] },
      },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        stage: true,
        actualRevenue: true,
        actualEbitda: true,
        offerPrice: true,
        listing: {
          select: {
            id: true,
            businessName: true,
            revenue: true,
            ebitda: true,
            sde: true,
            cashFlow: true,
            askingPrice: true,
            inferredEbitda: true,
            inferredSde: true,
            compositeScore: true,
            city: true,
            state: true,
          },
        },
      },
    });

    const companies = opportunities.map((opp) => ({
      opportunityId: opp.id,
      title: opp.title,
      stage: opp.stage,
      // Opportunity-level financials (may be null)
      actualRevenue: opp.actualRevenue ? Number(opp.actualRevenue) : null,
      actualEbitda: opp.actualEbitda ? Number(opp.actualEbitda) : null,
      offerPrice: opp.offerPrice ? Number(opp.offerPrice) : null,
      // Linked listing fallback data
      listing: opp.listing
        ? {
            id: opp.listing.id,
            businessName: opp.listing.businessName,
            revenue: opp.listing.revenue ? Number(opp.listing.revenue) : null,
            ebitda: opp.listing.ebitda ? Number(opp.listing.ebitda) : null,
            sde: opp.listing.sde ? Number(opp.listing.sde) : null,
            cashFlow: opp.listing.cashFlow
              ? Number(opp.listing.cashFlow)
              : null,
            askingPrice: opp.listing.askingPrice
              ? Number(opp.listing.askingPrice)
              : null,
            inferredEbitda: opp.listing.inferredEbitda
              ? Number(opp.listing.inferredEbitda)
              : null,
            inferredSde: opp.listing.inferredSde
              ? Number(opp.listing.inferredSde)
              : null,
            compositeScore: opp.listing.compositeScore,
            city: opp.listing.city,
            state: opp.listing.state,
          }
        : null,
    }));

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("Failed to fetch active pipeline companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch active pipeline companies" },
      { status: 500 },
    );
  }
}
