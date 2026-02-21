import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/pipeline/[id]/valuation
 *
 * Fetch all saved valuation scenarios for a pipeline deal.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const scenarios = await prisma.valuationModel.findMany({
      where: { opportunityId: id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ scenarios });
  } catch (error) {
    console.error("Failed to fetch valuation scenarios:", error);
    return NextResponse.json(
      { error: "Failed to fetch valuation scenarios" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipeline/[id]/valuation
 *
 * Create a new valuation scenario for a pipeline deal.
 * Body: { modelName?, inputs, outputs, aiCommentary? }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.inputs || !body.outputs) {
      return NextResponse.json(
        { error: "inputs and outputs are required" },
        { status: 400 }
      );
    }

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { id: true, listingId: true },
    });
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const scenario = await prisma.valuationModel.create({
      data: {
        opportunityId: id,
        listingId: opportunity.listingId ?? undefined,
        modelName: body.modelName ?? "Untitled Scenario",
        inputs: body.inputs,
        outputs: body.outputs,
        aiCommentary: body.aiCommentary ?? undefined,
      },
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    console.error("Failed to create valuation scenario:", error);
    return NextResponse.json(
      { error: "Failed to create valuation scenario" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pipeline/[id]/valuation
 *
 * Update an existing valuation scenario.
 * Body: { scenarioId, modelName?, inputs?, outputs?, aiCommentary? }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.scenarioId) {
      return NextResponse.json(
        { error: "scenarioId is required" },
        { status: 400 }
      );
    }

    // Verify scenario belongs to this opportunity
    const existing = await prisma.valuationModel.findFirst({
      where: { id: body.scenarioId, opportunityId: id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Scenario not found for this opportunity" },
        { status: 404 }
      );
    }

    // Build update payload — only include fields that were provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    if (body.modelName !== undefined) updateData.modelName = body.modelName;
    if (body.inputs !== undefined) updateData.inputs = body.inputs;
    if (body.outputs !== undefined) updateData.outputs = body.outputs;
    if (body.aiCommentary !== undefined) updateData.aiCommentary = body.aiCommentary;

    const updated = await prisma.valuationModel.update({
      where: { id: body.scenarioId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update valuation scenario:", error);
    return NextResponse.json(
      { error: "Failed to update valuation scenario" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pipeline/[id]/valuation?scenarioId=xxx
 *
 * Delete a specific valuation scenario.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get("scenarioId");

    if (!scenarioId) {
      return NextResponse.json(
        { error: "scenarioId query parameter is required" },
        { status: 400 }
      );
    }

    // Verify scenario belongs to this opportunity
    const existing = await prisma.valuationModel.findFirst({
      where: { id: scenarioId, opportunityId: id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Scenario not found for this opportunity" },
        { status: 404 }
      );
    }

    await prisma.valuationModel.delete({ where: { id: scenarioId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete valuation scenario:", error);
    return NextResponse.json(
      { error: "Failed to delete valuation scenario" },
      { status: 500 }
    );
  }
}
