import { getMultiplesForIndustry } from "./industry-multiples";
import { validateInference } from "./validators";
import { MINIMUM_EBITDA } from "@/lib/constants";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface InferenceResult {
  inferredEbitda: number | null;
  inferredSde: number | null;
  inferenceMethod: string; // "LISTED_MULTIPLE" | "REVENUE_MARGIN" | "PRICE_MULTIPLE" | "CROSS_CHECK" | "MANUAL"
  inferenceConfidence: number; // 0.0 to 1.0
}

export interface InferenceInput {
  askingPrice: number | null;
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  cashFlow: number | null;
  industry: string | null;
  category: string | null;
  priceToSde: number | null;
  priceToEbitda: number | null;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Typical ratio: SDE ~= EBITDA * 1.15 (SDE adds back owner compensation). */
const SDE_TO_EBITDA_RATIO = 1.15;

/** Inverse: EBITDA ~= SDE * 0.87 */
const EBITDA_TO_SDE_RATIO = 0.87;

// ─────────────────────────────────────────────
// Main inference function
// ─────────────────────────────────────────────

/**
 * Attempt to infer EBITDA and/or SDE from whatever data is available on
 * a listing, using industry multiples as reference benchmarks.
 *
 * Returns `null` if both EBITDA and SDE are already reported (no
 * inference needed).
 *
 * Methods are tried in priority order:
 *  1. Listed Multiple  (confidence 0.90)
 *  2. Revenue + Industry Margin  (confidence 0.60)
 *  3. Asking Price / Industry Multiple  (confidence 0.45)
 *  4. Cross-Check (price + revenue)  (confidence 0.70)
 *
 * After computation the result is run through sanity validators; if any
 * check fails the confidence is downgraded to 0.20.
 */
export async function inferFinancials(
  listing: InferenceInput,
): Promise<InferenceResult | null> {
  // If both EBITDA and SDE are already reported, no inference needed.
  if (listing.ebitda !== null && listing.sde !== null) {
    return null;
  }

  let result: InferenceResult | null = null;

  // ── Method 1: Listed Multiple (confidence 0.90) ──────────────────
  result = tryListedMultiple(listing);
  if (result) {
    return applyValidation(result, listing);
  }

  // ── Method 4: Cross-Check (confidence 0.70) ──────────────────────
  // Tried before methods 2 & 3 because when both askingPrice AND
  // revenue are available we get a stronger signal than either alone.
  result = await tryCrossCheck(listing);
  if (result) {
    return applyValidation(result, listing);
  }

  // ── Method 2: Revenue + Industry Margin (confidence 0.60) ────────
  result = await tryRevenueMargin(listing);
  if (result) {
    return applyValidation(result, listing);
  }

  // ── Method 3: Asking Price / Industry Multiple (confidence 0.45) ─
  result = await tryPriceMultiple(listing);
  if (result) {
    return applyValidation(result, listing);
  }

  return null;
}

// ─────────────────────────────────────────────
// Individual method implementations
// ─────────────────────────────────────────────

/**
 * Method 1: Listed Multiple
 *
 * If the listing includes its own price-to-SDE or price-to-EBITDA
 * multiple AND an asking price, we can directly compute the earnings.
 */
function tryListedMultiple(listing: InferenceInput): InferenceResult | null {
  const { askingPrice, priceToSde, priceToEbitda } = listing;
  if (askingPrice === null || askingPrice <= 0) return null;
  if (priceToSde === null && priceToEbitda === null) return null;

  let inferredSde: number | null = null;
  let inferredEbitda: number | null = null;

  if (priceToSde !== null && priceToSde > 0) {
    inferredSde = askingPrice / priceToSde;
  }

  if (priceToEbitda !== null && priceToEbitda > 0) {
    inferredEbitda = askingPrice / priceToEbitda;
  }

  // Derive the missing value from the other using the SDE/EBITDA relationship.
  if (inferredSde !== null && inferredEbitda === null) {
    inferredEbitda = inferredSde * EBITDA_TO_SDE_RATIO;
  } else if (inferredEbitda !== null && inferredSde === null) {
    inferredSde = inferredEbitda * SDE_TO_EBITDA_RATIO;
  }

  return {
    inferredEbitda: inferredEbitda !== null ? Math.round(inferredEbitda) : null,
    inferredSde: inferredSde !== null ? Math.round(inferredSde) : null,
    inferenceMethod: "LISTED_MULTIPLE",
    inferenceConfidence: 0.90,
  };
}

/**
 * Method 2: Revenue + Industry Margin
 *
 * When revenue is reported we multiply it by the industry's median
 * EBITDA margin to estimate earnings.
 */
async function tryRevenueMargin(listing: InferenceInput): Promise<InferenceResult | null> {
  const { revenue, industry, category } = listing;
  if (revenue === null || revenue <= 0) return null;

  const multiples = await getMultiplesForIndustry(industry, category);
  if (!multiples || multiples.ebitdaMarginMedian === null) return null;

  const inferredEbitda = Math.round(revenue * multiples.ebitdaMarginMedian);
  const inferredSde = Math.round(inferredEbitda * SDE_TO_EBITDA_RATIO);

  return {
    inferredEbitda,
    inferredSde,
    inferenceMethod: "REVENUE_MARGIN",
    inferenceConfidence: 0.60,
  };
}

/**
 * Method 3: Asking Price / Industry Multiple
 *
 * When only the asking price is available we divide by the industry's
 * median SDE multiple to back into an SDE estimate.
 */
async function tryPriceMultiple(listing: InferenceInput): Promise<InferenceResult | null> {
  const { askingPrice, industry, category } = listing;
  if (askingPrice === null || askingPrice <= 0) return null;

  const multiples = await getMultiplesForIndustry(industry, category);
  if (!multiples || multiples.sdeMedian === null) return null;

  const inferredSde = Math.round(askingPrice / multiples.sdeMedian);
  const inferredEbitda = Math.round(inferredSde * EBITDA_TO_SDE_RATIO);

  return {
    inferredEbitda,
    inferredSde,
    inferenceMethod: "PRICE_MULTIPLE",
    inferenceConfidence: 0.45,
  };
}

/**
 * Method 4: Cross-Check
 *
 * When both asking price AND revenue are available (but no earnings),
 * we can triangulate:
 *  - Compute the implied revenue multiple (askingPrice / revenue).
 *  - Compare it against the industry's typical revenue multiple.
 *  - If the implied multiple is reasonable (0.3x - 5x), use the
 *    industry EBITDA margin to estimate EBITDA from revenue, then
 *    sanity-check whether askingPrice / inferredEBITDA is reasonable.
 *
 * Falls back to Method 3 at lower confidence if the cross-check fails.
 */
async function tryCrossCheck(listing: InferenceInput): Promise<InferenceResult | null> {
  const { askingPrice, revenue, industry, category } = listing;
  if (askingPrice === null || askingPrice <= 0) return null;
  if (revenue === null || revenue <= 0) return null;

  const multiples = await getMultiplesForIndustry(industry, category);
  if (!multiples) return null;
  if (multiples.ebitdaMarginMedian === null) return null;

  const impliedRevenueMultiple = askingPrice / revenue;

  // Is the implied revenue multiple within a reasonable range?
  if (impliedRevenueMultiple < 0.3 || impliedRevenueMultiple > 5.0) {
    // Fall back to Method 3 at reduced confidence
    if (multiples.sdeMedian === null) return null;

    const inferredSde = Math.round(askingPrice / multiples.sdeMedian);
    const inferredEbitda = Math.round(inferredSde * EBITDA_TO_SDE_RATIO);

    return {
      inferredEbitda,
      inferredSde,
      inferenceMethod: "CROSS_CHECK",
      inferenceConfidence: 0.40,
    };
  }

  // Estimate EBITDA from revenue using the industry margin
  const inferredEbitda = Math.round(revenue * multiples.ebitdaMarginMedian);

  // Cross-check: is the implied EBITDA multiple reasonable? (1x - 12x)
  const impliedEbitdaMultiple = inferredEbitda > 0 ? askingPrice / inferredEbitda : Infinity;
  if (impliedEbitdaMultiple < 1 || impliedEbitdaMultiple > 12) {
    // Numbers don't add up -- fall back to Method 3 at reduced confidence
    if (multiples.sdeMedian === null) return null;

    const inferredSde = Math.round(askingPrice / multiples.sdeMedian);
    const inferredEbitdaFallback = Math.round(inferredSde * EBITDA_TO_SDE_RATIO);

    return {
      inferredEbitda: inferredEbitdaFallback,
      inferredSde,
      inferenceMethod: "CROSS_CHECK",
      inferenceConfidence: 0.40,
    };
  }

  // Both checks passed -- use the revenue-derived estimate
  const inferredSde = Math.round(inferredEbitda * SDE_TO_EBITDA_RATIO);

  return {
    inferredEbitda,
    inferredSde,
    inferenceMethod: "CROSS_CHECK",
    inferenceConfidence: 0.70,
  };
}

// ─────────────────────────────────────────────
// Validation wrapper
// ─────────────────────────────────────────────

function applyValidation(
  result: InferenceResult,
  listing: InferenceInput,
): InferenceResult {
  return validateInference(result, {
    askingPrice: listing.askingPrice,
    revenue: listing.revenue,
  });
}

// ─────────────────────────────────────────────
// Threshold helper
// ─────────────────────────────────────────────

/**
 * Returns `true` if any of the four earnings values (reported or
 * inferred) meets the minimum threshold ($600k), OR if all four are
 * null (cannot determine -- include for manual review).
 */
export function meetsThreshold(listing: {
  ebitda: number | null;
  sde: number | null;
  inferredEbitda: number | null;
  inferredSde: number | null;
}): boolean {
  const values = [listing.ebitda, listing.sde, listing.inferredEbitda, listing.inferredSde];

  // If all are null, include for manual review
  if (values.every((v) => v === null)) {
    return true;
  }

  // Return true if ANY value meets the threshold
  return values.some((v) => v !== null && v >= MINIMUM_EBITDA);
}
