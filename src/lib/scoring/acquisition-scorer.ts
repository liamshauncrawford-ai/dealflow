/**
 * Acquisition Scoring Engine — 100-point scoring system for M&A targets.
 *
 * Three sub-scores:
 *   Financial (0-40) — margin, MRR, trend, concentration
 *   Strategic (0-35 cap) — rank, overlap, geography, owner situation
 *   Operator Fit (0-25 cap) — sales dependency, tech staff, SBA
 *
 * Includes 8 hard disqualifier rules that set score to 0 / tier "Inactive".
 */

import { prisma } from "@/lib/db";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AcquisitionScoreInput {
  targetRank: number | null;
  ebitda: number | null;
  revenue: number | null;
  askingPrice: number | null;
  mrrPctOfRevenue: number | null;
  revenueTrendDetail: string | null;
  topClientPct: number | null;
  clientIndustryOverlap: string | null;
  state: string | null;
  city: string | null;
  metroArea: string | null;
  ownerRetirementSignal: string | null;
  ownerIsPrimarySales: boolean | null;
  technicalStaffCount: number | null;
  sbaEligible: boolean | null;
  ownerIsSoleTech: boolean | null;
  clientBaseType: string | null;
  hasActiveLitigation: boolean | null;
  hasKeyManInsurance: boolean | null;
}

export interface SubScoreDetail {
  label: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface AcquisitionScoreResult {
  total: number;              // 0-100
  financialScore: number;     // 0-40
  strategicScore: number;     // 0-35 (capped)
  operatorScore: number;      // 0-25 (capped)
  tier: "A" | "B" | "C" | "Inactive";
  disqualifiers: string[];
  financialDetails: SubScoreDetail[];
  strategicDetails: SubScoreDetail[];
  operatorDetails: SubScoreDetail[];
}

export interface ScoringConfig {
  financial: {
    ebitdaMargin: { thresholds: number[]; points: number[] };
    mrrPct: { thresholds: number[]; points: number[] };
    revenueTrend: { values: Record<string, number> };
    clientConcentration: { thresholds: number[]; points: number[] };
  };
  strategic: {
    targetRank: { values: Record<string, number> };
    clientOverlap: { values: Record<string, number> };
    geography: {
      denverMetroCities: string[];
      points: Record<string, number>;
      neighboringStates: string[];
    };
    ownerSituation: { values: Record<string, number> };
    cap: number;
  };
  operatorFit: {
    ownerIsPrimarySales: Record<string, number>;
    technicalStaff: { thresholds: number[]; points: number[] };
    sbaEligible: Record<string, number>;
    cap: number;
  };
  tiers: Record<string, number>;
  disqualifiers: Record<string, unknown>;
  pms: { monthlyBurn: number; location: string; ownerSalaryForSdeAdjustment: number };
}

// ─────────────────────────────────────────────
// Config cache
// ─────────────────────────────────────────────

let cachedConfig: ScoringConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export async function loadScoringConfig(): Promise<ScoringConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const row = await prisma.appSetting.findUnique({
    where: { key: "acquisition_scoring_config" },
  });

  if (!row) {
    throw new Error(
      'AppSetting "acquisition_scoring_config" not found. Run the seed script first.',
    );
  }

  cachedConfig = row.value as unknown as ScoringConfig;
  cacheTimestamp = now;
  return cachedConfig;
}

export function clearScoringConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

// ─────────────────────────────────────────────
// Disqualifier checks
// ─────────────────────────────────────────────

export function checkDisqualifiers(
  input: AcquisitionScoreInput,
  config: ScoringConfig,
): string[] {
  const reasons: string[] = [];
  const dq = config.disqualifiers;

  // 1. Owner is sole tech
  if (input.ownerIsSoleTech === true) {
    reasons.push("Owner is the sole technical resource");
  }

  // 2. Single client concentration
  const topClientMax = (dq.topClientPctMax as number) ?? 0.4;
  if (input.topClientPct !== null && input.topClientPct > topClientMax) {
    reasons.push("Single client > 40% of revenue");
  }

  // 3. Revenue declining
  if (input.revenueTrendDetail === "Declining >10%") {
    reasons.push("Revenue declining >15% YoY for 2+ consecutive years");
  }

  // 4. Residential-only
  if (input.clientBaseType === "Residential") {
    reasons.push("Residential-only client base");
  }

  // 5. Outside Colorado (case-insensitive)
  if (input.state !== null) {
    const s = input.state.toUpperCase().trim();
    if (s !== "CO" && s !== "COLORADO") {
      reasons.push("Outside Colorado");
    }
  }

  // 6. Negative EBITDA (unless asking price < 100k — distressed bargain exception)
  if (
    input.ebitda !== null &&
    input.ebitda < 0 &&
    (input.askingPrice === null || input.askingPrice >= 100_000)
  ) {
    reasons.push("Negative EBITDA");
  }

  // 7. Active litigation
  if (input.hasActiveLitigation === true) {
    reasons.push("Active disclosed litigation");
  }

  // 8. Key man insurance lapse
  if (input.hasKeyManInsurance === false) {
    reasons.push("Key man insurance lapse without renewal");
  }

  return reasons;
}

