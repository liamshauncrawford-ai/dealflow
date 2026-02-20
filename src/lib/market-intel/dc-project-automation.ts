import { PrimaryTrade } from "@prisma/client";
import { prisma } from "@/lib/db";
import { haversineDistance, proximityScore, estimateCablingValueFromMW } from "./proximity";

const CABLING_TRADES: PrimaryTrade[] = [
  PrimaryTrade.STRUCTURED_CABLING,
  PrimaryTrade.SECURITY_SURVEILLANCE,
  PrimaryTrade.FIRE_ALARM,
  PrimaryTrade.ELECTRICAL,
];

interface ProcessDCArticleParams {
  newsItemId: string;
  headline: string;
  operatorNames: string[];
  gcNames: string[];
  estimatedCablingValue: number | null;
}

interface ProcessDCArticleResult {
  operatorIds: string[];
  gcIds: string[];
  opportunityId: string | null;
  surfacedTargetIds: string[];
}

/**
 * Process a dc_construction or gc_award article:
 * 1. Match/create operator and GC records
 * 2. Create CablingOpportunity
 * 3. Surface top acquisition targets near facilities
 */
export async function processDCConstructionArticle(
  params: ProcessDCArticleParams
): Promise<ProcessDCArticleResult> {
  const { newsItemId, headline, operatorNames, gcNames, estimatedCablingValue } = params;

  // Step 1: Match/create operators
  const operatorIds = await findOrCreateOperators(operatorNames);

  // Step 2: Match/create GCs
  const gcIds = await findOrCreateGCs(gcNames);

  // Step 3: Find a facility to anchor the opportunity
  // Look for facilities belonging to these operators
  let anchorFacility: { id: string; latitude: number | null; longitude: number | null; capacityMW: number | null } | null = null;
  if (operatorIds.length > 0) {
    anchorFacility = await prisma.dCFacility.findFirst({
      where: { operatorId: { in: operatorIds } },
      select: { id: true, latitude: true, longitude: true, capacityMW: true },
      orderBy: { capacityMW: "desc" },
    });
  }

  // Step 4: Create CablingOpportunity
  let opportunityId: string | null = null;
  const estValue = estimatedCablingValue
    ?? (anchorFacility?.capacityMW ? estimateCablingValueFromMW(anchorFacility.capacityMW) : null);

  if (operatorIds.length > 0 || gcIds.length > 0) {
    const opp = await prisma.cablingOpportunity.create({
      data: {
        name: headline.slice(0, 200),
        operatorId: operatorIds[0] ?? undefined,
        gcId: gcIds[0] ?? undefined,
        facilityId: anchorFacility?.id ?? undefined,
        estimatedValue: estValue,
        status: "IDENTIFIED",
        surfacedFromNewsId: newsItemId,
        description: `Auto-surfaced from news: "${headline}"`,
      },
    });
    opportunityId = opp.id;
  }

  // Step 5: Surface top targets near the facility
  let surfacedTargetIds: string[] = [];
  if (anchorFacility?.latitude && anchorFacility?.longitude) {
    surfacedTargetIds = await surfaceTopTargets(
      anchorFacility.latitude,
      anchorFacility.longitude,
      25
    );
  }

  return { operatorIds, gcIds, opportunityId, surfacedTargetIds };
}

/** Fuzzy match operators by name, create if not found */
async function findOrCreateOperators(names: string[]): Promise<string[]> {
  const ids: string[] = [];

  for (const name of names) {
    if (!name?.trim()) continue;
    const normalized = name.trim().toLowerCase();

    // Try exact-ish match first
    const existing = await prisma.dataCenterOperator.findFirst({
      where: {
        name: { contains: normalized, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existing) {
      ids.push(existing.id);
    } else {
      // Create new operator
      const created = await prisma.dataCenterOperator.create({
        data: {
          name: name.trim(),
          tier: "TIER_4_RUMORED",
          notes: "Auto-created from news article",
        },
      });
      ids.push(created.id);
    }
  }

  return ids;
}

/** Fuzzy match GCs by name, create if not found */
async function findOrCreateGCs(names: string[]): Promise<string[]> {
  const ids: string[] = [];

  for (const name of names) {
    if (!name?.trim()) continue;
    const normalized = name.trim().toLowerCase();

    const existing = await prisma.generalContractor.findFirst({
      where: {
        name: { contains: normalized, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existing) {
      ids.push(existing.id);
    } else {
      const created = await prisma.generalContractor.create({
        data: {
          name: name.trim(),
          priority: "MONITOR",
          notes: "Auto-created from news article",
        },
      });
      ids.push(created.id);
    }
  }

  return ids;
}

/**
 * Surface top acquisition targets near a lat/lng point.
 * Filters for cabling-relevant trades and compositeScore >= 50.
 * Returns top 3 by score * proximity bonus.
 */
async function surfaceTopTargets(
  lat: number,
  lng: number,
  maxDistanceMi: number
): Promise<string[]> {
  // Fetch active listings with cabling trades that have coordinates
  const listings = await prisma.listing.findMany({
    where: {
      isActive: true,
      primaryTrade: { in: CABLING_TRADES },
      compositeScore: { gte: 50 },
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      compositeScore: true,
    },
  });

  // Score each listing by composite score * proximity
  const scored = listings
    .map((l) => {
      const dist = haversineDistance(lat, lng, l.latitude!, l.longitude!);
      const proxScore = proximityScore(dist);
      return {
        id: l.id,
        distance: dist,
        effectiveScore: (l.compositeScore ?? 0) * (1 + proxScore / 10),
      };
    })
    .filter((l) => l.distance <= maxDistanceMi)
    .sort((a, b) => b.effectiveScore - a.effectiveScore)
    .slice(0, 3);

  return scored.map((s) => s.id);
}
