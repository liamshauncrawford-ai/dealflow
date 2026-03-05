/**
 * Centralized hex color config for all dashboard charts.
 *
 * Refined premium palette — coordinated indigo/violet tones
 * with warm accents for progression stages.
 */

// ── Pipeline Stage Colors ──

export const STAGE_COLORS: Record<string, string> = {
  CONTACTING: "#6366f1",           // Indigo
  REQUESTED_CIM: "#8b5cf6",       // Violet
  SIGNED_NDA: "#a78bfa",          // Light violet
  SCHEDULING_FIRST_MEETING: "#ec4899", // Rose
  DUE_DILIGENCE: "#f59e0b",       // Amber
  OFFER_SENT: "#f97316",          // Orange
  COUNTER_OFFER_RECEIVED: "#ef4444", // Red
  UNDER_CONTRACT: "#10b981",      // Emerald
  CLOSED_WON: "#059669",          // Green
  CLOSED_LOST: "#64748b",         // Slate
  ON_HOLD: "#94a3b8",             // Slate (lighter)
};

// ── Platform Colors ──

export const PLATFORM_COLORS: Record<string, string> = {
  BIZBUYSELL: "#6366f1",           // Indigo (primary)
  BIZQUEST: "#8b5cf6",             // Violet
  DEALSTREAM: "#10b981",           // Emerald
  TRANSWORLD: "#ef4444",           // Red
  LOOPNET: "#f59e0b",             // Amber
  BUSINESSBROKER: "#06b6d4",       // Cyan
  MANUAL: "#64748b",               // Slate
};

// ── Tier Colors ──

export const TIER_COLORS: Record<string, string> = {
  TIER_1_ACTIVE: "#10b981",        // Emerald
  TIER_2_WATCH: "#6366f1",         // Indigo
  TIER_3_DISQUALIFIED: "#ef4444",  // Red
  OWNED: "#a855f7",                // Purple
};

// ── Trade Colors ──

export const TRADE_COLORS: Record<string, string> = {
  ELECTRICAL: "#eab308",
  STRUCTURED_CABLING: "#f97316",
  SECURITY_FIRE_ALARM: "#ef4444",
  FRAMING_DRYWALL: "#94a3b8",
  HVAC_MECHANICAL: "#10b981",
  PLUMBING: "#6366f1",
  PAINTING_FINISHING: "#8b5cf6",
  CONCRETE_MASONRY: "#78716c",
  ROOFING: "#64748b",
  SITE_WORK: "#854d0e",
  GENERAL_COMMERCIAL: "#475569",
};

// ── Theme-Aware Colors for Axes, Grid, Tooltips ──

export function getThemeColors(isDark: boolean) {
  return {
    axis: isDark ? "#7c85a3" : "#64748b",
    grid: isDark ? "#1e2235" : "#e2e8f0",
    text: isDark ? "#c8cee0" : "#334155",
    tooltipBg: isDark ? "#111427" : "#ffffff",
    tooltipBorder: isDark ? "#1e2235" : "#e2e8f0",
    tooltipText: isDark ? "#f1f5f9" : "#0f172a",
    muted: isDark ? "#4a5068" : "#94a3b8",
  };
}
