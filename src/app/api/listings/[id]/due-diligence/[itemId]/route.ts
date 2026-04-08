import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { isCompleted, notes } = body;

    const updateData: Record<string, unknown> = {};

    if (typeof isCompleted === "boolean") {
      updateData.isCompleted = isCompleted;
      updateData.completedAt = isCompleted ? new Date() : null;
    }

    if (typeof notes === "string") {
      updateData.notes = notes;
    }

    const item = await prisma.dueDiligenceItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating due diligence item:", error);
    return NextResponse.json(
      { error: "Failed to update due diligence item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;

    const item = await prisma.dueDiligenceItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (!item.isCustom) {
      return NextResponse.json(
        { error: "Cannot delete default checklist items" },
        { status: 403 }
      );
    }

    await prisma.dueDiligenceItem.delete({ where: { id: itemId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting due diligence item:", error);
    return NextResponse.json(
      { error: "Failed to delete due diligence item" },
      { status: 500 }
    );
  }
}
