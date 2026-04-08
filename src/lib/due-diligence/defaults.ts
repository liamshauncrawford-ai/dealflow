/**
 * Default due diligence checklist items, seeded per listing on first access.
 *
 * Stage gating maps to PipelineStage enum:
 *   PRE_NDA  → visible when any opportunity exists
 *   POST_NDA → unlocks at SIGNED_NDA or later
 *   LOI_DD   → unlocks at DUE_DILIGENCE or later
 */

export interface DefaultDDItem {
  stage: "PRE_NDA" | "POST_NDA" | "LOI_DD";
  itemText: string;
  order: number;
}

export const DEFAULT_DD_ITEMS: DefaultDDItem[] = [
  // Pre-NDA (6 items)
  { stage: "PRE_NDA", itemText: "Verify listing is still active", order: 1 },
  { stage: "PRE_NDA", itemText: "Confirm geographic location within Denver metro", order: 2 },
  { stage: "PRE_NDA", itemText: "Identify owner name and contact information", order: 3 },
  { stage: "PRE_NDA", itemText: "Check for public records of litigation", order: 4 },
  { stage: "PRE_NDA", itemText: "Check if owner is active on LinkedIn", order: 5 },
  { stage: "PRE_NDA", itemText: "Cross-reference with BVR comparable transactions", order: 6 },

  // Post-NDA (10 items)
  { stage: "POST_NDA", itemText: "Request 3 years of tax returns / P&L statements", order: 1 },
  { stage: "POST_NDA", itemText: "Verify MRR by reviewing active contracts", order: 2 },
  { stage: "POST_NDA", itemText: "Confirm client concentration (no single client >15%)", order: 3 },
  { stage: "POST_NDA", itemText: "Request technician org chart", order: 4 },
  { stage: "POST_NDA", itemText: "Verify Colorado licensing", order: 5 },
  { stage: "POST_NDA", itemText: "Request accounts receivable aging report", order: 6 },
  { stage: "POST_NDA", itemText: "Confirm SBA eligibility", order: 7 },
  { stage: "POST_NDA", itemText: "Obtain key employee list and tenure", order: 8 },
  { stage: "POST_NDA", itemText: "Understand owner's transition timeline", order: 9 },
  { stage: "POST_NDA", itemText: "Request list of top 10 clients with revenue per client", order: 10 },

  // LOI / Due Diligence (8 items)
  { stage: "LOI_DD", itemText: "Engage M&A attorney", order: 1 },
  { stage: "LOI_DD", itemText: "Engage CPA for Quality of Earnings review", order: 2 },
  { stage: "LOI_DD", itemText: "SBA lender pre-approval confirmation", order: 3 },
  { stage: "LOI_DD", itemText: "Environmental/title review on any real property", order: 4 },
  { stage: "LOI_DD", itemText: "Employment agreement review", order: 5 },
  { stage: "LOI_DD", itemText: "Client contract assignability review", order: 6 },
  { stage: "LOI_DD", itemText: "Non-compete agreement drafted", order: 7 },
  { stage: "LOI_DD", itemText: "Key employee retention plan", order: 8 },
];

const LATE_STAGES = new Set([
  "DUE_DILIGENCE", "OFFER_SENT", "COUNTER_OFFER_RECEIVED", "UNDER_CONTRACT", "CLOSED_WON",
]);

const NDA_AND_LATER = new Set([
  "SIGNED_NDA", "SCHEDULING_FIRST_MEETING", "DUE_DILIGENCE",
  "OFFER_SENT", "COUNTER_OFFER_RECEIVED", "UNDER_CONTRACT", "CLOSED_WON",
]);

export function isStageUnlocked(ddStage: string, pipelineStage: string | null): boolean {
  if (!pipelineStage) return ddStage === "PRE_NDA";
  if (ddStage === "PRE_NDA") return true;
  if (ddStage === "POST_NDA") return NDA_AND_LATER.has(pipelineStage);
  if (ddStage === "LOI_DD") return LATE_STAGES.has(pipelineStage);
  return false;
}
