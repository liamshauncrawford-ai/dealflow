/**
 * Fit Score Engine — computes acquisition fit score (0-100) for target companies.
 *
 * Evaluates commercial service contractors against Crawford Holdings' broadened
 * acquisition thesis: 11 trade categories across Colorado's Front Range.
 *
 * 10 criteria, each scored 1-10, then weighted and summed to produce 0-100.
 */

import {
  FIT_SCORE_WEIGHTS,
  TARGET_TRADES,
  SECONDARY_TARGET_TRADES,
  TARGET_STATES,
  TARGET_METROS,
  NEIGHBORING_STATES,
  type PrimaryTradeKey,
} from "@/lib/constants";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface FitScoreInput {
  // From Listing
  primaryTrade: string | null;
  secondaryTrades: string[];
  revenue: number | null;
  established: number | null;
  state: string | null;
  metroArea: string | null;
  certifications: string[];
  askingPrice: number | null;
  ebitda: number | null;
  inferredEbitda: number | null;
  targetMultipleLow: number | null;
  targetMultipleHigh: number | null;

  // From Contact (primary owner)
  estimatedAgeRange: string | null;

  // From Opportunity
  keyPersonRisk: string | null;
  recurringRevenuePct: number | null;
}

export interface CriterionScore {
  raw: number;     // 1-10
  weighted: number; // raw × weight × 10
}

export interface FitScoreBreakdown {
  ownerAgeRetirement: CriterionScore;
  tradeFit: CriterionScore;
  revenueSize: CriterionScore;
  yearsInBusiness: CriterionScore;
  geographicFit: CriterionScore;
  recurringRevenue: CriterionScore;
  crossSellSynergy: CriterionScore;
  keyPersonRisk: CriterionScore;
  certifications: CriterionScore;
  valuationFit: CriterionScore;
}

export interface FitScoreResult {
  fitScore: number;          // 0-100
  breakdown: FitScoreBreakdown;
}

// ─────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────

export function computeFitScore(input: FitScoreInput): FitScoreResult {
  const breakdown: FitScoreBreakdown = {
    ownerAgeRetirement: scoreOwnerAge(input.estimatedAgeRange),
    tradeFit: scoreTradeFit(input.primaryTrade, input.secondaryTrades),
    revenueSize: scoreRevenueSize(input.revenue),
    yearsInBusiness: scoreYearsInBusiness(input.established),
    geographicFit: scoreGeographicFit(input.state, input.metroArea),
    recurringRevenue: scoreRecurringRevenue(input.recurringRevenuePct),
    crossSellSynergy: scoreCrossSellSynergy(input.primaryTrade, input.secondaryTrades),
    keyPersonRisk: scoreKeyPersonRisk(input.keyPersonRisk),
    certifications: scoreCertifications(input.certifications),
    valuationFit: scoreValuationFit(input.askingPrice, input.ebitda, input.inferredEbitda, input.targetMultipleHigh),
  };

  const fitScore = Math.round(
    breakdown.ownerAgeRetirement.weighted +
    breakdown.tradeFit.weighted +
    breakdown.revenueSize.weighted +
    breakdown.yearsInBusiness.weighted +
    breakdown.geographicFit.weighted +
    breakdown.recurringRevenue.weighted +
    breakdown.crossSellSynergy.weighted +
    breakdown.keyPersonRisk.weighted +
    breakdown.certifications.weighted +
    breakdown.valuationFit.weighted
  );

  return {
    fitScore: Math.max(0, Math.min(100, fitScore)),
    breakdown,
  };
}

// ─────────────────────────────────────────────
// Individual scoring functions
// ─────────────────────────────────────────────

function weighted(raw: number, weightKey: keyof typeof FIT_SCORE_WEIGHTS): CriterionScore {
  return {
    raw,
    weighted: raw * FIT_SCORE_WEIGHTS[weightKey] * 10,
  };
}

/**
 * 1. Owner Age/Retirement Proximity (20%)
 * 10 = owner 65+, no successor
 * 8 = owner 55-65
 * 5 = owner 45-55
 * 3 = owner <45
 * 1 = unknown
 */
