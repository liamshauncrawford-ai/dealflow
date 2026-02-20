import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { updateGCSchema } from "@/lib/validations/market-intel";
import {
  recalculatePipelineForGC,
  boostTargetsWithGCRelationship,
} from "@/lib/market-intel/gc-relationship-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const gc = await prisma.generalContractor.findUnique({
      where: { id },
      include: {
        facilities: {
          include: {
            operator: { select: { id: true, name: true, tier: true } },
          },
          orderBy: { facilityName: "asc" },
        },
        cablingOpportunities: {
          include: {
            operator: { select: { id: true, name: true } },
            facility: { select: { id: true, facilityName: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!gc) {
      return NextResponse.json({ error: "General contractor not found" }, { status: 404 });
    }

    return NextResponse.json(gc);
  } catch (error) {
    console.error("Error fetching GC:", error);
    return NextResponse.json({ error: "Failed to fetch GC" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(updateGCSchema, request);
    if (parsed.error) return parsed.error;

    // Check if relationship status is changing (for trigger)
    let previousStatus: string | null = null;
    if (parsed.data.relationshipStatus) {
      const prev = await prisma.generalContractor.findUnique({
        where: { id },
        select: { relationshipStatus: true },
      });
      previousStatus = prev?.relationshipStatus ?? null;
    }

    const gc = await prisma.generalContractor.update({
      where: { id },
      data: parsed.data,
      include: {
        _count: { select: { facilities: true, cablingOpportunities: true } },
      },
    });

    // Trigger pipeline recalculation if relationship status changed
    if (
      parsed.data.relationshipStatus &&
      previousStatus !== parsed.data.relationshipStatus
    ) {
      // Fire-and-forget — don't block the response
      Promise.all([
        recalculatePipelineForGC(id),
        boostTargetsWithGCRelationship(id),
      ]).catch((err) => console.error("GC relationship trigger error:", err));
    }

    return NextResponse.json(gc);
  } catch (error) {
    console.error("Error updating GC:", error);
    return NextResponse.json({ error: "Failed to update GC" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.generalContractor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting GC:", error);
    return NextResponse.json({ error: "Failed to delete GC" }, { status: 500 });
  }
}
