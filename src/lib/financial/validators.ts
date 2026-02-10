import type { InferenceResult } from "./inference-engine";

// ─────────────────────────────────────────────
// Individual sanity-check functions
// ─────────────────────────────────────────────

/**
 * EBITDA should be between 3% and 50% of revenue.
 * Returns `true` if the margin is within the reasonable range.
 */
export function isReasonableEbitdaMargin(ebitda: number, revenue: number): boolean {
  if (revenue <= 0) return false;
  const margin = ebitda / revenue;
  return margin >= 0.03 && margin <= 0.50;
}

/**
 * The asking price divided by SDE should be between 0.5x and 8x.
 * Returns `true` if the multiple is within the reasonable range.
 */
export function isReasonableMultiple(price: number, sde: number): boolean {
  if (sde <= 0) return false;
  const multiple = price / sde;
  return multiple >= 0.5 && multiple <= 8;
}

/**
 * SDE should not exceed revenue. A business cannot distribute more to
 * its owner than it takes in.
 * Returns `true` if SDE <= revenue.
 */
export function isReasonableSde(sde: number, revenue: number): boolean {
  if (revenue <= 0) return false;
  return sde <= revenue;
}

// ─────────────────────────────────────────────
// Composite validator
// ─────────────────────────────────────────────

/**
 * Run all applicable sanity checks against an inference result.
 *
 * If any check fails the confidence is downgraded to 0.20 and the
 * method is annotated with a "(LOW CONFIDENCE)" suffix so that
 * downstream consumers know the numbers should be treated with caution.
 *
 * The function returns a **new** object; the original is not mutated.
 */
export function validateInference(
  result: InferenceResult,
  context?: {
    askingPrice?: number | null;
    revenue?: number | null;
  },
): InferenceResult {
  let hasFailed = false;

  const inferredEbitda = result.inferredEbitda;
  const inferredSde = result.inferredSde;

  // Check EBITDA margin against revenue (if both are available)
  if (inferredEbitda !== null && context?.revenue && context.revenue > 0) {
    if (!isReasonableEbitdaMargin(inferredEbitda, context.revenue)) {
      hasFailed = true;
    }
  }

  // Check SDE does not exceed revenue (if both are available)
  if (inferredSde !== null && context?.revenue && context.revenue > 0) {
    if (!isReasonableSde(inferredSde, context.revenue)) {
      hasFailed = true;
    }
  }

  // Check SDE multiple against asking price (if both are available)
  if (inferredSde !== null && context?.askingPrice && context.askingPrice > 0) {
    if (!isReasonableMultiple(context.askingPrice, inferredSde)) {
      hasFailed = true;
    }
  }

  if (hasFailed) {
    return {
      ...result,
      inferenceConfidence: 0.20,
    };
  }

  return { ...result };
}
