import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { haversineDistance, proximityScore, estimateCablingValueFromMW } from "@/lib/market-intel/proximity";

/**
 * GET /api/market-intel/proximity?facilityId=xxx&radiusMiles=25
 * Returns facility info + nearby listings within radius, sorted by composite score.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facilityId");
    const radiusMiles = Number(searchParams.get("radiusMiles") ?? 25);

    if (!facilityId) {
      return NextResponse.json({ error: "facilityId is required" }, { status: 400 });
    }

    // Get facility
    const facility = await prisma.dCFacility.findUnique({
      where: { id: facilityId },
      include: {
        operator: { select: { name: true, tier: true } },
      },
    });

    if (!facility || !facility.latitude || !facility.longitude) {
      return NextResponse.json({ error: "Facility not found or missing coordinates" }, { status: 404 });
    }

    // Get all active listings with coordinates
    const listings = await prisma.listing.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        title: true,
        businessName: true,
        latitude: true,
        longitude: true,
        compositeScore: true,
        primaryTrade: true,
        askingPrice: true,
        city: true,
        state: true,
        industry: true,
      },
    });

    // Filter by radius and enrich with distance/proximity
    const nearbyListings = listings
      .map((l) => {
        const distance = haversineDistance(
          facility.latitude!,
          facility.longitude!,
          l.latitude!,
          l.longitude!
        );
        const proxScore = proximityScore(distance);
        return {
          id: l.id,
          title: l.title,
          businessName: l.businessName,
          latitude: l.latitude!,
          longitude: l.longitude!,
          compositeScore: l.compositeScore,
          primaryTrade: l.primaryTrade,
          askingPrice: l.askingPrice ? Number(l.askingPrice) : null,
          city: l.city,
          state: l.state,
          industry: l.industry,
          distanceMi: Math.round(distance * 10) / 10,
          proximityScore: proxScore,
        };
      })
      .filter((l) => l.distanceMi <= radiusMiles)
      .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
      .slice(0, 20);

    const estimatedCabling = facility.capacityMW
      ? estimateCablingValueFromMW(facility.capacityMW)
      : null;

    return NextResponse.json({
      facility: {
        id: facility.id,
        facilityName: facility.facilityName,
        latitude: facility.latitude,
        longitude: facility.longitude,
        capacityMW: facility.capacityMW,
        status: facility.status,
        operatorName: facility.operator?.name ?? null,
        operatorTier: facility.operator?.tier ?? null,
        estimatedCablingValue: estimatedCabling,
      },
      radiusMiles,
      nearbyListings,
      count: nearbyListings.length,
    });
  } catch (error) {
    console.error("Proximity query error:", error);
    return NextResponse.json({ error: "Failed to query proximity" }, { status: 500 });
  }
}
