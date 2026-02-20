import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PERIOD_DAYS: Record<string, number> = {
  "30d": 30,
  "90d": 90,
  "6m": 180,
  "1y": 365,
};

/**
 * GET /api/market-intel/metrics?period=90d
 * Returns time-series MarketMetric records + latest snapshot + change from prior.
 */
export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get("period") ?? "90d";
    const days = PERIOD_DAYS[period] ?? 90;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const metrics = await prisma.marketMetric.findMany({
      where: { recordedAt: { gte: since } },
      orderBy: { recordedAt: "asc" },
    });

    // Latest metric
    const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;

    // Prior metric (one before latest)
    const prior = metrics.length > 1 ? metrics[metrics.length - 2] : null;

    // Calculate change
    const change = latest && prior
      ? {
          totalMwOperating: (latest.totalMwOperating ?? 0) - (prior.totalMwOperating ?? 0),
          totalMwUnderConstruction: (latest.totalMwUnderConstruction ?? 0) - (prior.totalMwUnderConstruction ?? 0),
          weightedPipelineValue: Number(latest.weightedPipelineValue ?? 0) - Number(prior.weightedPipelineValue ?? 0),
          gcCoveragePct: (latest.gcCoveragePct ?? 0) - (prior.gcCoveragePct ?? 0),
          actionableTargets: (latest.actionableTargets ?? 0) - (prior.actionableTargets ?? 0),
        }
      : null;

    // Serialize metrics for JSON
    const series = metrics.map((m) => ({
      id: m.id,
      recordedAt: m.recordedAt.toISOString(),
      totalMwOperating: m.totalMwOperating,
      totalMwUnderConstruction: m.totalMwUnderConstruction,
      totalMwPlanned: m.totalMwPlanned,
      activeConstructionProjects: m.activeConstructionProjects,
      estimatedCablingTam: m.estimatedCablingTam,
      gcCoveragePct: m.gcCoveragePct,
      weightedPipelineValue: m.weightedPipelineValue,
      targetsTracked: m.targetsTracked,
      actionableTargets: m.actionableTargets,
    }));

    return NextResponse.json({
      period,
      series,
      latest: latest
        ? {
            totalMwOperating: latest.totalMwOperating,
            totalMwUnderConstruction: latest.totalMwUnderConstruction,
            totalMwPlanned: latest.totalMwPlanned,
            activeConstructionProjects: latest.activeConstructionProjects,
            estimatedCablingTam: latest.estimatedCablingTam,
            gcCoveragePct: latest.gcCoveragePct,
            weightedPipelineValue: latest.weightedPipelineValue,
            targetsTracked: latest.targetsTracked,
            actionableTargets: latest.actionableTargets,
          }
        : null,
      change,
      count: series.length,
    });
  } catch (error) {
    console.error("Market metrics query error:", error);
    return NextResponse.json({ error: "Failed to fetch market metrics" }, { status: 500 });
  }
}
