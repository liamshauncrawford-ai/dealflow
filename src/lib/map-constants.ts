// Map constants for Colorado Front Range data center visualization

/** Colorado Front Range center point (roughly Denver metro) */
export const COLORADO_CENTER = { lat: 39.6, lng: -104.85 } as const;

/** Default zoom to show the full Front Range (Co Springs to Fort Collins) */
export const DEFAULT_ZOOM = 8;

/** Zoom levels for different contexts */
export const ZOOM_LEVELS = {
  state: 7,       // Show full Colorado
  frontRange: 8,  // Denver → Springs → Fort Collins corridor
  metro: 10,      // Denver metro area
  facility: 14,   // Single facility detail
} as const;

/** Pin colors by operator tier — matches OPERATOR_TIERS in market-intel-constants.ts */
export const TIER_PIN_COLORS = {
  TIER_1_ACTIVE_CONSTRUCTION: { background: "#ef4444", glyph: "#ffffff", border: "#b91c1c" }, // red-500
  TIER_2_EXPANSION:           { background: "#f97316", glyph: "#ffffff", border: "#c2410c" }, // orange-500
  TIER_3_EXISTING_MAINTENANCE: { background: "#3b82f6", glyph: "#ffffff", border: "#1d4ed8" }, // blue-500
  TIER_4_RUMORED:             { background: "#6b7280", glyph: "#ffffff", border: "#374151" }, // gray-500
} as const;

/** Pin colors by facility status */
export const STATUS_PIN_COLORS = {
  OPERATING:          { background: "#22c55e", glyph: "#ffffff", border: "#15803d" }, // green-500
  UNDER_CONSTRUCTION: { background: "#f97316", glyph: "#ffffff", border: "#c2410c" }, // orange-500
  PLANNED:            { background: "#3b82f6", glyph: "#ffffff", border: "#1d4ed8" }, // blue-500
  RUMORED:            { background: "#6b7280", glyph: "#ffffff", border: "#374151" }, // gray-500
} as const;

/** Listing marker color (acquisition targets) */
export const LISTING_PIN_COLOR = { background: "#8b5cf6", glyph: "#ffffff", border: "#6d28d9" }; // purple

/** Scale marker size based on capacity MW */
export function getMarkerScale(capacityMW: number | null | undefined): number {
  if (!capacityMW || capacityMW <= 0) return 1.0;
  if (capacityMW < 10) return 1.0;
  if (capacityMW < 25) return 1.2;
  if (capacityMW < 50) return 1.4;
  if (capacityMW < 100) return 1.6;
  return 1.8; // 100+ MW hyperscale
}

export type OperatorTier = keyof typeof TIER_PIN_COLORS;
export type FacilityStatus = keyof typeof STATUS_PIN_COLORS;
