/**
 * Shared utility for mapping target business (Listing) data into
 * financial model inputs across the Valuation, Roll-Up, and Comparison pages.
 *
 * Centralizes the EBITDA fallback chain and display formatting so all
 * financial pages behave consistently.
 */

import type { ValuationInputs } from "./valuation-engine";
import type { RollupCompany } from "./rollup-engine";

// ─────────────────────────────────────────────
// Listing summary shape (matches API response)
// ─────────────────────────────────────────────

export interface ListingSummary {
  id: string;
  businessName: string | null;
  title: string | null;
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  cashFlow: number | null;
  askingPrice: number | null;
  compositeScore: number | null;
  inferredEbitda: number | null;
  inferredSde: number | null;
  city: string | null;
  state: string | null;
  established: number | null;
  employees: number | null;
  industry: string | null;
  primaryTrade: string | null;
  certifications: string[] | null;
  tier: string | null;
  thesisAlignment: string | null;
  enrichmentStatus: string | null;
  revenueConfidence: string | null;
}

// ─────────────────────────────────────────────
// EBITDA fallback chain
// ─────────────────────────────────────────────

/**
 * Resolves the best available EBITDA figure through a priority chain:
 * reported EBITDA → reported SDE → inferred EBITDA → inferred SDE → 0
 */
export function resolveEbitda(listing: ListingSummary): number {
  return (
    Number(listing.ebitda) ||
    Number(listing.sde) ||
    Number(listing.inferredEbitda) ||
    Number(listing.inferredSde) ||
    0
  );
}

/**
 * Returns a label describing the EBITDA source for data quality indicators.
 */
export function ebitdaSourceLabel(listing: ListingSummary): string {
  if (listing.ebitda) return "Reported EBITDA";
  if (listing.sde) return "Reported SDE";
  if (listing.inferredEbitda) return "Inferred EBITDA";
  if (listing.inferredSde) return "Inferred SDE";
  return "No data";
}

// ─────────────────────────────────────────────
// Valuation mapping
// ─────────────────────────────────────────────

/**
 * Maps a listing into valuation inputs, merging with existing defaults.
 * Only overrides fields where the listing has data — preserves manual inputs.
 */
export function mapListingToValuationInputs(
  listing: ListingSummary,
  defaults: ValuationInputs,
): ValuationInputs {
  const revenue = Number(listing.revenue) || 0;
  const ebitda = resolveEbitda(listing);
  const margin = revenue > 0 ? ebitda / revenue : 0;
  const askingPrice = Number(listing.askingPrice) || 0;

  // Derive entry multiple from asking price / EBITDA if both are available
  const derivedMultiple =
    askingPrice > 0 && ebitda > 0
      ? Math.round((askingPrice / ebitda) * 10) / 10 // Round to 1 decimal
      : null;

  return {
    ...defaults,
    target_revenue: revenue,
    target_ebitda: ebitda,
    target_ebitda_margin: margin,
    // Only override entry multiple if we can meaningfully derive it (2x-8x range)
    entry_multiple:
      derivedMultiple !== null && derivedMultiple >= 2 && derivedMultiple <= 8
        ? derivedMultiple
        : defaults.entry_multiple,
  };
}

// ─────────────────────────────────────────────
// Roll-Up mapping
// ─────────────────────────────────────────────

/**
 * Maps a listing into a RollupCompany for platform or bolt-on slots.
 */
export function mapListingToRollupCompany(
  listing: ListingSummary,
  defaults: Partial<RollupCompany> = {},
): RollupCompany {
  const ebitda = resolveEbitda(listing);
  const askingPrice = Number(listing.askingPrice) || 0;

  // Derive entry multiple from asking price / EBITDA if both are available
  const derivedMultiple =
    askingPrice > 0 && ebitda > 0
      ? Math.round((askingPrice / ebitda) * 10) / 10
      : null;

  return {
    id: defaults.id ?? listing.id,
    name: listing.businessName || listing.title || "Unnamed",
    revenue: Number(listing.revenue) || 0,
    ebitda,
    entry_multiple:
      derivedMultiple !== null && derivedMultiple >= 2 && derivedMultiple <= 6
        ? derivedMultiple
        : defaults.entry_multiple ?? 3.5,
    close_year: defaults.close_year ?? 1,
  };
}

// ─────────────────────────────────────────────
// Comparison mapping
// ─────────────────────────────────────────────

/**
 * Maps a listing into valuation inputs for the comparison matrix.
 * Uses standard defaults (4x entry, 7x exit) for apples-to-apples comparison.
 */
export function buildComparisonInputs(
  listing: ListingSummary,
  standardDefaults: ValuationInputs,
): ValuationInputs {
  const revenue = Number(listing.revenue) || 0;
  const ebitda = resolveEbitda(listing);
  return {
    ...standardDefaults,
    target_revenue: revenue,
    target_ebitda: ebitda,
    target_ebitda_margin: revenue > 0 ? ebitda / revenue : 0,
  };
}

// ─────────────────────────────────────────────
// Dropdown display formatting
// ─────────────────────────────────────────────

function fmtCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Formats a listing for display in a dropdown option, showing key financial context.
 * Example: "SPC Communications — $5M rev, $800K EBITDA (Score: 85)"
 */
export function formatListingOption(listing: ListingSummary): string {
  const name = listing.businessName || listing.title || "Unnamed";
  const parts: string[] = [name];

  const details: string[] = [];
  const revenue = Number(listing.revenue) || 0;
  const ebitda = resolveEbitda(listing);

  if (revenue > 0) details.push(`${fmtCompact(revenue)} rev`);
  if (ebitda > 0) details.push(`${fmtCompact(ebitda)} EBITDA`);
  if (listing.city && listing.state) details.push(`${listing.city}, ${listing.state}`);
  else if (listing.state) details.push(listing.state);

  if (details.length > 0) parts.push(details.join(", "));

  if (listing.compositeScore) parts.push(`(Score: ${listing.compositeScore})`);

  return parts.join(" — ");
}
