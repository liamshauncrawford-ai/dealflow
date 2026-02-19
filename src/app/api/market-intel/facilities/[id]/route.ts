import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { updateFacilitySchema } from "@/lib/validations/market-intel";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const facility = await prisma.dCFacility.findUnique({
      where: { id },
      include: {
        operator: { select: { id: true, name: true, tier: true } },
        generalContractor: { select: { id: true, name: true } },
        cablingOpportunities: {
          include: {
            operator: { select: { id: true, name: true } },
            gc: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    return NextResponse.json(facility);
  } catch (error) {
    console.error("Error fetching facility:", error);
    return NextResponse.json({ error: "Failed to fetch facility" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(updateFacilitySchema, request);
    if (parsed.error) return parsed.error;

    const facility = await prisma.dCFacility.update({
      where: { id },
      data: parsed.data,
      include: {
        operator: { select: { id: true, name: true } },
        generalContractor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(facility);
  } catch (error) {
    console.error("Error updating facility:", error);
    return NextResponse.json({ error: "Failed to update facility" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.dCFacility.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting facility:", error);
    return NextResponse.json({ error: "Failed to delete facility" }, { status: 500 });
  }
}
