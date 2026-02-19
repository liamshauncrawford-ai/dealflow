import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSearchParams } from "@/lib/validations/common";
import { mapQuerySchema } from "@/lib/validations/market-intel";

export async function GET(request: NextRequest) {
  try {
    const parsed = parseSearchParams(
      mapQuerySchema,
      request.nextUrl.searchParams,
    );
    if (parsed.error) return parsed.error;

    const {
      showFacilities,
      showListings,
      operatorTier,
      facilityStatus,
    } = parsed.data;

    const facilities: Array<{
      id: string;
      facilityName: string;
      latitude: number;
      longitude: number;
      capacityMW: number | null;
      status: string | null;
      city: string | null;
      state: string | null;
      address: string | null;
      operatorName: string;
      operatorTier: string | null;
    }> = [];

    const listings: Array<{
      id: string;
      title: string;
      latitude: number;
      longitude: number;
      askingPrice: number | null;
      city: string | null;
      state: string | null;
      industry: string | null;
    }> = [];

    if (showFacilities) {
      const where: Record<string, unknown> = {
        latitude: { not: null },
        longitude: { not: null },
      };

      if (facilityStatus) {
        where.status = facilityStatus;
      }

      if (operatorTier) {
        where.operator = { tier: operatorTier };
      }

      const rawFacilities = await prisma.dCFacility.findMany({
        where,
        select: {
          id: true,
          facilityName: true,
          latitude: true,
          longitude: true,
          capacityMW: true,
          status: true,
          city: true,
          state: true,
          address: true,
          operator: { select: { name: true, tier: true } },
        },
      });

      for (const f of rawFacilities) {
        if (f.latitude == null || f.longitude == null) continue;
        facilities.push({
          id: f.id,
          facilityName: f.facilityName,
          latitude: f.latitude,
          longitude: f.longitude,
          capacityMW: f.capacityMW,
          status: f.status,
          city: f.city,
          state: f.state,
          address: f.address,
          operatorName: f.operator.name,
          operatorTier: f.operator.tier,
        });
      }
    }

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
        },
        take: 200,
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
        });
      }
    }

    return NextResponse.json({ facilities, listings });
  } catch (error) {
    console.error("Error fetching map data:", error);
    return NextResponse.json(
      { error: "Failed to fetch map data" },
      { status: 500 },
    );
  }
}
