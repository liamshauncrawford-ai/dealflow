/**
 * Statistical math utilities shared across BVR dashboard, comps, and Priority A routes.
 */

/**
 * Compute the p-th percentile of a pre-sorted numeric array using linear interpolation.
 * @param sorted - Array of numbers in ascending order
 * @param p - Percentile (0–100), e.g. 25 for P25, 50 for median
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}
