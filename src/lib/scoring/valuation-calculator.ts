/**
 * Per-target valuation calculator with adjusted multiples.
 *
 * From Section 6 of the briefing:
 * - Base multiple range: 3.0x – 5.0x
 * - Adjustments:
 *   +0.5x for recurring revenue > 20%
 *   +0.5x for revenue growing > 10% CAGR
 *   +0.5x for customer concentration < 20%
 *   +0.5x for data center experience
 *   -0.5x for key-person risk (high)
 *   -0.5x for customer concentration > 40%
 *   -0.5x for declining revenue
 *   -0.5x for no recurring revenue
 */

export interface ValuationInput {
  // Required
  ebitda: number | null;
  sde: number | null;

  // Multiple range (defaults to 3.0–5.0)
  baseMultipleLow?: number;
  baseMultipleHigh?: number;

  // Adjustment inputs
  recurringRevenuePct?: number | null;   // 0–1 scale
  revenueTrend?: "GROWING" | "STABLE" | "DECLINING" | null;
  revenueGrowthCagr?: number | null;     // e.g., 0.15 for 15%
  customerConcentration?: number | null;  // top customer as % of revenue (0–1)
  dcExperience?: boolean | null;
  keyPersonRisk?: "LOW" | "MEDIUM" | "HIGH" | null;

  // Toggle for SDE vs EBITDA
  useSde?: boolean;
}

export interface MultipleAdjustment {
  label: string;
  value: number; // +/- 0.5 etc.
  reason: string;
}

export interface ValuationResult {
  earningsBase: number;       // EBITDA or SDE used
  earningsType: "EBITDA" | "SDE";
  baseMultipleLow: number;
  baseMultipleHigh: number;
  adjustments: MultipleAdjustment[];
  totalAdjustment: number;
  adjustedMultipleLow: number;
  adjustedMultipleHigh: number;
  valuationLow: number;
  valuationHigh: number;
  midpointValuation: number;
}

export function computeValuation(input: ValuationInput): ValuationResult | null {
  const useSde = input.useSde ?? false;
  const earningsBase = useSde
    ? (input.sde ?? 0)
    : (input.ebitda ?? 0);

  if (earningsBase <= 0) return null;

  const baseMultipleLow = input.baseMultipleLow ?? 3.0;
  const baseMultipleHigh = input.baseMultipleHigh ?? 5.0;

  const adjustments: MultipleAdjustment[] = [];

  // +0.5x for recurring revenue > 20%
  if (input.recurringRevenuePct !== null && input.recurringRevenuePct !== undefined) {
    if (input.recurringRevenuePct > 0.20) {
      adjustments.push({
        label: "Recurring Revenue",
        value: 0.5,
        reason: `${(input.recurringRevenuePct * 100).toFixed(0)}% recurring (>20%)`,
      });
    } else if (input.recurringRevenuePct === 0) {
      // -0.5x for no recurring revenue
      adjustments.push({
        label: "No Recurring Revenue",
        value: -0.5,
        reason: "Pure project work, no maintenance/monitoring contracts",
      });
    }
  }

  // +0.5x for revenue growing > 10% CAGR
  if (input.revenueGrowthCagr !== null && input.revenueGrowthCagr !== undefined && input.revenueGrowthCagr > 0.10) {
    adjustments.push({
      label: "Revenue Growth",
      value: 0.5,
      reason: `${(input.revenueGrowthCagr * 100).toFixed(0)}% CAGR (>10%)`,
    });
  }

  // -0.5x for declining revenue
  if (input.revenueTrend === "DECLINING") {
    adjustments.push({
      label: "Declining Revenue",
      value: -0.5,
      reason: "Revenue trend is declining",
    });
  }

  // Customer concentration adjustments
  if (input.customerConcentration !== null && input.customerConcentration !== undefined) {
    if (input.customerConcentration < 0.20) {
      adjustments.push({
        label: "Low Concentration",
        value: 0.5,
        reason: `Top customer ${(input.customerConcentration * 100).toFixed(0)}% of revenue (<20%)`,
      });
    } else if (input.customerConcentration > 0.40) {
      adjustments.push({
        label: "High Concentration",
        value: -0.5,
        reason: `Top customer ${(input.customerConcentration * 100).toFixed(0)}% of revenue (>40%)`,
      });
    }
  }

  // +0.5x for data center experience
  if (input.dcExperience) {
    adjustments.push({
      label: "DC Experience",
      value: 0.5,
      reason: "Proven data center project experience",
    });
  }

  // -0.5x for high key-person risk
  if (input.keyPersonRisk === "HIGH") {
    adjustments.push({
      label: "Key Person Risk",
      value: -0.5,
      reason: "Entirely owner-dependent operations",
    });
  }

  const totalAdjustment = adjustments.reduce((sum, a) => sum + a.value, 0);
  const adjustedMultipleLow = Math.max(1.0, baseMultipleLow + totalAdjustment);
  const adjustedMultipleHigh = Math.max(1.0, baseMultipleHigh + totalAdjustment);

  const valuationLow = earningsBase * adjustedMultipleLow;
  const valuationHigh = earningsBase * adjustedMultipleHigh;

  return {
    earningsBase,
    earningsType: useSde ? "SDE" : "EBITDA",
    baseMultipleLow,
    baseMultipleHigh,
    adjustments,
    totalAdjustment,
    adjustedMultipleLow,
    adjustedMultipleHigh,
    valuationLow,
    valuationHigh,
    midpointValuation: (valuationLow + valuationHigh) / 2,
  };
}
