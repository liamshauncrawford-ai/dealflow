import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/settings/acquisition-thesis
 * Returns all AcquisitionThesisConfig records ordered by targetRank ascending.
 */
export async function GET() {
  try {
    const configs = await prisma.acquisitionThesisConfig.findMany({
      orderBy: { targetRank: "asc" },
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching acquisition thesis configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch acquisition thesis configs" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/acquisition-thesis
 * Updates an AcquisitionThesisConfig record by targetRank.
 * Body must include `targetRank` (number). Remaining fields are applied as updates.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const { targetRank, ...updates } = body;

    if (typeof targetRank !== "number") {
      return NextResponse.json(
        { error: "targetRank (number) is required in the request body" },
        { status: 400 }
      );
    }

    const updated = await prisma.acquisitionThesisConfig.update({
      where: { targetRank },
      data: updates,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating acquisition thesis config:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update acquisition thesis config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
