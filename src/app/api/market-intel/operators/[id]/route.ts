import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { updateOperatorSchema } from "@/lib/validations/market-intel";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const operator = await prisma.dataCenterOperator.findUnique({
      where: { id },
      include: {
        facilities: {
          include: {
            generalContractor: { select: { id: true, name: true } },
            cablingOpportunities: { orderBy: { updatedAt: "desc" } },
          },
          orderBy: { facilityName: "asc" },
        },
        cablingOpportunities: {
          include: {
            facility: { select: { id: true, facilityName: true } },
            gc: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!operator) {
      return NextResponse.json({ error: "Operator not found" }, { status: 404 });
    }

    return NextResponse.json(operator);
  } catch (error) {
    console.error("Error fetching operator:", error);
    return NextResponse.json({ error: "Failed to fetch operator" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(updateOperatorSchema, request);
    if (parsed.error) return parsed.error;

    const operator = await prisma.dataCenterOperator.update({
      where: { id },
      data: parsed.data,
      include: {
        facilities: true,
        _count: { select: { facilities: true, cablingOpportunities: true } },
      },
    });

    return NextResponse.json(operator);
  } catch (error) {
    console.error("Error updating operator:", error);
    return NextResponse.json({ error: "Failed to update operator" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.dataCenterOperator.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting operator:", error);
    return NextResponse.json({ error: "Failed to delete operator" }, { status: 500 });
  }
}
