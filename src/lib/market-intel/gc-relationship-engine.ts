import { Prisma, PrimaryTrade } from "@prisma/client";
import { prisma } from "@/lib/db";
import { haversineDistance } from "./proximity";

/** Win probability by GC relationship status (deterministic) */
const WIN_PROBABILITY: Record<string, number> = {
  NO_CONTACT: 0.05,
  IDENTIFIED: 0.10,
  INTRODUCTION_MADE: 0.20,
  MEETING_HELD: 0.35,
  BID_INVITED: 0.55,
  WORK_IN_PROGRESS: 0.80,
};

/** Relationship strength boost for target scoring */
const RELATIONSHIP_BOOST: Record<string, number> = {
  NO_CONTACT: 0,
  IDENTIFIED: 2,
  INTRODUCTION_MADE: 5,
  MEETING_HELD: 8,
  BID_INVITED: 12,
  WORK_IN_PROGRESS: 15,
};

const CABLING_TRADES: PrimaryTrade[] = [
  PrimaryTrade.STRUCTURED_CABLING,
  PrimaryTrade.SECURITY_SURVEILLANCE,
  PrimaryTrade.FIRE_ALARM,
  PrimaryTrade.ELECTRICAL,
];

/** Return win probability (0.0 - 1.0) for a GC relationship status */
export function calculateWinProbability(status: string): number {
  return WIN_PROBABILITY[status] ?? 0.05;
}

/**
 * Recalculate winProbabilityPct and weightedValue on all CablingOpportunities
 * linked to a specific GC.
 */
export async function recalculatePipelineForGC(gcId: string): Promise<number> {
  const gc = await prisma.generalContractor.findUnique({
    where: { id: gcId },
    select: { relationshipStatus: true },
  });
  if (!gc) return 0;

  const winProb = calculateWinProbability(gc.relationshipStatus ?? "NO_CONTACT");

  const opportunities = await prisma.cablingOpportunity.findMany({
    where: { gcId },
    select: { id: true, estimatedValue: true },
  });

  let updated = 0;
  for (const opp of opportunities) {
    const estValue = opp.estimatedValue ? Number(opp.estimatedValue) : 0;
    const weighted = estValue * winProb;

    await prisma.cablingOpportunity.update({
      where: { id: opp.id },
      data: {
        winProbabilityPct: winProb * 100,
        weightedValue: new Prisma.Decimal(weighted.toFixed(2)),
      },
    });
    updated++;
  }

  return updated;
}

/**
 * Boost composite scores of acquisition targets that have cabling trades
 * and are geographically close to facilities this GC works on.
 */
export async function boostTargetsWithGCRelationship(gcId: string): Promise<number> {
  const gc = await prisma.generalContractor.findUnique({
    where: { id: gcId },
    select: {
      relationshipStatus: true,
      facilities: {
        select: { latitude: true, longitude: true },
        where: { latitude: { not: null }, longitude: { not: null } },
      },
    },
  });
  if (!gc || gc.facilities.length === 0) return 0;

  const boost = RELATIONSHIP_BOOST[gc.relationshipStatus ?? "NO_CONTACT"] ?? 0;
  if (boost === 0) return 0;

  // Get listings with cabling trades that have coordinates
  const listings = await prisma.listing.findMany({
    where: {
      isActive: true,
      primaryTrade: { in: CABLING_TRADES },
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { id: true, latitude: true, longitude: true },
  });

  let boosted = 0;
  for (const listing of listings) {
    // Check proximity to any GC facility (within 50mi)
    const nearFacility = gc.facilities.some(
      (f) =>
        haversineDistance(listing.latitude!, listing.longitude!, f.latitude!, f.longitude!) <= 50
    );

    if (nearFacility) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { gcRelationshipBoost: boost },
      });
      boosted++;
    }
  }

  return boosted;
}
