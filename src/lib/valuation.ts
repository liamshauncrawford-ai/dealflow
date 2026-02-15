/**
 * Shared Opportunity Valuation Utility
 *
 * Canonical 6-tier waterfall for computing opportunity value:
 *   1. dealValue (manually set deal value — highest priority)
 *   2. offerPrice (submitted offer)
 *   3. latestFinancials.adjustedEbitda × targetMultiple (from financial periods)
 *   4. actualEbitda × targetMultiple (opp-level EBITDA override)
 *   5. listing ebitda/inferredEbitda × targetMultiple
 *   6. askingPrice (listing asking price — lowest priority)
 *
 * Used by: stats API, pipeline page stats, kanban column totals.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEFAULT_MULTIPLE_LOW = 3.0;
const DEFAULT_MULTIPLE_HIGH = 5.0;

export interface ValueRange {
  low: number;
  high: number;
}

/**
 * Compute the estimated value range (low/high) for an opportunity
 * using the canonical 5-tier waterfall.
 *
 * Returns null if no valuation data is available.
 */
export function getOpportunityValueRange(opp: any): ValueRange | null {
  const dv = opp.dealValue ? Number(opp.dealValue) : null;
  const op = opp.offerPrice ? Number(opp.offerPrice) : null;
  const ae = opp.actualEbitda ? Number(opp.actualEbitda) : null;
  const le = opp.listing?.ebitda
    ? Number(opp.listing.ebitda)
    : opp.listing?.inferredEbitda
      ? Number(opp.listing.inferredEbitda)
      : null;
  const ask = opp.listing?.askingPrice ? Number(opp.listing.askingPrice) : null;
  const mLow = opp.listing?.targetMultipleLow ?? DEFAULT_MULTIPLE_LOW;
  const mHigh = opp.listing?.targetMultipleHigh ?? DEFAULT_MULTIPLE_HIGH;

  // Tier 1: Deal value (highest priority)
  if (dv && dv > 0) {
    return { low: dv, high: dv };
  }

  // Tier 2: Offer price
  if (op && op > 0) {
    return { low: op, high: op };
  }

  // Tier 3: Adjusted EBITDA from financial periods (most accurate)
  const fpEbitda = opp.latestFinancials?.adjustedEbitda
    ? Number(opp.latestFinancials.adjustedEbitda)
    : null;
  if (fpEbitda && fpEbitda > 0) {
    return { low: fpEbitda * mLow, high: fpEbitda * mHigh };
  }

  // Tier 4: Actual EBITDA (opp-level override) × multiple range
  if (ae && ae > 0) {
    return { low: ae * mLow, high: ae * mHigh };
  }

  // Tier 5: Listing EBITDA (or inferred) × multiple range
  if (le && le > 0) {
    return { low: le * mLow, high: le * mHigh };
  }

  // Tier 6: Asking price (fallback)
  if (ask && ask > 0) {
    return { low: ask, high: ask };
  }

  return null;
}

/**
 * Compute a single implied enterprise value (midpoint) for an opportunity.
 * Used for column totals and weighted pipeline calculations.
 *
 * For fixed-value tiers (dealValue, offerPrice, askingPrice), returns the value directly.
 * For EBITDA tiers, returns the midpoint of the low/high range.
 */
export function getImpliedEV(opp: any): number | null {
  const range = getOpportunityValueRange(opp);
  if (!range) return null;
  return (range.low + range.high) / 2;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
