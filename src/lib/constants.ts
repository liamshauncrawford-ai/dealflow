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
