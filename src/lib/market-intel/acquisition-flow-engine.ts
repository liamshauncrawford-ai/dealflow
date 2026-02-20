import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { haversineDistance } from "./proximity";

const CABLING_TRADES = [
  "STRUCTURED_CABLING",
  "SECURITY_SURVEILLANCE",
  "FIRE_ALARM",
  "ELECTRICAL",
];

/**
 * When a pipeline opportunity moves to OFFER_SENT or UNDER_CONTRACT,
 * evaluate how acquiring this target affects GC sub-qualification
 * and accessible cabling opportunity value.
 */
export async function executeAcquisitionFlowTrigger(
  opportunityId: string,
  toStage: string
): Promise<void> {
  // Get the opportunity with its listing
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          primaryTrade: true,
          secondaryTrades: true,
          latitude: true,
          longitude: true,
          city: true,
          state: true,
        },
      },
    },
  });

  if (!opportunity?.listing) return;

  const { listing } = opportunity;
  const trades = [listing.primaryTrade, ...(listing.secondaryTrades ?? [])].filter(Boolean);

  // Only proceed if this is a cabling-relevant acquisition
  const hasCablingTrade = trades.some((t) => CABLING_TRADES.includes(t!));
  if (!hasCablingTrade) return;

  // Find GCs where this listing's trade qualifies for sub-qualification
  const gcs = await prisma.generalContractor.findMany({
    where: {
      subQualificationStatus: { in: ["NOT_APPLIED", "APPLICATION_SUBMITTED"] },
      facilities: {
        some: {
          latitude: { not: null },
          longitude: { not: null },
        },
      },
    },
    include: {
      facilities: {
        select: { latitude: true, longitude: true, facilityName: true },
        where: { latitude: { not: null }, longitude: { not: null } },
      },
    },
  });

  const qualifiedGcIds: string[] = [];

  for (const gc of gcs) {
    // Check if listing is within 75mi of any GC facility
    if (!listing.latitude || !listing.longitude) continue;

    const nearestFacility = gc.facilities.reduce(
      (best, f) => {
        const dist = haversineDistance(
          listing.latitude!,
          listing.longitude!,
          f.latitude!,
          f.longitude!
        );
        return dist < best.distance ? { facility: f, distance: dist } : best;
      },
      { facility: gc.facilities[0], distance: Infinity }
    );

    if (nearestFacility.distance <= 75) {
      qualifiedGcIds.push(gc.id);

      // Upgrade qualification status if we're under contract
      if (toStage === "UNDER_CONTRACT") {
        await prisma.generalContractor.update({
          where: { id: gc.id },
          data: {
            subQualificationStatus: "APPLICATION_SUBMITTED",
          },
        });
      }
    }
  }

  // Calculate accessible pipeline value
  const accessibleOpportunities = await prisma.cablingOpportunity.findMany({
    where: {
      gcId: { in: qualifiedGcIds },
      status: { notIn: ["COMPLETED", "LOST", "NO_BID"] },
    },
    select: { estimatedValue: true, weightedValue: true },
  });

  const accessiblePipelineValue = accessibleOpportunities.reduce(
    (sum, o) => sum + (o.weightedValue ? Number(o.weightedValue) : 0),
    0
  );

  const accessibleEstimatedValue = accessibleOpportunities.reduce(
    (sum, o) => sum + (o.estimatedValue ? Number(o.estimatedValue) : 0),
    0
  );

  // Create notification summarizing the portfolio impact
  if (qualifiedGcIds.length > 0 || accessibleOpportunities.length > 0) {
    const stageLabel = toStage === "OFFER_SENT" ? "Offer sent" : "Under contract";

    await prisma.notification.create({
      data: {
        type: NotificationType.DC_PROJECT_NEWS,
        title: `${stageLabel}: ${listing.title?.slice(0, 60)} — portfolio impact`,
        message: [
          `${qualifiedGcIds.length} GC(s) gain sub-qualification potential.`,
          `Unlocks $${Math.round(accessibleEstimatedValue / 1000)}K estimated / $${Math.round(accessiblePipelineValue / 1000)}K weighted pipeline.`,
          `${accessibleOpportunities.length} cabling opportunities become accessible.`,
        ].join(" "),
        priority: accessiblePipelineValue > 500_000 ? "high" : "normal",
        entityType: "opportunity",
        entityId: opportunityId,
        actionUrl: `/pipeline/${opportunityId}`,
      },
    });
  }
}
