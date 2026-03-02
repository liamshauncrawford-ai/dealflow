import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/market-intel/map
 * Returns geo-located listings and pipeline opportunities for the Market Map.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const showListings = params.get("showListings") !== "false";
    const showPipeline = params.get("showPipeline") !== "false";

    const listings: Array<{
      id: string;
      title: string;
      latitude: number;
      longitude: number;
      askingPrice: number | null;
      city: string | null;
      state: string | null;
      industry: string | null;
      primaryTrade: string | null;
      tier: string | null;
    }> = [];

    if (showListings) {
      const rawListings = await prisma.listing.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
          isHidden: false,
        },
        select: {
          id: true,
          title: true,
          latitude: true,
          longitude: true,
          askingPrice: true,
          city: true,
          state: true,
          industry: true,
          primaryTrade: true,
          tier: true,
        },
        take: 500,
      });

      for (const l of rawListings) {
        if (l.latitude == null || l.longitude == null) continue;
        listings.push({
          id: l.id,
          title: l.title,
          latitude: l.latitude,
          longitude: l.longitude,
          askingPrice: l.askingPrice ? Number(l.askingPrice) : null,
          city: l.city,
          state: l.state,
          industry: l.industry,
          primaryTrade: l.primaryTrade,
          tier: l.tier,
        });
      }
    }

    // Fetch pipeline opportunities with geo-located listings
    let pipelineDeals: Array<{
      id: string;
      title: string;
      stage: string;
      dealValue: number | null;
      latitude: number;
      longitude: number;
      city: string | null;
      state: string | null;
      primaryTrade: string | null;
      revenue: number | null;
    }> = [];

    if (showPipeline) {
      const rawDeals = await prisma.opportunity.findMany({
        where: {
          stage: { notIn: ["CLOSED_LOST", "CLOSED_WON"] },
          listing: {
            latitude: { not: null },
            longitude: { not: null },
          },
        },
        select: {
          id: true,
          title: true,
          stage: true,
          dealValue: true,
          listing: {
            select: {
              latitude: true,
              longitude: true,
              city: true,
              state: true,
              primaryTrade: true,
              revenue: true,
            },
          },
        },
      });

      pipelineDeals = rawDeals
        .filter(
          (d) => d.listing?.latitude != null && d.listing?.longitude != null,
        )
        .map((d) => ({
          id: d.id,
          title: d.title,
          stage: d.stage,
          dealValue: d.dealValue ? Number(d.dealValue) : null,
          latitude: d.listing!.latitude!,
          longitude: d.listing!.longitude!,
          city: d.listing?.city ?? null,
          state: d.listing?.state ?? null,
          primaryTrade: d.listing?.primaryTrade ?? null,
          revenue: d.listing?.revenue ? Number(d.listing.revenue) : null,
        }));
    }

    return NextResponse.json({ listings, pipelineDeals });
  } catch (error) {
    console.error("Error fetching map data:", error);
    return NextResponse.json(
      { error: "Failed to fetch map data" },
      { status: 500 },
    );
  }
}
