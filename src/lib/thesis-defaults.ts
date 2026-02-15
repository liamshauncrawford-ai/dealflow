/**
 * Thesis Configuration — Defaults & Type Definitions
 *
 * All configurable parameters for the acquisition thesis.
 * These defaults are used when no DB overrides exist in AppSetting.
 */

import { FIT_SCORE_WEIGHTS } from "@/lib/constants";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ThesisConfig {
  /** Which pipeline stages count toward "Pipeline Value" */
  pipelineValueStages: string[];

  /** Specific listing ID designated as "platform" company (null = use tier=OWNED) */
  platformListingId: string | null;

  /** Low exit multiple for platform valuation (e.g. 7x) */
  exitMultipleLow: number;

  /** High exit multiple for platform valuation (e.g. 10x) */
  exitMultipleHigh: number;

  /** Minimum EBITDA threshold for active listings filter */
  minimumEbitda: number;

  /** Minimum SDE threshold for active listings filter */
  minimumSde: number;

  /** Fit score category weights (must sum to 1.0) */
  fitScoreWeights: Record<string, number>;
}

// ─────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────

export const THESIS_DEFAULTS: ThesisConfig = {
  pipelineValueStages: [
    "SIGNED_NDA",
    "DUE_DILIGENCE",
    "OFFER_SENT",
    "COUNTER_OFFER_RECEIVED",
    "UNDER_CONTRACT",
  ],
  platformListingId: null,
  exitMultipleLow: 7,
  exitMultipleHigh: 10,
  minimumEbitda: 600_000,
  minimumSde: 600_000,
  fitScoreWeights: { ...FIT_SCORE_WEIGHTS },
};

// ─────────────────────────────────────────────
// Key Mapping (config field → AppSetting key)
// ─────────────────────────────────────────────

export const THESIS_KEYS: Record<keyof ThesisConfig, string> = {
  pipelineValueStages: "thesis.pipelineValueStages",
  platformListingId: "thesis.platformListingId",
  exitMultipleLow: "thesis.exitMultipleLow",
  exitMultipleHigh: "thesis.exitMultipleHigh",
  minimumEbitda: "thesis.minimumEbitda",
  minimumSde: "thesis.minimumSde",
  fitScoreWeights: "thesis.fitScoreWeights",
};

// All pipeline stages that can be selected for pipeline value
export const SELECTABLE_PIPELINE_STAGES = [
  "CONTACTING",
  "REQUESTED_CIM",
  "SIGNED_NDA",
  "DUE_DILIGENCE",
  "OFFER_SENT",
  "COUNTER_OFFER_RECEIVED",
  "UNDER_CONTRACT",
] as const;

// Human-readable labels for fit score weight categories
export const FIT_SCORE_WEIGHT_LABELS: Record<string, string> = {
  OWNER_AGE_RETIREMENT: "Owner Age / Retirement",
  TRADE_FIT: "Trade Fit",
  REVENUE_SIZE: "Revenue Size",
  YEARS_IN_BUSINESS: "Years in Business",
  GEOGRAPHIC_FIT: "Geographic Fit",
  RECURRING_REVENUE: "Recurring Revenue",
  CROSS_SELL_SYNERGY: "Cross-Sell Synergy",
  KEY_PERSON_RISK: "Key Person Risk",
  CERTIFICATIONS: "Certifications",
  VALUATION_FIT: "Valuation Fit",
};