// ─────────────────────────────────────────────
// Threshold helpers
// ─────────────────────────────────────────────

/**
 * Score a value against descending thresholds (higher value = better).
 * thresholds: [0.20, 0.15, 0.10, 0.05], points: [10, 8, 5, 0]
 * If value >= threshold[0] → points[0], etc.
 */
function scoreDescending(
  value: number | null,
  thresholds: number[],
  points: number[],
): number {
  if (value === null) return 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) return points[i];
  }
  return 0;
}

/**
 * Score a value against ascending thresholds (lower value = better).
 * thresholds: [0.10, 0.15, 0.25, 0.40], points: [10, 8, 5, 0]
 * If value <= threshold[0] → points[0], etc.
 */
function scoreAscending(
  value: number | null,
  thresholds: number[],
  points: number[],
): number {
  if (value === null) return 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value <= thresholds[i]) return points[i];
  }
  return 0;
}

// ─────────────────────────────────────────────
// Main scorer
// ─────────────────────────────────────────────

export function scoreAcquisitionTarget(
  input: AcquisitionScoreInput,
  config: ScoringConfig,
): AcquisitionScoreResult {
  // Check disqualifiers first
  const disqualifiers = checkDisqualifiers(input, config);
  if (disqualifiers.length > 0) {
    return {
      total: 0,
      financialScore: 0,
      strategicScore: 0,
      operatorScore: 0,
      tier: "Inactive",
      disqualifiers,
      financialDetails: [],
      strategicDetails: [],
      operatorDetails: [],
    };
  }

  // ── Financial (max 40) ──
  const financialDetails: SubScoreDetail[] = [];
  const fc = config.financial;

  // EBITDA margin
  const ebitdaMargin =
    input.ebitda !== null && input.revenue !== null && input.revenue > 0
      ? input.ebitda / input.revenue
      : null;
  const ebitdaMarginPts = scoreDescending(
    ebitdaMargin,
    fc.ebitdaMargin.thresholds,
    fc.ebitdaMargin.points,
  );
  financialDetails.push({
    label: "EBITDA Margin",
    points: ebitdaMarginPts,
    maxPoints: fc.ebitdaMargin.points[0],
    reason:
      ebitdaMargin !== null
        ? `${(ebitdaMargin * 100).toFixed(1)}% margin`
        : "No margin data",
  });

  // MRR %
  const mrrPts = scoreDescending(
    input.mrrPctOfRevenue,
    fc.mrrPct.thresholds,
    fc.mrrPct.points,
  );
  financialDetails.push({
    label: "MRR %",
    points: mrrPts,
    maxPoints: fc.mrrPct.points[0],
    reason:
      input.mrrPctOfRevenue !== null
        ? `${(input.mrrPctOfRevenue * 100).toFixed(1)}% recurring`
        : "No MRR data",
  });

  // Revenue trend
  const trendKey = input.revenueTrendDetail ?? "null";
  const trendPts = fc.revenueTrend.values[trendKey] ?? 0;
  financialDetails.push({
    label: "Revenue Trend",
    points: trendPts,
    maxPoints: Math.max(...Object.values(fc.revenueTrend.values)),
    reason: input.revenueTrendDetail ?? "No trend data",
  });

  // Client concentration (lower = better → ascending thresholds)
  const concPts = scoreAscending(
    input.topClientPct,
    fc.clientConcentration.thresholds,
    fc.clientConcentration.points,
  );
  financialDetails.push({
    label: "Client Concentration",
    points: concPts,
    maxPoints: fc.clientConcentration.points[0],
    reason:
      input.topClientPct !== null
        ? `Top client ${(input.topClientPct * 100).toFixed(0)}% of revenue`
        : "No concentration data",
  });

  const financialScore = ebitdaMarginPts + mrrPts + trendPts + concPts;

  // ── Strategic (raw max ~48, capped at config.strategic.cap) ──
  const strategicDetails: SubScoreDetail[] = [];
  const sc = config.strategic;

  // Target rank
  const rankKey = input.targetRank !== null ? String(input.targetRank) : "null";
  const rankPts = sc.targetRank.values[rankKey] ?? sc.targetRank.values["null"] ?? 0;
  strategicDetails.push({
    label: "Target Rank",
    points: rankPts,
    maxPoints: Math.max(...Object.values(sc.targetRank.values)),
    reason: input.targetRank !== null ? `Rank ${input.targetRank}` : "Unranked",
  });

  // Client overlap
  const overlapKey = input.clientIndustryOverlap ?? "";
  const overlapPts = sc.clientOverlap.values[overlapKey] ?? 0;
  strategicDetails.push({
    label: "Client Industry Overlap",
    points: overlapPts,
    maxPoints: Math.max(...Object.values(sc.clientOverlap.values)),
    reason: input.clientIndustryOverlap ?? "No overlap data",
  });

  // Geography
  const geo = sc.geography;
  let geoPts = 0;
  let geoReason = "Outside target area";

  const cityNorm = input.city?.toLowerCase().trim() ?? "";
  const metroNorm = input.metroArea?.toLowerCase().trim() ?? "";
  const stateNorm = input.state?.toUpperCase().trim() ?? "";

  const isDenverMetro =
    geo.denverMetroCities.some((c) => c.toLowerCase() === cityNorm) ||
    metroNorm.includes("denver");

  if (isDenverMetro) {
    geoPts = geo.points["denverMetro"] ?? 12;
    geoReason = "Denver metro area";
  } else if (stateNorm === "CO" || stateNorm === "COLORADO") {
    geoPts = geo.points["colorado"] ?? 8;
    geoReason = "Colorado (non-metro)";
  } else if (
    geo.neighboringStates.some((s) => s.toUpperCase() === stateNorm)
  ) {
    geoPts = geo.points["neighboringState"] ?? 5;
    geoReason = "Neighboring state";
  } else {
    geoPts = geo.points["other"] ?? 0;
    geoReason = "Outside target geography";
  }

  strategicDetails.push({
    label: "Geography",
    points: geoPts,
    maxPoints: geo.points["denverMetro"] ?? 12,
    reason: geoReason,
  });

  // Owner situation
  const ownerSitKey = input.ownerRetirementSignal ?? "";
  const ownerSitPts = sc.ownerSituation.values[ownerSitKey] ?? 0;
  strategicDetails.push({
    label: "Owner Situation",
    points: ownerSitPts,
    maxPoints: Math.max(...Object.values(sc.ownerSituation.values)),
    reason: input.ownerRetirementSignal ?? "No retirement signal",
  });

  const rawStrategic = rankPts + overlapPts + geoPts + ownerSitPts;
  const strategicScore = Math.min(rawStrategic, sc.cap);

  // ── Operator Fit (raw max ~36, capped at config.operatorFit.cap) ──
  const operatorDetails: SubScoreDetail[] = [];
  const oc = config.operatorFit;

  // Owner as primary salesperson
  const salesKey = String(input.ownerIsPrimarySales);
  const salesPts =
    oc.ownerIsPrimarySales[salesKey] ?? oc.ownerIsPrimarySales["null"] ?? 0;
  operatorDetails.push({
    label: "Owner as Primary Sales",
    points: salesPts,
    maxPoints: Math.max(...Object.values(oc.ownerIsPrimarySales)),
    reason:
      input.ownerIsPrimarySales === true
        ? "Owner is primary salesperson"
        : input.ownerIsPrimarySales === false
          ? "Dedicated sales team"
          : "Unknown sales structure",
  });

  // Technical staff
  const techPts = scoreDescending(
    input.technicalStaffCount,
    oc.technicalStaff.thresholds,
    oc.technicalStaff.points,
  );
  operatorDetails.push({
    label: "Technical Staff",
    points: techPts,
    maxPoints: oc.technicalStaff.points[0],
    reason:
      input.technicalStaffCount !== null
        ? `${input.technicalStaffCount} technical staff`
        : "No staffing data",
  });

  // SBA eligible
  const sbaKey = String(input.sbaEligible);
  const sbaPts = oc.sbaEligible[sbaKey] ?? oc.sbaEligible["null"] ?? 0;
  operatorDetails.push({
    label: "SBA Eligible",
    points: sbaPts,
    maxPoints: Math.max(...Object.values(oc.sbaEligible)),
    reason:
      input.sbaEligible === true
        ? "SBA eligible"
        : input.sbaEligible === false
          ? "Not SBA eligible"
          : "SBA eligibility unknown",
  });

  const rawOperator = salesPts + techPts + sbaPts;
  const operatorScore = Math.min(rawOperator, oc.cap);

  // ── Total & tier ──
  const total = Math.min(
    100,
    Math.max(0, financialScore + strategicScore + operatorScore),
  );

  const tiers = config.tiers;
  let tier: "A" | "B" | "C" | "Inactive";
  if (total >= (tiers["A"] ?? 80)) {
    tier = "A";
  } else if (total >= (tiers["B"] ?? 65)) {
    tier = "B";
  } else if (total >= (tiers["C"] ?? 50)) {
    tier = "C";
  } else {
    tier = "Inactive";
  }

  return {
    total,
    financialScore,
    strategicScore,
    operatorScore,
    tier,
    disqualifiers: [],
    financialDetails,
    strategicDetails,
    operatorDetails,
  };
}
