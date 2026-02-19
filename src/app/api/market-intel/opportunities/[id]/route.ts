import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { parseBody } from "@/lib/validations/common";
import { updateCablingSchema } from "@/lib/validations/market-intel";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const opportunity = await prisma.cablingOpportunity.findUnique({
      where: { id },
      include: {
        operator: { select: { id: true, name: true, tier: true } },
        gc: { select: { id: true, name: true, priority: true } },
        facility: {
          select: {
            id: true,
            facilityName: true,
            capacityMW: true,
            sqft: true,
            status: true,
            address: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Cabling opportunity not found" }, { status: 404 });
    }

    return NextResponse.json(opportunity);
  } catch (error) {
    console.error("Error fetching cabling opportunity:", error);
    return NextResponse.json({ error: "Failed to fetch cabling opportunity" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(updateCablingSchema, request);
    if (parsed.error) return parsed.error;

    // Convert date strings to Date objects
    const dateFields = ["rfqDate", "bidDueDate", "constructionStart", "constructionEnd"];
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        if (dateFields.includes(key) && typeof value === "string") {
          updateData[key] = new Date(value);
        } else {
          updateData[key] = value;
        }
      }
    }

    const opportunity = await prisma.cablingOpportunity.update({
      where: { id },
      data: updateData,
      include: {
        operator: { select: { id: true, name: true, tier: true } },
        gc: { select: { id: true, name: true } },
        facility: { select: { id: true, facilityName: true, capacityMW: true } },
      },
    });

    return NextResponse.json(opportunity);
  } catch (error) {
    console.error("Error updating cabling opportunity:", error);
    return NextResponse.json({ error: "Failed to update cabling opportunity" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.cablingOpportunity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting cabling opportunity:", error);
    return NextResponse.json({ error: "Failed to delete cabling opportunity" }, { status: 500 });
  }
}
