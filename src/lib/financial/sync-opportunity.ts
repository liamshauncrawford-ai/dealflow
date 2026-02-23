/**
 * Syncs computed FinancialPeriod data → Opportunity flat fields.
 *
 * Called after every line-item / add-back mutation so the Overview tab
 * and any other consumer of Opportunity.actualRevenue / actualEbitda
 * always reflects the latest financial data.
 *
 * Non-fatal: callers should wrap in try/catch so a sync failure
 * never blocks the primary mutation.
 */
import { prisma } from "@/lib/db";
import { RevenueTrend } from "@prisma/client";

export async function syncOpportunitySummary(opportunityId: string): Promise<void> {
  const annualPeriods = await prisma.financialPeriod.findMany({
    where: { opportunityId, periodType: "ANNUAL" },
    orderBy: { year: "desc" },
    select: {
      year: true,
      totalRevenue: true,
      ebitda: true,
      adjustedEbitda: true,
      ebitdaMargin: true,
      adjustedEbitdaMargin: true,
    },
  });

  if (annualPeriods.length === 0) return;

  const mostRecent = annualPeriods[0];

  // Compute revenue trend from two most recent years
  let revenueTrend: RevenueTrend | null = null;
  if (annualPeriods.length >= 2 && mostRecent.totalRevenue && annualPeriods[1].totalRevenue) {
    const recent = Number(mostRecent.totalRevenue);
    const prior = Number(annualPeriods[1].totalRevenue);
    if (prior > 0) {
      const yoyGrowth = (recent - prior) / prior;
      revenueTrend =
        yoyGrowth > 0.05
          ? RevenueTrend.GROWING
          : yoyGrowth < -0.05
            ? RevenueTrend.DECLINING
            : RevenueTrend.STABLE;
    }
  }

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      actualRevenue: mostRecent.totalRevenue ?? undefined,
      actualEbitda: mostRecent.adjustedEbitda ?? mostRecent.ebitda ?? undefined,
      actualEbitdaMargin: mostRecent.adjustedEbitdaMargin ?? mostRecent.ebitdaMargin ?? undefined,
      ...(revenueTrend ? { revenueTrend } : {}),
    },
  });
}
