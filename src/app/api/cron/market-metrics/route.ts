import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCronOrAuth } from "@/lib/auth-helpers";

/**
 * POST /api/cron/market-metrics
 * Daily aggregation of market metrics into the MarketMetric model.
 * Auth: CRON_SECRET (external scheduler) or session cookie (dashboard).
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCronOrAuth(request);
    if (!authResult.authorized) return authResult.error;

    const agentRun = await prisma.aIAgentRun.create({
      data: { agentName: "market_metrics", status: "running" },
    });

    // Aggregate facility MW by status
    const facilityStats = await prisma.dCFacility.groupBy({
      by: ["status"],
      _sum: { capacityMW: true },
      _count: true,
    });

    const mwByStatus: Record<string, number> = {};
    let totalFacilities = 0;
    for (const stat of facilityStats) {
      mwByStatus[stat.status ?? "UNKNOWN"] = stat._sum.capacityMW ?? 0;
      totalFacilities += stat._count;
    }

    const totalMwOperating = mwByStatus["OPERATING"] ?? 0;
    const totalMwUnderConstruction = mwByStatus["UNDER_CONSTRUCTION"] ?? 0;
    const totalMwPlanned = (mwByStatus["PLANNED"] ?? 0) + (mwByStatus["RUMORED"] ?? 0);

    // Active construction projects (facilities under construction)
    const activeConstruction = facilityStats.find((s) => s.status === "UNDER_CONSTRUCTION")?._count ?? 0;

    // Estimated cabling TAM: rough $50K/MW for operating, $150K/MW for construction, $100K/MW for planned
    const estimatedCablingTam =
      totalMwOperating * 50_000 +
      totalMwUnderConstruction * 150_000 +
      totalMwPlanned * 100_000;

    // GC coverage: % of high-priority GCs with relationship status beyond NO_CONTACT
    const gcTotal = await prisma.generalContractor.count({
      where: { priority: { in: ["HIGHEST", "HIGH"] } },
    });
    const gcEngaged = await prisma.generalContractor.count({
      where: {
        priority: { in: ["HIGHEST", "HIGH"] },
        relationshipStatus: { notIn: ["NO_CONTACT", "IDENTIFIED"] },
      },
    });
    const gcCoveragePct = gcTotal > 0 ? (gcEngaged / gcTotal) * 100 : 0;

    // Weighted pipeline value
    const pipelineAgg = await prisma.cablingOpportunity.aggregate({
      where: { status: { notIn: ["COMPLETED", "LOST", "NO_BID"] } },
      _sum: { weightedValue: true },
    });
    const weightedPipelineValue = pipelineAgg._sum.weightedValue
      ? Number(pipelineAgg._sum.weightedValue)
      : 0;

    // Targets tracked and actionable
    const targetsTracked = await prisma.listing.count({ where: { isActive: true } });
    const actionableTargets = await prisma.listing.count({
      where: { isActive: true, compositeScore: { gte: 60 } },
    });

    // Store metric
    await prisma.marketMetric.create({
      data: {
        recordedAt: new Date(),
        totalMwOperating,
        totalMwUnderConstruction,
        totalMwPlanned,
        activeConstructionProjects: activeConstruction,
        estimatedCablingTam: estimatedCablingTam,
        gcCoveragePct,
        weightedPipelineValue,
        targetsTracked,
        actionableTargets,
      },
    });

    // Finalize agent run
    await prisma.aIAgentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "success",
        itemsProcessed: totalFacilities,
        summary: `Metrics: ${totalMwOperating + totalMwUnderConstruction + totalMwPlanned} MW total, ${activeConstruction} active, $${Math.round(weightedPipelineValue / 1000)}K pipeline`,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Market metrics recorded",
      totalMwOperating,
      totalMwUnderConstruction,
      totalMwPlanned,
      activeConstruction,
      estimatedCablingTam,
      gcCoveragePct: Math.round(gcCoveragePct),
      weightedPipelineValue,
      targetsTracked,
      actionableTargets,
    });
  } catch (error) {
    console.error("Market metrics cron error:", error);

    try {
      const latestRun = await prisma.aIAgentRun.findFirst({
        where: { agentName: "market_metrics", status: "running" },
        orderBy: { startedAt: "desc" },
      });
      if (latestRun) {
        await prisma.aIAgentRun.update({
          where: { id: latestRun.id },
          data: {
            status: "error",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          },
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      { error: "Market metrics failed", detail: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
