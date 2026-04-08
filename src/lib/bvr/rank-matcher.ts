/**
 * Match a SIC/NAICS code to a target rank (1-4).
 * Uses the same codes defined in AcquisitionThesisConfig.
 */

const RANK_SIC_CODES: Record<number, Set<string>> = {
  1: new Set(["7376", "7379", "7374"]),
  2: new Set(["4813", "7372", "7379", "4899"]),
  3: new Set(["7382", "7381", "1731", "5065"]),
  4: new Set(["1731", "1799", "1711"]),
};

const RANK_NAICS_CODES: Record<number, Set<string>> = {
  1: new Set(["541512", "541513", "541519", "518210"]),
  2: new Set(["517312", "517911", "541512", "519190"]),
  3: new Set(["561621", "238210", "423690"]),
  4: new Set(["238210", "238290", "561990"]),
};

/** Return the best (lowest number = highest priority) matching target rank, or null. */
export function matchTargetRank(
  sicCode: string | null,
  naicsCode: string | null,
): number | null {
  const matches: number[] = [];
  for (const [rank, codes] of Object.entries(RANK_SIC_CODES)) {
    if (sicCode && codes.has(sicCode.trim())) matches.push(Number(rank));
  }
  for (const [rank, codes] of Object.entries(RANK_NAICS_CODES)) {
    if (naicsCode && codes.has(naicsCode.trim())) matches.push(Number(rank));
  }
  return matches.length > 0 ? Math.min(...matches) : null;
}
