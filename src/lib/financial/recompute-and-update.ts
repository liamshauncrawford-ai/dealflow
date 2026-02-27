/**
 * Shared helper: fetches a period's line items, add-backs, and override fields,
 * then recomputes all denormalized summary values and saves them.
 *
 * Used by line-items, add-backs, total-add-backs, and overrides API routes
 * to avoid duplicating the fetch-recompute-save pattern.
 */

import { prisma } from "@/lib/db";
import { recomputePeriodSummary, type PeriodOverrides } from "./recompute-period";

const OVERRIDE_SELECT = {
  overrideTotalRevenue: true,
  overrideTotalCogs: true,
  overrideGrossProfit: true,
  overrideTotalOpex: true,
  overrideEbitda: true,
  overrideAdjustedEbitda: true,
  overrideEbit: true,
  overrideNetIncome: true,
} as const;

export async function recomputeAndUpdate(periodId: string): Promise<void> {
  const [period, lineItems, addBacks] = await Promise.all([
    prisma.financialPeriod.findUnique({
      where: { id: periodId },
      select: OVERRIDE_SELECT,
    }),
    prisma.financialLineItem.findMany({ where: { periodId } }),
    prisma.addBack.findMany({ where: { periodId } }),
  ]);

  const overrides: PeriodOverrides | undefined = period
    ? {
        overrideTotalRevenue: period.overrideTotalRevenue ? Number(period.overrideTotalRevenue) : null,
        overrideTotalCogs: period.overrideTotalCogs ? Number(period.overrideTotalCogs) : null,
        overrideGrossProfit: period.overrideGrossProfit ? Number(period.overrideGrossProfit) : null,
        overrideTotalOpex: period.overrideTotalOpex ? Number(period.overrideTotalOpex) : null,
        overrideEbitda: period.overrideEbitda ? Number(period.overrideEbitda) : null,
        overrideAdjustedEbitda: period.overrideAdjustedEbitda ? Number(period.overrideAdjustedEbitda) : null,
        overrideEbit: period.overrideEbit ? Number(period.overrideEbit) : null,
        overrideNetIncome: period.overrideNetIncome ? Number(period.overrideNetIncome) : null,
      }
    : undefined;

  const summary = recomputePeriodSummary(lineItems, addBacks, overrides);
  await prisma.financialPeriod.update({
    where: { id: periodId },
    data: summary,
  });
}
