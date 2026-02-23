/**
 * Pure computation: recomputes all denormalized summary values on a FinancialPeriod
 * from its line items and add-backs.
 *
 * Supports manual overrides — when an override is set (non-null), that value is used
 * instead of the computed value from line items. This allows users to enter exact P&L
 * values (e.g., "Net Income = $36,549") that bypass the line-item sum.
 *
 * Called after every line item, add-back, or override mutation.
 */

import type { Decimal } from "@prisma/client/runtime/library";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface LineItem {
  category: string;
  amount: Decimal | number;
  isNegative: boolean;
}

interface AddBackItem {
  amount: Decimal | number;
  includeInSde: boolean;
  includeInEbitda: boolean;
}

export interface PeriodOverrides {
  overrideTotalRevenue?: number | null;
  overrideTotalCogs?: number | null;
  overrideGrossProfit?: number | null;
  overrideTotalOpex?: number | null;
  overrideEbitda?: number | null;
  overrideNetIncome?: number | null;
}

export interface PeriodSummary {
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalOpex: number;
  ebitda: number;
  depreciationAmort: number;
  ebit: number;
  interestExpense: number;
  taxExpense: number;
  netIncome: number;
  totalAddBacks: number;
  adjustedEbitda: number;
  sde: number;
  grossMargin: number | null;
  ebitdaMargin: number | null;
  adjustedEbitdaMargin: number | null;
  netMargin: number | null;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function toNum(val: Decimal | number | null | undefined): number {
  if (val == null) return 0;
  return typeof val === "number" ? val : Number(val);
}

function sumByCategory(items: LineItem[], category: string): number {
  let total = 0;
  for (const item of items) {
    if (item.category === category) {
      const amt = toNum(item.amount);
      total += item.isNegative ? -amt : amt;
    }
  }
  return total;
}

function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

// ─────────────────────────────────────────────
// Main computation
// ─────────────────────────────────────────────

export function recomputePeriodSummary(
  lineItems: LineItem[],
  addBacks: AddBackItem[],
  overrides?: PeriodOverrides,
): PeriodSummary {
  // P&L waterfall from line items — overrides take precedence when set
  const totalRevenue = overrides?.overrideTotalRevenue ?? sumByCategory(lineItems, "REVENUE");
  const totalCogs = overrides?.overrideTotalCogs ?? sumByCategory(lineItems, "COGS");
  const grossProfit = overrides?.overrideGrossProfit ?? (totalRevenue - totalCogs);

  const totalOpex = overrides?.overrideTotalOpex ?? sumByCategory(lineItems, "OPEX");
  const ebitda = overrides?.overrideEbitda ?? (grossProfit - totalOpex);

  const depreciationAmort = sumByCategory(lineItems, "D_AND_A");
  const ebit = ebitda - depreciationAmort;

  const interestExpense = sumByCategory(lineItems, "INTEREST");
  const taxExpense = sumByCategory(lineItems, "TAX");

  const otherIncome = sumByCategory(lineItems, "OTHER_INCOME");
  const otherExpense = sumByCategory(lineItems, "OTHER_EXPENSE");

  const netIncome = overrides?.overrideNetIncome ?? (ebit - interestExpense - taxExpense + otherIncome - otherExpense);

  // Add-backs
  // adjustedEbitda = ebitda + add-backs marked for EBITDA
  // SDE = ebitda + ALL add-backs marked for SDE (superset of EBITDA add-backs)
  let ebitdaAddBacks = 0;
  let sdeAddBacks = 0;

  for (const ab of addBacks) {
    const amt = toNum(ab.amount);
    if (ab.includeInEbitda) ebitdaAddBacks += amt;
    if (ab.includeInSde) sdeAddBacks += amt;
  }

  const totalAddBacks = ebitdaAddBacks;
  const adjustedEbitda = ebitda + ebitdaAddBacks;
  const sde = ebitda + sdeAddBacks;

  // Margins
  const grossMargin = safeRatio(grossProfit, totalRevenue);
  const ebitdaMargin = safeRatio(ebitda, totalRevenue);
  const adjustedEbitdaMargin = safeRatio(adjustedEbitda, totalRevenue);
  const netMargin = safeRatio(netIncome, totalRevenue);

  return {
    totalRevenue,
    totalCogs,
    grossProfit,
    totalOpex,
    ebitda,
    depreciationAmort,
    ebit,
    interestExpense,
    taxExpense,
    netIncome,
    totalAddBacks,
    adjustedEbitda,
    sde,
    grossMargin,
    ebitdaMargin,
    adjustedEbitdaMargin,
    netMargin,
  };
}
