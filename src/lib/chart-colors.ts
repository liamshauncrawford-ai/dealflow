/**
 * Centralized hex color config for all dashboard charts.
 *
 * Stage colors match globals.css CSS vars.
 * Platform/tier/trade colors match constants.ts.
 */

// ── Pipeline Stage Colors (from globals.css) ──

export const STAGE_COLORS: Record<string, string> = {
  CONTACTING: "#3b82f6",
  REQUESTED_CIM: "#8b5cf6",
  SIGNED_NDA: "#d946ef",
  DUE_DILIGENCE: "#f59e0b",
  OFFER_SENT: "#f97316",
  COUNTER_OFFER_RECEIVED: "#ef4444",
  UNDER_CONTRACT: "#16a34a",
  CLOSED_WON: "#059669",
  CLOSED_LOST: "#6b7280",
  ON_HOLD: "#9ca3af",
};

// ── Platform Colors (from constants.ts) ──

export const PLATFORM_COLORS: Record<string, string> = {
  BIZBUYSELL: "#2563eb",
  BIZQUEST: "#7c3aed",
  DEALSTREAM: "#059669",
  TRANSWORLD: "#dc2626",
  LOOPNET: "#d97706",
  BUSINESSBROKER: "#0891b2",
  MANUAL: "#6b7280",
};

// ── Tier Colors ──

export const TIER_COLORS: Record<string, string> = {
  TIER_1_ACTIVE: "#22c55e",
  TIER_2_WATCH: "#3b82f6",
  TIER_3_DISQUALIFIED: "#ef4444",
  OWNED: "#a855f7",
};

// ── Trade Colors (from constants.ts) ──

export const TRADE_COLORS: Record<string, string> = {
  ELECTRICAL: "#eab308",
  STRUCTURED_CABLING: "#f97316",
  SECURITY_FIRE_ALARM: "#ef4444",
  FRAMING_DRYWALL: "#a3a3a3",
  HVAC_MECHANICAL: "#22c55e",
  PLUMBING: "#3b82f6",
  PAINTING_FINISHING: "#8b5cf6",
  CONCRETE_MASONRY: "#78716c",
  ROOFING: "#64748b",
  SITE_WORK: "#854d0e",
  GENERAL_COMMERCIAL: "#6b7280",
};

// ── Theme-Aware Colors for Axes, Grid, Tooltips ──

export function getThemeColors(isDark: boolean) {
  return {
    axis: isDark ? "#a1a1aa" : "#71717a",
    grid: isDark ? "#27272a" : "#e4e4e7",
    text: isDark ? "#d4d4d8" : "#3f3f46",
    tooltipBg: isDark ? "#18181b" : "#ffffff",
    tooltipBorder: isDark ? "#3f3f46" : "#e4e4e7",
    tooltipText: isDark ? "#fafafa" : "#09090b",
    muted: isDark ? "#71717a" : "#a1a1aa",
  };
}
