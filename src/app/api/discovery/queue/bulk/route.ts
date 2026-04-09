import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { acceptDiscoveryListing, type AcceptResult } from "@/lib/discovery/accept";

// ─────────────────────────────────────────────
// POST /api/discovery/queue/bulk
// Bulk accept or reject discovery listings
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, action } = body as { ids?: string[]; action?: string };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array" },
        { status: 400 },
      );
    }

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { error: 'action must be "accept" or "reject"' },
        { status: 400 },
      );
    }

    if (action === "reject") {
      // Efficient bulk reject via updateMany
      const result = await prisma.discoveryListing.updateMany({
        where: {
          id: { in: ids },
          status: "NEW",
        },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        action: "reject",
        processed: result.count,
        total: ids.length,
      });
    }

    // Accept: must process individually for enrichment
    const results: Array<{
      id: string;
      success: boolean;
      listingId?: string;
      enriched?: boolean;
      error?: string;
    }> = [];

    for (const id of ids) {
      const result = await acceptDiscoveryListing(id);

      if ("error" in result) {
        results.push({ id, success: false, error: result.error });
      } else {
        results.push({
          id,
          success: true,
          listingId: result.listingId,
          enriched: result.enriched,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      action: "accept",
      processed: successCount,
      total: ids.length,
      results,
    });
  } catch (error) {
    console.error("Discovery bulk action error:", error);
    return NextResponse.json(
      { error: "Failed to process bulk action" },
      { status: 500 },
    );
  }
}
