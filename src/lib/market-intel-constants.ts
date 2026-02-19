// Market Intelligence display constants — mirrors the pattern in src/lib/constants.ts

export const OPERATOR_TIERS = {
  TIER_1_ACTIVE_CONSTRUCTION: { label: "Active Construction", color: "bg-red-500", badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  TIER_2_EXPANSION: { label: "Expansion Plans", color: "bg-orange-500", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  TIER_3_EXISTING_MAINTENANCE: { label: "Existing / Maintenance", color: "bg-blue-500", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  TIER_4_RUMORED: { label: "Rumored / Scouting", color: "bg-gray-500", badge: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
} as const;

export const GC_PRIORITIES = {
  HIGHEST: { label: "Highest", color: "bg-red-500", badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  HIGH: { label: "High", color: "bg-orange-500", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  MODERATE: { label: "Moderate", color: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  MONITOR: { label: "Monitor", color: "bg-gray-500", badge: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
} as const;

export const GC_DC_EXPERIENCE = {
  SPECIALIST: { label: "DC Specialist" },
  EXPERIENCED: { label: "Experienced" },
  SOME: { label: "Some Experience" },
  NONE: { label: "None" },
} as const;

export const SUB_QUALIFICATION_STATUS = {
  NOT_APPLIED: { label: "Not Applied", badge: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
  APPLICATION_SUBMITTED: { label: "Application Submitted", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  QUALIFIED: { label: "Qualified", badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  PREFERRED: { label: "Preferred Sub", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  REJECTED: { label: "Rejected", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
} as const;

export const OPERATOR_RELATIONSHIP_STATUS = {
  NO_CONTACT: { label: "No Contact" },
  IDENTIFIED: { label: "Identified" },
  INTRODUCTION_MADE: { label: "Introduction Made" },
  MEETING_HELD: { label: "Meeting Held" },
  RFQ_RECEIVED: { label: "RFQ Received" },
  BID_SUBMITTED: { label: "Bid Submitted" },
  CONTRACT_AWARDED: { label: "Contract Awarded" },
  ACTIVE_WORK: { label: "Active Work" },
} as const;

export const GC_RELATIONSHIP_STATUS = {
  NO_CONTACT: { label: "No Contact" },
  IDENTIFIED: { label: "Identified" },
  INTRODUCTION_MADE: { label: "Introduction Made" },
  MEETING_HELD: { label: "Meeting Held" },
  BID_INVITED: { label: "Bid Invited" },
  WORK_IN_PROGRESS: { label: "Work In Progress" },
} as const;

export const FACILITY_STATUS = {
  OPERATING: { label: "Operating", badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  UNDER_CONSTRUCTION: { label: "Under Construction", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  PLANNED: { label: "Planned", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  RUMORED: { label: "Rumored", badge: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
} as const;

export const CABLING_STATUSES = {
  IDENTIFIED: { label: "Identified", badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  PRE_RFQ: { label: "Pre-RFQ", badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  RFQ_RECEIVED: { label: "RFQ Received", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  ESTIMATING: { label: "Estimating", badge: "bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  BID_SUBMITTED: { label: "Bid Submitted", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  BID_UNDER_REVIEW: { label: "Under Review", badge: "bg-purple-200 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  AWARDED: { label: "Awarded", badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  CONTRACT_NEGOTIATION: { label: "Negotiating", badge: "bg-green-200 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  MOBILIZING: { label: "Mobilizing", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  IN_PROGRESS: { label: "In Progress", badge: "bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  PUNCH_LIST: { label: "Punch List", badge: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  COMPLETED: { label: "Completed", badge: "bg-emerald-300 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200" },
  LOST: { label: "Lost", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  NO_BID: { label: "No Bid", badge: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
} as const;

export const CABLING_SCOPES = {
  BACKBONE_FIBER: { label: "Backbone Fiber" },
  HORIZONTAL_COPPER: { label: "Horizontal Copper (Cat6A)" },
  CABLE_TRAY_PATHWAY: { label: "Cable Tray / Pathway" },
  CABINET_RACK_INSTALL: { label: "Cabinet & Rack Install" },
  MEET_ME_ROOM: { label: "Meet-Me Room / Cross-Connect" },
  SECURITY_ACCESS_CONTROL: { label: "Security / Access Control" },
  CCTV_SURVEILLANCE: { label: "CCTV / Surveillance" },
  ENVIRONMENTAL_MONITORING: { label: "Environmental Monitoring" },
  TESTING_CERTIFICATION: { label: "Testing & Certification" },
  OTHER: { label: "Other" },
} as const;

// Cabling scope value estimates by MW tier (from thesis Section 4)
export const CABLING_VALUE_BY_MW: Array<{ range: string; minMW: number; maxMW: number; low: number; high: number; duration: string }> = [
  { range: "2–5 MW", minMW: 2, maxMW: 5, low: 100_000, high: 500_000, duration: "2–6 months" },
  { range: "10–20 MW", minMW: 10, maxMW: 20, low: 500_000, high: 2_000_000, duration: "4–12 months" },
  { range: "20–40 MW", minMW: 20, maxMW: 40, low: 1_000_000, high: 4_000_000, duration: "6–18 months" },
  { range: "50–100 MW", minMW: 50, maxMW: 100, low: 2_000_000, high: 8_000_000, duration: "12–24 months" },
  { range: "100+ MW", minMW: 100, maxMW: 999, low: 5_000_000, high: 15_000_000, duration: "Multi-year" },
];

/** Estimate cabling value range from facility MW */
export function estimateCablingValue(mw: number): { low: number; high: number } | null {
  const tier = CABLING_VALUE_BY_MW.find((t) => mw >= t.minMW && mw <= t.maxMW);
  if (!tier) {
    // Below minimum or above lookup — interpolate
    if (mw < 2) return { low: 50_000, high: 200_000 };
    return { low: 5_000_000, high: 15_000_000 };
  }
  return { low: tier.low, high: tier.high };
}

export type OperatorTierKey = keyof typeof OPERATOR_TIERS;
export type GCPriorityKey = keyof typeof GC_PRIORITIES;
export type CablingStatusKey = keyof typeof CABLING_STATUSES;
export type FacilityStatusKey = keyof typeof FACILITY_STATUS;
