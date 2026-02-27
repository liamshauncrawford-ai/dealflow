import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/settings/thesis/platform-options
 *
 * Returns pipeline opportunities as platform company options.
 * Only active pipeline deals — not scraped leads or hidden/lost deals.
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
        listingId: true,
        actualRevenue: true,
        actualEbitda: true,
        listing: {
          select: {
            id: true,
            tier: true,
          },
        },
      },
    });

    const options = opportunities.map((opp) => ({
      opportunityId: opp.id,
      listingId: opp.listingId,
      title: opp.title,
      tier: opp.listing?.tier ?? null,
      revenue: opp.actualRevenue ? Number(opp.actualRevenue) : null,
      ebitda: opp.actualEbitda ? Number(opp.actualEbitda) : null,
    }));

    return NextResponse.json({ options });
  } catch (error) {
    console.error("Failed to fetch platform options:", error);
    return NextResponse.json(
      { error: "Failed to fetch platform options" },
      { status: 500 },
    );
  }
}
