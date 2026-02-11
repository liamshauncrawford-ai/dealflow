export const PIPELINE_STAGES = {
  CONTACTING: { label: "Contacting", color: "bg-stage-contacting", order: 1 },
  REQUESTED_CIM: { label: "Requested CIM", color: "bg-stage-cim", order: 2 },
  SIGNED_NDA: { label: "Signed NDA", color: "bg-stage-nda", order: 3 },
  DUE_DILIGENCE: { label: "Due Diligence", color: "bg-stage-diligence", order: 4 },
  OFFER_SENT: { label: "Offer Sent", color: "bg-stage-offer", order: 5 },
  COUNTER_OFFER_RECEIVED: { label: "Counter Offer", color: "bg-stage-counter", order: 6 },
  UNDER_CONTRACT: { label: "Under Contract", color: "bg-stage-contract", order: 7 },
  CLOSED_WON: { label: "Closed Won", color: "bg-stage-won", order: 8 },
  CLOSED_LOST: { label: "Closed Lost", color: "bg-stage-lost", order: 9 },
  ON_HOLD: { label: "On Hold", color: "bg-stage-hold", order: 10 },
} as const;

export type PipelineStageKey = keyof typeof PIPELINE_STAGES;

export const PLATFORMS = {
  BIZBUYSELL: { label: "BizBuySell", shortLabel: "BBS", color: "#2563eb" },
  BIZQUEST: { label: "BizQuest", shortLabel: "BQ", color: "#7c3aed" },
  DEALSTREAM: { label: "DealStream", shortLabel: "DS", color: "#059669" },
  TRANSWORLD: { label: "Transworld", shortLabel: "TW", color: "#dc2626" },
  LOOPNET: { label: "LoopNet", shortLabel: "LN", color: "#d97706" },
  BUSINESSBROKER: { label: "BusinessBroker.net", shortLabel: "BB", color: "#0891b2" },
  MANUAL: { label: "Manual Entry", shortLabel: "ME", color: "#6b7280" },
} as const;

export type PlatformKey = keyof typeof PLATFORMS;

export const PRIORITY_LEVELS = {
  LOW: { label: "Low", color: "text-muted-foreground" },
  MEDIUM: { label: "Medium", color: "text-info" },
  HIGH: { label: "High", color: "text-warning" },
  CRITICAL: { label: "Critical", color: "text-destructive" },
} as const;

export const INFERENCE_METHODS = {
  LISTED_MULTIPLE: {
    label: "Listed Multiple",
    description: "Calculated from the listing's own stated price-to-earnings multiple",
  },
  REVENUE_MARGIN: {
    label: "Revenue + Industry Margin",
    description: "Estimated using revenue and the industry's typical EBITDA margin",
  },
  PRICE_MULTIPLE: {
    label: "Price / Industry Multiple",
    description: "Estimated by dividing asking price by the industry's typical SDE multiple",
  },
  CROSS_CHECK: {
    label: "Revenue + Price Cross-Check",
    description: "Estimated using both revenue and asking price with industry benchmarks",
  },
  MANUAL: {
    label: "Manual Entry",
    description: "Manually entered by the user",
  },
} as const;

export const MINIMUM_EBITDA = 600_000;
export const MINIMUM_SDE = 600_000;

export const DEFAULT_METRO_AREA = "Denver Metro";
export const DEFAULT_STATE = "CO";

// ─────────────────────────────────────────────
// THESIS-SPECIFIC CONSTANTS
// ─────────────────────────────────────────────

export const PRIMARY_TRADES = {
  STRUCTURED_CABLING: { label: "Structured Cabling", color: "#f97316" },
  SECURITY_SURVEILLANCE: { label: "Security & Surveillance", color: "#64748b" },
  BUILDING_AUTOMATION_BMS: { label: "Building Automation / BMS", color: "#8b5cf6" },
  HVAC_CONTROLS: { label: "HVAC Controls", color: "#22c55e" },
  FIRE_ALARM: { label: "Fire Alarm", color: "#ef4444" },
  ELECTRICAL: { label: "Electrical", color: "#eab308" },
  AV_INTEGRATION: { label: "AV Integration", color: "#3b82f6" },
  MANAGED_IT_SERVICES: { label: "Managed IT Services", color: "#14b8a6" },
  OTHER: { label: "Other", color: "#6b7280" },
} as const;

