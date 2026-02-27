import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recomputeAndUpdate } from "@/lib/financial/recompute-and-update";
import { syncOpportunitySummary } from "@/lib/financial/sync-opportunity";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string; periodId: string }> };

const ALLOWED_OVERRIDE_FIELDS = [
  "overrideTotalRevenue",
  "overrideTotalCogs",
  "overrideGrossProfit",
  "overrideTotalOpex",
  "overrideEbitda",
  "overrideAdjustedEbitda",
  "overrideEbit",
  "overrideNetIncome",
] as const;

const patchSchema = z.object({
  field: z.enum(ALLOWED_OVERRIDE_FIELDS),
  value: z.number().nullable(),
});

/**
 * PATCH /api/pipeline/[id]/financials/[periodId]/overrides
 *
 * Set or clear a manual override on a computed P&L field.
 * When set (non-null), the override value is used instead of the
 * value computed from line items.
 * When cleared (null), the field reverts to computed-from-line-items.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, periodId } = await params;

    const period = await prisma.financialPeriod.findUnique({
      where: { id: periodId },
      select: { isLocked: true, opportunityId: true },
    });
    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }
    if (period.isLocked) {
      return NextResponse.json({ error: "Period is locked" }, { status: 403 });
    }
    if (period.opportunityId !== id) {
      return NextResponse.json({ error: "Period does not belong to this opportunity" }, { status: 403 });
    }

    const json = await request.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { field, value } = parsed.data;

    // Set or clear the override
    await prisma.financialPeriod.update({
      where: { id: periodId },
      data: { [field]: value },
    });

    // Recompute summary (respects all overrides) + sync to Opportunity
    await recomputeAndUpdate(periodId);
    try { await syncOpportunitySummary(id); } catch (e) { console.error("Sync failed:", e); }

    const updated = await prisma.financialPeriod.findUnique({
      where: { id: periodId },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update override:", error);
    return NextResponse.json(
      { error: "Failed to update override" },
      { status: 500 },
    );
  }
}
