import { prisma } from "@/lib/db";

/**
 * Records a market metrics snapshot in the database.
 * Called automatically after scrape runs and daily scans.
 */
export async function recordMarketMetrics(): Promise<void> {
  const [targetsTracked, actionable, newListings, pipelineValue] = await Promise.all([
    prisma.listing.count({ where: { isHidden: false } }),
    prisma.listing.count({ where: { isHidden: false, compositeScore: { gte: 60 } } }),
    prisma.listing.count({
      where: {
        isHidden: false,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.opportunity.aggregate({
      where: { stage: { notIn: ["CLOSED_LOST", "CLOSED_WON"] } },
      _sum: { offerPrice: true },
    }),
  ]);

  await prisma.marketMetric.create({
    data: {
      recordedAt: new Date(),
      targetsTracked,
      actionableTargets: actionable,
      newListingsThisPeriod: newListings,
      weightedPipelineValue: pipelineValue._sum.offerPrice || 0,
    },
  });
}
