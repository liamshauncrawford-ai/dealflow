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

// ─────────────────────────────────────────────
// NOTIFICATION TYPES — Display config
// ─────────────────────────────────────────────

export const NOTIFICATION_TYPE_CONFIG: Record<string, { label: string; priority: string }> = {
  NEW_LISTING: { label: "New Listing", priority: "normal" },
  LISTING_UPDATED: { label: "Listing Updated", priority: "normal" },
  LISTING_REMOVED: { label: "Listing Removed", priority: "low" },
  COOKIE_EXPIRED: { label: "Cookie Expired", priority: "normal" },
  SCRAPE_FAILED: { label: "Scrape Failed", priority: "normal" },
  DEDUP_CANDIDATE: { label: "Duplicate Detected", priority: "normal" },
  EMAIL_RECEIVED: { label: "Email Received", priority: "normal" },
  IMPORT: { label: "Import Complete", priority: "normal" },
  ACCESS_REQUEST: { label: "Access Request", priority: "high" },
  // AI & Intelligence types
  HIGH_SCORE_DISCOVERY: { label: "High-Score Target Discovered", priority: "high" },
  INDUSTRY_NEWS: { label: "Industry Update", priority: "normal" },
  SCORE_CHANGE: { label: "Target Score Changed", priority: "normal" },
  ENRICHMENT_COMPLETE: { label: "Company Research Complete", priority: "normal" },
  WEEKLY_BRIEF: { label: "Weekly Intelligence Brief", priority: "normal" },
  LEGISLATION_UPDATE: { label: "Legislative Update", priority: "normal" },
  AGENT_ERROR: { label: "Agent Error", priority: "high" },
};

// Thesis alignment display
export const THESIS_ALIGNMENT_CONFIG: Record<string, { label: string; color: string }> = {
  strong: { label: "Strong Fit", color: "text-green-700 bg-green-100" },
  moderate: { label: "Moderate Fit", color: "text-yellow-700 bg-yellow-100" },
  weak: { label: "Weak Fit", color: "text-orange-700 bg-orange-100" },
  disqualified: { label: "Disqualified", color: "text-red-700 bg-red-100" },
};

// Recommended action display
export const RECOMMENDED_ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  pursue_immediately: { label: "Pursue Immediately", color: "text-green-700 bg-green-100" },
  research_further: { label: "Research Further", color: "text-blue-700 bg-blue-100" },
  monitor: { label: "Monitor", color: "text-yellow-700 bg-yellow-100" },
  pass: { label: "Pass", color: "text-red-700 bg-red-100" },
};

export const DEFAULT_METRO_AREA = "Denver Metro";
export const DEFAULT_STATE = "CO";

// ─────────────────────────────────────────────
// TRADE CATEGORIES — Broadened commercial services
// ─────────────────────────────────────────────

export const PRIMARY_TRADES = {
  ELECTRICAL: { label: "Electrical", color: "#eab308" },
  STRUCTURED_CABLING: { label: "Structured Cabling / Low-Voltage", color: "#f97316" },
  SECURITY_FIRE_ALARM: { label: "Security / Fire Alarm", color: "#ef4444" },
  FRAMING_DRYWALL: { label: "Framing / Drywall", color: "#a3a3a3" },
  HVAC_MECHANICAL: { label: "HVAC / Mechanical", color: "#22c55e" },
  PLUMBING: { label: "Plumbing", color: "#3b82f6" },
  PAINTING_FINISHING: { label: "Painting / Finishing", color: "#8b5cf6" },
  CONCRETE_MASONRY: { label: "Concrete / Masonry", color: "#78716c" },
  ROOFING: { label: "Roofing", color: "#64748b" },
  SITE_WORK: { label: "Site Work / Excavation", color: "#854d0e" },
  GENERAL_COMMERCIAL: { label: "General / Other", color: "#6b7280" },
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

// ─────────────────────────────────────────────
// SCORING — 10-factor deterministic fit score
// Phase 4 will consolidate into 7 categories:
//   OWNER_SUCCESSION, FINANCIAL_HEALTH, STRATEGIC_FIT,
//   OPERATIONAL_QUALITY, GROWTH_POTENTIAL, DEAL_FEASIBILITY,
//   CERTIFICATION_VALUE
// ─────────────────────────────────────────────

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

// All trades are target trades in the broadened thesis
export const TARGET_TRADES: PrimaryTradeKey[] = [
  "ELECTRICAL",
  "STRUCTURED_CABLING",
  "SECURITY_FIRE_ALARM",
  "FRAMING_DRYWALL",
  "HVAC_MECHANICAL",
  "PLUMBING",
];

// Lower-priority but still relevant trades
export const SECONDARY_TARGET_TRADES: PrimaryTradeKey[] = [
  "PAINTING_FINISHING",
  "CONCRETE_MASONRY",
  "ROOFING",
  "SITE_WORK",
];

export const TARGET_STATES = ["CO"];
export const TARGET_METROS = ["Denver Metro", "Colorado Springs", "Front Range", "Fort Collins", "Boulder"];
export const NEIGHBORING_STATES = ["WY", "NE", "KS", "NM", "UT"];

/**
 * Thesis-targeted search queries for BizBuySell scraping.
 *
 * BizBuySell supports two filtering mechanisms:
 *   1. Category URL paths: /colorado-{category}-businesses-for-sale/
 *   2. Keyword search: ?q_kw={keyword}
 *
 * Each entry is a separate search that the scraper will execute.
 * Broadened to cover ALL commercial service contractor categories.
 */
export const THESIS_SEARCH_QUERIES: Array<{
  label: string;
  /** BizBuySell category slug (replaces "businesses" in URL path) */
  categorySlug?: string;
  /** Keyword search term (appended as ?q_kw=) */
  keyword?: string;
  /** Max items to pull per search */
  maxItems?: number;
}> = [
  // Electrical
  { label: "Electrical Contractor", categorySlug: "electrical-contractor", maxItems: 50 },
  { label: "Commercial Electrician", keyword: "commercial electrician" },
  // Structured cabling / low-voltage
  { label: "Structured Cabling", keyword: "structured cabling" },
  { label: "Low Voltage", keyword: "low voltage" },
  { label: "Fiber Optic", keyword: "fiber optic" },
  // Security & fire alarm
  { label: "Security Systems", keyword: "security systems" },
  { label: "Fire Alarm", keyword: "fire alarm" },
  { label: "Fire Protection", keyword: "fire protection" },
  { label: "Access Control", keyword: "access control" },
  // Framing / drywall
  { label: "Framing Contractor", keyword: "framing contractor" },
  { label: "Drywall Contractor", keyword: "drywall contractor" },
  // HVAC / mechanical
  { label: "HVAC Contractor", keyword: "HVAC contractor" },
  { label: "Mechanical Contractor", keyword: "mechanical contractor" },
  // Plumbing
  { label: "Plumbing Contractor", keyword: "plumbing contractor" },
  // Other commercial trades
  { label: "Painting Contractor", keyword: "commercial painter" },
  { label: "Roofing Contractor", keyword: "roofing contractor" },
  { label: "Concrete Contractor", keyword: "concrete contractor" },
  // General commercial
  { label: "Construction Subcontractor", keyword: "construction subcontractor" },
  { label: "Specialty Contractor", keyword: "specialty contractor" },
];
