import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/market-intel/map
 * Returns geo-located listings for the Market Map.
 * Phase 2 will add project pipeline and client markers.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const showListings = params.get("showListings") !== "false";

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

    return NextResponse.json({ listings });
  } catch (error) {
    console.error("Error fetching map data:", error);
    return NextResponse.json(
      { error: "Failed to fetch map data" },
      { status: 500 },
    );
  }
}