function scoreOwnerAge(ageRange: string | null): CriterionScore {
  if (!ageRange) return weighted(1, "OWNER_AGE_RETIREMENT");

  // Parse age range like "55-65" or "65-75"
  const match = ageRange.match(/(\d+)/);
  if (!match) return weighted(1, "OWNER_AGE_RETIREMENT");

  const age = parseInt(match[1], 10);
  let raw: number;

  if (age >= 65) raw = 10;
  else if (age >= 55) raw = 8;
  else if (age >= 45) raw = 5;
  else if (age >= 35) raw = 3;
  else raw = 1;

  return weighted(raw, "OWNER_AGE_RETIREMENT");
}

/**
 * 2. Trade Fit (15%)
 * 10 = primary target trade (electrical, cabling, security, HVAC, etc.)
 * 7 = secondary target trade (painting, concrete, roofing, site work)
 * 3 = other trade
 * 1 = null/unknown
 */
function scoreTradeFit(
  primaryTrade: string | null,
  secondaryTrades: string[]
): CriterionScore {
  if (!primaryTrade) return weighted(1, "TRADE_FIT");

  if (TARGET_TRADES.includes(primaryTrade as PrimaryTradeKey)) {
    return weighted(10, "TRADE_FIT");
  }

  if (SECONDARY_TARGET_TRADES.includes(primaryTrade as PrimaryTradeKey)) {
    return weighted(7, "TRADE_FIT");
  }

  // Check if any secondary trade is a target trade
  if (secondaryTrades.some(t => TARGET_TRADES.includes(t as PrimaryTradeKey))) {
    return weighted(7, "TRADE_FIT");
  }

  if (secondaryTrades.some(t => SECONDARY_TARGET_TRADES.includes(t as PrimaryTradeKey))) {
    return weighted(5, "TRADE_FIT");
  }

  return weighted(3, "TRADE_FIT");
}

/**
 * 3. Revenue Size (10%)
 * 10 = $3M-$8M (sweet spot)
 * 7 = $1M-$3M or $8M-$15M
 * 3 = $500K-$1M or $15M-$25M
 * 1 = <$500K or >$25M or unknown
 */
function scoreRevenueSize(revenue: number | null): CriterionScore {
  if (revenue === null || revenue === 0) return weighted(1, "REVENUE_SIZE");

  let raw: number;
  if (revenue >= 3_000_000 && revenue <= 8_000_000) raw = 10;
  else if (revenue >= 1_000_000 && revenue <= 15_000_000) raw = 7;
  else if (revenue >= 500_000 && revenue <= 25_000_000) raw = 3;
  else raw = 1;

  return weighted(raw, "REVENUE_SIZE");
}

/**
 * 4. Years in Business (10%)
 * 10 = 25+ years
 * 8 = 15-25 years
 * 5 = 10-15 years
 * 3 = 5-10 years
 * 1 = <5 years or unknown
 */
function scoreYearsInBusiness(established: number | null): CriterionScore {
  if (!established) return weighted(1, "YEARS_IN_BUSINESS");

  const years = new Date().getFullYear() - established;
  let raw: number;

  if (years >= 25) raw = 10;
  else if (years >= 15) raw = 8;
  else if (years >= 10) raw = 5;
  else if (years >= 5) raw = 3;
  else raw = 1;

  return weighted(raw, "YEARS_IN_BUSINESS");
}

/**
 * 5. Geographic Fit (10%)
 * 10 = Denver Metro / Front Range
 * 7 = other Colorado
 * 3 = neighboring states (WY, NE, KS, NM, UT)
 * 1 = other or unknown
 */
function scoreGeographicFit(
  state: string | null,
  metroArea: string | null
): CriterionScore {
  if (!state) return weighted(1, "GEOGRAPHIC_FIT");

  const normalizedState = state.toUpperCase().trim();

  if (TARGET_STATES.includes(normalizedState)) {
    // Check for metro area
    if (metroArea && TARGET_METROS.some(m => metroArea.toLowerCase().includes(m.toLowerCase()))) {
      return weighted(10, "GEOGRAPHIC_FIT");
    }
    return weighted(8, "GEOGRAPHIC_FIT");
  }

  if (NEIGHBORING_STATES.includes(normalizedState)) {
    return weighted(3, "GEOGRAPHIC_FIT");
  }

  return weighted(1, "GEOGRAPHIC_FIT");
}

/**
 * 6. Recurring Revenue Potential (10%)
 * 10 = >30% recurring
 * 7 = 20-30% recurring
 * 5 = 10-20% recurring
 * 3 = <10% recurring
 * 1 = unknown
 */
