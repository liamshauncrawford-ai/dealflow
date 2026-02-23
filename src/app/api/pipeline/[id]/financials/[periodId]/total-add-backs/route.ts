import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recomputePeriodSummary } from "@/lib/financial/recompute-period";
import { syncOpportunitySummary } from "@/lib/financial/sync-opportunity";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string; periodId: string }> };

const patchSchema = z.object({
  total: z.number(),
});

/**
 * PATCH /api/pipeline/[id]/financials/[periodId]/total-add-backs
 *
 * Set the total EBITDA add-backs for a period by upserting a "Manual Adjustment"
 * add-back. The delta between the desired total and existing add-backs is stored
 * as a single reconciliation entry, preserving the audit trail of original items.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const json = await request.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { total: desiredTotal } = parsed.data;

    // Fetch all existing add-backs for this period
    const addBacks = await prisma.addBack.findMany({
      where: { periodId },
    });

    // Sum current EBITDA add-backs (matching recomputePeriodSummary logic)
    const currentTotal = addBacks
      .filter((ab) => ab.includeInEbitda)
      .reduce((sum, ab) => sum + Number(ab.amount), 0);

    const delta = desiredTotal - currentTotal;

    // Find existing "Manual Adjustment" add-back
    const existingManual = addBacks.find(
      (ab) => ab.description === "Manual Adjustment" && ab.category === "OTHER",
    );

    if (existingManual) {
      // Update existing manual adjustment: add delta to its current amount
      const newAmount = Number(existingManual.amount) + delta;
      if (Math.abs(newAmount) < 0.01) {
        // Zero out — delete it entirely
        await prisma.addBack.delete({ where: { id: existingManual.id } });
      } else {
        await prisma.addBack.update({
          where: { id: existingManual.id },
          data: { amount: newAmount },
        });
      }
    } else if (Math.abs(delta) >= 0.01) {
      // Create new "Manual Adjustment" add-back
      await prisma.addBack.create({
        data: {
          periodId,
          category: "OTHER",
          description: "Manual Adjustment",
          amount: delta,
          includeInEbitda: true,
          includeInSde: true,
        },
      });
    }

    // Recompute period summary + sync to Opportunity
    const lineItems = await prisma.financialLineItem.findMany({ where: { periodId } });
    const updatedAddBacks = await prisma.addBack.findMany({ where: { periodId } });
    const summary = recomputePeriodSummary(lineItems, updatedAddBacks);
    const updated = await prisma.financialPeriod.update({
      where: { id: periodId },
      data: summary,
    });

    try {
      await syncOpportunitySummary(id);
    } catch (e) {
      console.error("Sync failed:", e);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update total add-backs:", error);
    return NextResponse.json(
      { error: "Failed to update total add-backs" },
      { status: 500 },
    );
  }
}
