/**
 * Maps FinancialPeriod data → ValuationInputs for the deal-embedded calculator.
 *
 * Three modes:
 * 1. Single period  — uses one year's data directly
 * 2. Weighted average — recent years weighted heavier (e.g., 50/30/20)
 * 3. Simple average  — equal weight across all periods
 *
 * Follows the same fallback pattern as listing-mapper.ts but operates on
 * FinancialPeriod records (which have line-item-level detail) rather than
 * Listing summary fields.
 */

import type { ValuationInputs } from "./valuation-engine";
import { DEFAULT_INPUTS } from "./valuation-engine";

// ─────────────────────────────────────────────
// Types (mirrors the API response shape)
// ─────────────────────────────────────────────

export interface PeriodSummary {
  id: string;
  periodType: string;
  year: number;
  quarter?: number | null;
  totalRevenue?: number | null;
  ebitda?: number | null;
  adjustedEbitda?: number | null;
  sde?: number | null;
  totalOpex?: number | null;
  grossProfit?: number | null;
  netIncome?: number | null;
  ebitdaMargin?: number | null;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Resolve best available EBITDA from a period (adjusted > raw > SDE > 0) */
function resolveEbitda(period: PeriodSummary): number {
  return (
    Number(period.adjustedEbitda) ||
    Number(period.ebitda) ||
    Number(period.sde) ||
    0
  );
}

/** Derive revenue growth rate from two consecutive annual periods */
function deriveGrowthRate(
  periods: PeriodSummary[],
): number | null {
  // Filter to annual periods sorted newest first
  const annual = periods
    .filter((p) => p.periodType === "ANNUAL")
    .sort((a, b) => b.year - a.year);

  if (annual.length < 2) return null;

  const recent = Number(annual[0].totalRevenue) || 0;
  const prior = Number(annual[1].totalRevenue) || 0;

  if (prior <= 0 || recent <= 0) return null;
  return (recent - prior) / prior;
}

// ─────────────────────────────────────────────
// Single Period Mapper
// ─────────────────────────────────────────────

/**
 * Map a single FinancialPeriod into ValuationInputs.
 * Only overrides fields where the period has data — preserves defaults for the rest.
 */
export function mapFinancialPeriodToValuationInputs(
  period: PeriodSummary,
  defaults: ValuationInputs = DEFAULT_INPUTS,
  allPeriods?: PeriodSummary[],
): ValuationInputs {
  const revenue = Number(period.totalRevenue) || 0;
  const ebitda = resolveEbitda(period);
  const margin = revenue > 0 ? ebitda / revenue : 0;

  // Try to derive growth rate from historical periods
  const growthRate = allPeriods ? deriveGrowthRate(allPeriods) : null;

  return {
    ...defaults,
    target_revenue: revenue,
    target_ebitda: ebitda,
    target_ebitda_margin: margin,
    ...(growthRate !== null ? { revenue_growth_rate: growthRate } : {}),
  };
}

// ─────────────────────────────────────────────
// Weighted Average Mapper
// ─────────────────────────────────────────────

/**
 * Map multiple periods into ValuationInputs using weighted averages.
 * Periods should be sorted newest first; weights align by index.
 *
 * Default weights: [0.50, 0.30, 0.20] for 3 years (most recent weighted heaviest).
 */
export function mapWeightedPeriodsToValuationInputs(
  periods: PeriodSummary[],
  weights?: number[],
  defaults: ValuationInputs = DEFAULT_INPUTS,
): ValuationInputs {
  if (periods.length === 0) return defaults;
  if (periods.length === 1) return mapFinancialPeriodToValuationInputs(periods[0], defaults, periods);

  // Default declining weights if not provided
  const effectiveWeights = weights ?? getDefaultWeights(periods.length);

  // Normalize weights to sum to 1
  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
  const normalized = effectiveWeights.map((w) => w / totalWeight);

  let weightedRevenue = 0;
  let weightedEbitda = 0;

  for (let i = 0; i < periods.length; i++) {
    const w = normalized[i] ?? 0;
    weightedRevenue += (Number(periods[i].totalRevenue) || 0) * w;
    weightedEbitda += resolveEbitda(periods[i]) * w;
  }

  const margin = weightedRevenue > 0 ? weightedEbitda / weightedRevenue : 0;
  const growthRate = deriveGrowthRate(periods);

  return {
    ...defaults,
    target_revenue: Math.round(weightedRevenue),
    target_ebitda: Math.round(weightedEbitda),
    target_ebitda_margin: margin,
    ...(growthRate !== null ? { revenue_growth_rate: growthRate } : {}),
  };
}

// ─────────────────────────────────────────────
// Simple Average Mapper
// ─────────────────────────────────────────────

/**
 * Map multiple periods using simple (equal weight) averages.
 */
export function mapAveragePeriods(
  periods: PeriodSummary[],
  defaults: ValuationInputs = DEFAULT_INPUTS,
): ValuationInputs {
  if (periods.length === 0) return defaults;

  const equalWeights = periods.map(() => 1 / periods.length);
  return mapWeightedPeriodsToValuationInputs(periods, equalWeights, defaults);
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

/** Generate declining weights: 50%, 30%, 20% for 3 years, etc. */
function getDefaultWeights(count: number): number[] {
  if (count <= 1) return [1];
  if (count === 2) return [0.6, 0.4];
  if (count === 3) return [0.5, 0.3, 0.2];

  // For 4+ years: most recent gets 40%, rest decline linearly
  const weights: number[] = [0.4];
  const remaining = 0.6;
  for (let i = 1; i < count; i++) {
    weights.push(remaining * (count - i) / ((count * (count - 1)) / 2));
  }
  return weights;
}

/**
 * Sort periods: annual periods newest first.
 * Useful for preparing data before passing to mappers.
 */
export function sortPeriodsNewestFirst(periods: PeriodSummary[]): PeriodSummary[] {
  return [...periods].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    // Within same year: ANNUAL > QUARTERLY
    if (a.periodType === "ANNUAL" && b.periodType !== "ANNUAL") return -1;
    if (b.periodType === "ANNUAL" && a.periodType !== "ANNUAL") return 1;
    return (b.quarter ?? 0) - (a.quarter ?? 0);
  });
}

/** Get the most recent annual period from a list */
export function getMostRecentAnnual(periods: PeriodSummary[]): PeriodSummary | null {
  return (
    [...periods]
      .filter((p) => p.periodType === "ANNUAL")
      .sort((a, b) => b.year - a.year)[0] ?? null
  );
}
