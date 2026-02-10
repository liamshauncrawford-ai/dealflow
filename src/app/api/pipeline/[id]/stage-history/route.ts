import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PipelineStage } from "@prisma/client";
import { parseBody } from "@/lib/validations/common";
import { createStageHistorySchema, updateStageHistorySchema } from "@/lib/validations/pipeline";

/**
 * POST /api/pipeline/[id]/stage-history
 * Create a manual stage history entry.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(createStageHistorySchema, request);
    if (parsed.error) return parsed.error;
    const { fromStage, toStage, note, createdAt } = parsed.data;

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    const stageChange = await prisma.stageChange.create({
      data: {
        opportunityId: id,
        fromStage: fromStage as PipelineStage,
        toStage: toStage as PipelineStage,
        note: note || null,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
      },
    });

    return NextResponse.json(stageChange, { status: 201 });
  } catch (error) {
    console.error("Error creating stage history entry:", error);
    return NextResponse.json(
      { error: "Failed to create stage history entry" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pipeline/[id]/stage-history?entryId=XXX
 * Update a stage history entry's note or date.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entryId");

    if (!entryId) {
      return NextResponse.json(
        { error: "entryId query parameter is required" },
        { status: 400 }
      );
    }

    const parsed = await parseBody(updateStageHistorySchema, request);
    if (parsed.error) return parsed.error;

    // Verify entry belongs to this opportunity
    const existing = await prisma.stageChange.findFirst({
      where: { id: entryId, opportunityId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Stage history entry not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.note !== undefined) updateData.note = parsed.data.note || null;
    if (parsed.data.createdAt) updateData.createdAt = new Date(parsed.data.createdAt);

    const updated = await prisma.stageChange.update({
      where: { id: entryId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating stage history entry:", error);
    return NextResponse.json(
      { error: "Failed to update stage history entry" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pipeline/[id]/stage-history?entryId=XXX
 * Remove a stage history entry.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entryId");

    if (!entryId) {
      return NextResponse.json(
        { error: "entryId query parameter is required" },
        { status: 400 }
      );
    }

    // Verify entry belongs to this opportunity
    const existing = await prisma.stageChange.findFirst({
      where: { id: entryId, opportunityId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Stage history entry not found" },
        { status: 404 }
      );
    }

    await prisma.stageChange.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting stage history entry:", error);
    return NextResponse.json(
      { error: "Failed to delete stage history entry" },
      { status: 500 }
    );
  }
}
