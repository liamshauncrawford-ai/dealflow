import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { updateGCSchema } from "@/lib/validations/market-intel";

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

    const gc = await prisma.generalContractor.update({
      where: { id },
      data: parsed.data,
      include: {
        _count: { select: { facilities: true, cablingOpportunities: true } },
      },
    });

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
