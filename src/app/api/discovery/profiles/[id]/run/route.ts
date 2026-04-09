import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSearchProfile } from "@/lib/discovery/runner";

// ─────────────────────────────────────────────
// POST /api/discovery/profiles/[id]/run
// Trigger an on-demand discovery run for a profile
// ─────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const profile = await prisma.searchProfile.findUnique({ where: { id } });

    if (!profile) {
      return NextResponse.json(
        { error: "Search profile not found" },
        { status: 404 }
      );
    }

    const result = await runSearchProfile(profile);

    return NextResponse.json({
      success: true,
      newDiscoveries: result.newDiscoveries,
      skippedDuplicates: result.skippedDuplicates,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Failed to run search profile:", error);
    return NextResponse.json(
      { error: "Failed to run search profile" },
      { status: 500 }
    );
  }
}
