import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { updateFinancialPeriodSchema } from "@/lib/validations/financials";
import { createAuditLog } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string; periodId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { periodId } = await params;

    const period = await prisma.financialPeriod.findUnique({
      where: { id: periodId },
      include: {
        lineItems: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
        addBacks: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
      },
    });

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    return NextResponse.json(period);
  } catch (error) {
    console.error("Failed to fetch financial period:", error);
    return NextResponse.json(
      { error: "Failed to fetch financial period" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, periodId } = await params;
    const body = await parseBody(updateFinancialPeriodSchema, request);
    if (body.error) return body.error;

    const existing = await prisma.financialPeriod.findUnique({
      where: { id: periodId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }
    if (existing.isLocked && !body.data.isLocked) {
      // Only allow unlocking, not other changes when locked
    } else if (existing.isLocked) {
      return NextResponse.json(
        { error: "Period is locked. Unlock it before making changes." },
        { status: 403 }
      );
    }

    const updated = await prisma.financialPeriod.update({
      where: { id: periodId },
      data: body.data,
      include: {
        lineItems: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
        addBacks: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
      },
    });

    await createAuditLog({
      eventType: "UPDATED",
      entityType: "FINANCIAL",
      entityId: periodId,
      opportunityId: id,
      summary: `Updated financial period: ${updated.periodType} ${updated.year}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update financial period:", error);
    return NextResponse.json(
      { error: "Failed to update financial period" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, periodId } = await params;

    const existing = await prisma.financialPeriod.findUnique({
      where: { id: periodId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    await prisma.financialPeriod.delete({ where: { id: periodId } });

    await createAuditLog({
      eventType: "DELETED",
      entityType: "FINANCIAL",
      entityId: periodId,
      opportunityId: id,
      summary: `Deleted financial period: ${existing.periodType} ${existing.year}${existing.quarter ? ` Q${existing.quarter}` : ""}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete financial period:", error);
    return NextResponse.json(
      { error: "Failed to delete financial period" },
      { status: 500 }
    );
  }
}
