import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string; sourceId: string }> };

const updateSourceSchema = z.object({
  sourceUrl: z.string().url().max(2000),
});

/**
 * PATCH /api/listings/[id]/sources/[sourceId]
 *
 * Update a ListingSource record (e.g. fix a source URL).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, sourceId } = await params;

    const json = await request.json();
    const parsed = updateSourceSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Verify source belongs to this listing
    const source = await prisma.listingSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }
    if (source.listingId !== id) {
      return NextResponse.json({ error: "Source does not belong to this listing" }, { status: 403 });
    }

    const updated = await prisma.listingSource.update({
      where: { id: sourceId },
      data: { sourceUrl: parsed.data.sourceUrl },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A source with this URL already exists" },
        { status: 409 }
      );
    }
    console.error("Failed to update listing source:", error);
    return NextResponse.json(
      { error: "Failed to update listing source" },
      { status: 500 }
    );
  }
}
