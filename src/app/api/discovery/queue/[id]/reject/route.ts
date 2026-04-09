import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ─────────────────────────────────────────────
// POST /api/discovery/queue/[id]/reject
// Reject a discovery listing
// ─────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const listing = await prisma.discoveryListing.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!listing) {
      return NextResponse.json({ error: "Discovery listing not found" }, { status: 404 });
    }

    if (listing.status !== "NEW") {
      return NextResponse.json(
        { error: `Cannot reject listing with status ${listing.status}` },
        { status: 400 },
      );
    }

    await prisma.discoveryListing.update({
      where: { id },
      data: { status: "REJECTED", reviewedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Discovery reject error:", error);
    return NextResponse.json(
      { error: "Failed to reject discovery listing" },
      { status: 500 },
    );
  }
}
