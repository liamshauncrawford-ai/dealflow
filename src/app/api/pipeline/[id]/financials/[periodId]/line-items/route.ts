import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import {
  createLineItemSchema,
  batchCreateLineItemsSchema,
  updateLineItemSchema,
} from "@/lib/validations/financials";
import { recomputeAndUpdate } from "@/lib/financial/recompute-and-update";
import { syncOpportunitySummary } from "@/lib/financial/sync-opportunity";
import { createAuditLog } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string; periodId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, periodId } = await params;

    // Check if period is locked
    const period = await prisma.financialPeriod.findUnique({
      where: { id: periodId },
      select: { isLocked: true },
    });
    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }
    if (period.isLocked) {
      return NextResponse.json({ error: "Period is locked" }, { status: 403 });
    }

    const json = await request.json();

    // Support both single item and batch
    if (Array.isArray(json.items)) {
      const body = batchCreateLineItemsSchema.safeParse(json);
      if (!body.success) {
        return NextResponse.json(
          { error: body.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      await prisma.financialLineItem.createMany({
        data: body.data.items.map((item, idx) => ({
          periodId,
          category: item.category,
          subcategory: item.subcategory ?? null,
          rawLabel: item.rawLabel,
          displayOrder: item.displayOrder ?? idx,
          amount: item.amount,
          isNegative: item.isNegative ?? false,
          notes: item.notes ?? null,
        })),
      });

      await recomputeAndUpdate(periodId);
      try { await syncOpportunitySummary(id); } catch (e) { console.error("Sync failed:", e); }

      await createAuditLog({
        eventType: "CREATED",
        entityType: "FINANCIAL",
        entityId: periodId,
        opportunityId: id,
        summary: `Added ${body.data.items.length} line items to financial period`,
      });

      const items = await prisma.financialLineItem.findMany({
        where: { periodId },
        orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
      });

      return NextResponse.json(items, { status: 201 });
    }

    // Single item
    const body = createLineItemSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const item = await prisma.financialLineItem.create({
      data: {
        periodId,
        category: body.data.category,
        subcategory: body.data.subcategory ?? null,
        rawLabel: body.data.rawLabel,
        displayOrder: body.data.displayOrder ?? 0,
        amount: body.data.amount,
        isNegative: body.data.isNegative ?? false,
        notes: body.data.notes ?? null,
      },
    });

    await recomputeAndUpdate(periodId);
    try { await syncOpportunitySummary(id); } catch (e) { console.error("Sync failed:", e); }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create line item:", error);
    return NextResponse.json(
      { error: "Failed to create line item" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, periodId } = await params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json({ error: "itemId query param required" }, { status: 400 });
    }

    const period = await prisma.financialPeriod.findUnique({
      where: { id: periodId },
      select: { isLocked: true },
    });
    if (period?.isLocked) {
      return NextResponse.json({ error: "Period is locked" }, { status: 403 });
    }

    const body = await parseBody(updateLineItemSchema, request);
    if (body.error) return body.error;

    const updated = await prisma.financialLineItem.update({
      where: { id: itemId },
      data: body.data,
    });

    await recomputeAndUpdate(periodId);
    try { await syncOpportunitySummary(id); } catch (e) { console.error("Sync failed:", e); }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update line item:", error);
    return NextResponse.json(
      { error: "Failed to update line item" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, periodId } = await params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json({ error: "itemId query param required" }, { status: 400 });
    }

    const period = await prisma.financialPeriod.findUnique({
      where: { id: periodId },
      select: { isLocked: true },
    });
    if (period?.isLocked) {
      return NextResponse.json({ error: "Period is locked" }, { status: 403 });
    }

    await prisma.financialLineItem.delete({ where: { id: itemId } });
    await recomputeAndUpdate(periodId);
    try { await syncOpportunitySummary(id); } catch (e) { console.error("Sync failed:", e); }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete line item:", error);
    return NextResponse.json(
      { error: "Failed to delete line item" },
      { status: 500 }
    );
  }
}
