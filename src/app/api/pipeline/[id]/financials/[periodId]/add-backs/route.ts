import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { createAddBackSchema, updateAddBackSchema } from "@/lib/validations/financials";
import { recomputePeriodSummary } from "@/lib/financial/recompute-period";
import { syncOpportunitySummary } from "@/lib/financial/sync-opportunity";
import { createAuditLog } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string; periodId: string }> };

async function recomputeAndUpdate(periodId: string) {
  const lineItems = await prisma.financialLineItem.findMany({
    where: { periodId },
  });
  const addBacks = await prisma.addBack.findMany({
    where: { periodId },
  });
  const summary = recomputePeriodSummary(lineItems, addBacks);
  await prisma.financialPeriod.update({
    where: { id: periodId },
    data: summary,
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, periodId } = await params;

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

    const body = await parseBody(createAddBackSchema, request);
    if (body.error) return body.error;

    const addBack = await prisma.addBack.create({
      data: {
        periodId,
        ...body.data,
      },
    });

    await recomputeAndUpdate(periodId);
    try { await syncOpportunitySummary(id); } catch (e) { console.error("Sync failed:", e); }

    await createAuditLog({
      eventType: "CREATED",
      entityType: "FINANCIAL",
      entityId: addBack.id,
      opportunityId: id,
      summary: `Added add-back: ${body.data.category} — $${body.data.amount.toLocaleString()}`,
    });

    return NextResponse.json(addBack, { status: 201 });
  } catch (error) {
    console.error("Failed to create add-back:", error);
    return NextResponse.json(
      { error: "Failed to create add-back" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, periodId } = await params;
    const { searchParams } = new URL(request.url);
    const addBackId = searchParams.get("addBackId");
    if (!addBackId) {
      return NextResponse.json({ error: "addBackId query param required" }, { status: 400 });
    }

    const period = await prisma.financialPeriod.findUnique({
      where: { id: periodId },
      select: { isLocked: true },
    });
    if (period?.isLocked) {
      return NextResponse.json({ error: "Period is locked" }, { status: 403 });
    }

    const body = await parseBody(updateAddBackSchema, request);
    if (body.error) return body.error;

    const updated = await prisma.addBack.update({
      where: { id: addBackId },
      data: body.data,
    });

    await recomputeAndUpdate(periodId);
    try { await syncOpportunitySummary(id); } catch (e) { console.error("Sync failed:", e); }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update add-back:", error);
    return NextResponse.json(
      { error: "Failed to update add-back" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, periodId } = await params;
    const { searchParams } = new URL(request.url);
    const addBackId = searchParams.get("addBackId");
    if (!addBackId) {
      return NextResponse.json({ error: "addBackId query param required" }, { status: 400 });
    }

    const period = await prisma.financialPeriod.findUnique({
      where: { id: periodId },
      select: { isLocked: true },
    });
    if (period?.isLocked) {
      return NextResponse.json({ error: "Period is locked" }, { status: 403 });
    }

    const existing = await prisma.addBack.findUnique({ where: { id: addBackId } });
    await prisma.addBack.delete({ where: { id: addBackId } });
    await recomputeAndUpdate(periodId);
    try { await syncOpportunitySummary(id); } catch (e) { console.error("Sync failed:", e); }

    await createAuditLog({
      eventType: "DELETED",
      entityType: "FINANCIAL",
      entityId: addBackId,
      opportunityId: id,
      summary: `Removed add-back: ${existing?.category} — $${Number(existing?.amount ?? 0).toLocaleString()}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete add-back:", error);
    return NextResponse.json(
      { error: "Failed to delete add-back" },
      { status: 500 }
    );
  }
}
