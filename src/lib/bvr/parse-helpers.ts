/**
 * Shared parsing helpers for BVR column mappers.
 */

/**
 * Parse a raw value into a number. Strips $, commas, whitespace.
 * Handles percentage strings like "45.2%" → 0.452 (divides by 100).
 * Passes through numeric values directly.
 */
export function parseNumber(
  val: string | number | null | undefined,
): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isFinite(val) ? val : null;

  const trimmed = String(val).trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "N/A" || trimmed === "n/a") {
    return null;
  }

  const isPercent = trimmed.endsWith("%");
  const cleaned = trimmed.replace(/[$,%\s]/g, "").replace(/,/g, "");
  const num = Number(cleaned);

  if (isNaN(num) || !isFinite(num)) return null;
  return isPercent ? num / 100 : num;
}

/**
 * Parse a raw value into a Date. Handles YYYY-MM-DD and MM/DD/YYYY formats.
 * Passes through Date objects directly.
 */
export function parseDate(
  val: string | number | null | undefined,
): Date | null {
  if (val === null || val === undefined) return null;

  const str = String(val).trim();
  if (str === "") return null;

  // Try MM/DD/YYYY first (common in US spreadsheets)
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try standard Date parsing (handles YYYY-MM-DD and other formats)
  const date = new Date(str);
  if (!isNaN(date.getTime())) return date;

  return null;
}

/**
 * Parse a raw value into a trimmed string. Returns null if empty.
 */
export function parseString(
  val: string | number | null | undefined,
): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Parse a raw value into an integer. Returns null if NaN.
 */
export function parseInt(
  val: string | number | null | undefined,
): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isFinite(val) ? Math.round(val) : null;

  const trimmed = String(val).trim().replace(/[$,\s]/g, "").replace(/,/g, "");
  const num = Number.parseInt(trimmed, 10);
  return isNaN(num) ? null : num;
}