export type PrimaryTradeKey = keyof typeof PRIMARY_TRADES;

export const TIERS = {
  TIER_1_ACTIVE: { label: "Tier 1 — Active", shortLabel: "Tier 1", bgColor: "bg-green-100", textColor: "text-green-800", dotColor: "bg-green-500" },
  TIER_2_WATCH: { label: "Tier 2 — Watch", shortLabel: "Tier 2", bgColor: "bg-blue-100", textColor: "text-blue-800", dotColor: "bg-blue-500" },
  TIER_3_DISQUALIFIED: { label: "Tier 3 — Disqualified", shortLabel: "Tier 3", bgColor: "bg-red-100", textColor: "text-red-800", dotColor: "bg-red-500" },
  OWNED: { label: "Owned (Platform)", shortLabel: "Owned", bgColor: "bg-purple-100", textColor: "text-purple-800", dotColor: "bg-purple-500" },
} as const;

export type TierKey = keyof typeof TIERS;

export const REVENUE_CONFIDENCES = {
  CONFIRMED: { label: "Confirmed" },
  ESTIMATED: { label: "Estimated" },
  UNKNOWN: { label: "Unknown" },
} as const;

export const OUTREACH_STATUSES = {
  NOT_CONTACTED: { label: "Not Contacted" },
  COLD_OUTREACH_SENT: { label: "Cold Outreach Sent" },
  WARM_INTRO_MADE: { label: "Warm Intro Made" },
  IN_DIALOGUE: { label: "In Dialogue" },
  LOI_STAGE: { label: "LOI Stage" },
  DUE_DILIGENCE: { label: "Due Diligence" },
  CLOSED: { label: "Closed" },
  DEAD: { label: "Dead" },
} as const;

export const CONTACT_SENTIMENTS = {
  COLD: { label: "Cold", color: "text-blue-700 bg-blue-50" },
  LUKEWARM: { label: "Lukewarm", color: "text-cyan-700 bg-cyan-50" },
  WARM: { label: "Warm", color: "text-amber-700 bg-amber-50" },
  HOT: { label: "Hot", color: "text-orange-700 bg-orange-50" },
  ENGAGED: { label: "Engaged", color: "text-green-700 bg-green-50" },
  COMMITTED: { label: "Committed", color: "text-emerald-700 bg-emerald-50" },
} as const;

// Fit Score Engine Weights (Section 8 of briefing)
export const FIT_SCORE_WEIGHTS = {
  OWNER_AGE_RETIREMENT: 0.20,
  TRADE_FIT: 0.15,
  REVENUE_SIZE: 0.10,
  YEARS_IN_BUSINESS: 0.10,
  GEOGRAPHIC_FIT: 0.10,
  RECURRING_REVENUE: 0.10,
  CROSS_SELL_SYNERGY: 0.10,
  KEY_PERSON_RISK: 0.05,
  CERTIFICATIONS: 0.05,
  VALUATION_FIT: 0.05,
} as const;

// Core target trades for the Colorado DC thesis
export const TARGET_TRADES: PrimaryTradeKey[] = [
  "STRUCTURED_CABLING",
  "SECURITY_SURVEILLANCE",
  "BUILDING_AUTOMATION_BMS",
];

// Secondary relevant trades
export const SECONDARY_TARGET_TRADES: PrimaryTradeKey[] = [
  "HVAC_CONTROLS",
  "FIRE_ALARM",
  "ELECTRICAL",
];

export const TARGET_STATES = ["CO"];
export const TARGET_METROS = ["Denver Metro", "Colorado Springs", "Front Range", "Fort Collins"];
export const NEIGHBORING_STATES = ["WY", "NE", "KS", "NM", "UT"];
