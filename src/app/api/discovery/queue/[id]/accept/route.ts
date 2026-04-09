import { NextRequest, NextResponse } from "next/server";
import { acceptDiscoveryListing } from "@/lib/discovery/accept";

// ─────────────────────────────────────────────
// POST /api/discovery/queue/[id]/accept
// Accept a discovery listing — enrich + import into main pipeline
// ─────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await acceptDiscoveryListing(id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Discovery accept error:", error);
    return NextResponse.json(
      { error: "Failed to accept discovery listing" },
      { status: 500 },
    );
  }
}
