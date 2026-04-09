import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DiscoveryStatus, Platform } from "@prisma/client";

// ─────────────────────────────────────────────
// GET /api/discovery/queue
// Paginated list of DiscoveryListings with filters
// ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const status = (searchParams.get("status") as DiscoveryStatus) || "NEW";
    const profileId = searchParams.get("profileId");
    const platform = searchParams.get("platform") as Platform | null;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10)));

    // Build where clause
    const where: Record<string, unknown> = { status };
    if (profileId) where.searchProfileId = profileId;
    if (platform) where.platform = platform;

    const [items, total] = await Promise.all([
      prisma.discoveryListing.findMany({
        where,
        include: {
          searchProfile: { select: { name: true } },
        },
        orderBy: { discoveredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.discoveryListing.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Discovery queue GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch discovery queue" },
      { status: 500 },
    );
  }
}