function scoreRecurringRevenue(recurringPct: number | null): CriterionScore {
  if (recurringPct === null || recurringPct === undefined) return weighted(1, "RECURRING_REVENUE");

  let raw: number;
  if (recurringPct >= 0.30) raw = 10;
  else if (recurringPct >= 0.20) raw = 7;
  else if (recurringPct >= 0.10) raw = 5;
  else raw = 3;

  return weighted(raw, "RECURRING_REVENUE");
}

/**
 * 7. Cross-Sell Synergy (10%)
 * 10 = fills a missing platform leg (trade not already in portfolio)
 * 7 = fills a secondary gap
 * 5 = overlaps existing capability
 * 1 = no synergy / null
 *
 * For now, scores based on trade diversity value.
 * When portfolio tracking is added, this can compare against existing platform trades.
 */
function scoreCrossSellSynergy(
  primaryTrade: string | null,
  secondaryTrades: string[]
): CriterionScore {
  if (!primaryTrade) return weighted(1, "CROSS_SELL_SYNERGY");

  const allTrades = [primaryTrade, ...secondaryTrades];

  // Count how many of the 3 core target trade categories are covered
  const coreTradesCovered = TARGET_TRADES.filter(t => allTrades.includes(t)).length;

  // A company that covers one core trade is filling a platform leg
  if (coreTradesCovered === 1) return weighted(10, "CROSS_SELL_SYNERGY");
  // Covers multiple core trades — very valuable but slightly less gap-fill
  if (coreTradesCovered >= 2) return weighted(9, "CROSS_SELL_SYNERGY");
  // Secondary trade overlap
  if (SECONDARY_TARGET_TRADES.some(t => allTrades.includes(t))) {
    return weighted(7, "CROSS_SELL_SYNERGY");
  }

  return weighted(3, "CROSS_SELL_SYNERGY");
}

/**
 * 8. Key Person Risk (5%)
 * Inverse mapping: LOW risk = high score
 * 10 = LOW (deep bench)
 * 7 = MEDIUM
 * 3 = HIGH
 * 1 = unknown
 */
function scoreKeyPersonRisk(risk: string | null): CriterionScore {
  if (!risk) return weighted(5, "KEY_PERSON_RISK"); // Default to neutral

  switch (risk) {
    case "LOW": return weighted(10, "KEY_PERSON_RISK");
    case "MEDIUM": return weighted(6, "KEY_PERSON_RISK");
    case "HIGH": return weighted(3, "KEY_PERSON_RISK");
    default: return weighted(5, "KEY_PERSON_RISK");
  }
}

/**
 * 9. Certifications / Moats (5%)
 * 10 = MBE/WBE + GSA + factory authorized (3+ high-value certs)
 * 7 = 3+ certifications total
 * 5 = 1-2 certifications
 * 1 = none
 */
function scoreCertifications(
  certifications: string[]
): CriterionScore {
  const totalCerts = certifications.length;

  // Check for high-value certifications
  const allCerts = certifications.map(c => c.toLowerCase());
  const hasHighValue = allCerts.some(c =>
    c.includes("mbe") || c.includes("wbe") || c.includes("gsa") ||
    c.includes("factory") || c.includes("authorized") || c.includes("certified")
  );

  let raw: number;
  if (totalCerts >= 3 && hasHighValue) raw = 10;
  else if (totalCerts >= 3) raw = 7;
  else if (totalCerts >= 1) raw = 5;
  else raw = 1;

  return weighted(raw, "CERTIFICATIONS");
}

/**
 * 10. Estimated Valuation Fit (5%)
 * 10 = <$3M enterprise value
 * 7 = $3M-$8M
 * 3 = $8M-$15M
 * 1 = >$15M or unknown
 */
function scoreValuationFit(
  askingPrice: number | null,
  ebitda: number | null,
  inferredEbitda: number | null,
  targetMultipleHigh: number | null
): CriterionScore {
  // Try asking price first, then compute from EBITDA
  let ev = askingPrice;
  if (!ev) {
    const effectiveEbitda = ebitda ?? inferredEbitda;
    const multiple = targetMultipleHigh ?? 5.0;
    if (effectiveEbitda) {
      ev = effectiveEbitda * multiple;
    }
  }

  if (!ev || ev === 0) return weighted(5, "VALUATION_FIT"); // Neutral if unknown

  let raw: number;
  if (ev < 3_000_000) raw = 10;
  else if (ev <= 8_000_000) raw = 7;
  else if (ev <= 15_000_000) raw = 3;
  else raw = 1;

  return weighted(raw, "VALUATION_FIT");
}
