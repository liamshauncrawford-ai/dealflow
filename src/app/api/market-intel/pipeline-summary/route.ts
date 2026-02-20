import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { GC_RELATIONSHIP_STATUS } from "@/lib/market-intel-constants";

/**
 * GET /api/market-intel/pipeline-summary
 * Returns weighted pipeline value, breakdown by GC status, and top opportunities.
 */
export async function GET() {
  try {
    // Get all active opportunities with GC info
    const opportunities = await prisma.cablingOpportunity.findMany({
      where: {
        status: { notIn: ["COMPLETED", "LOST", "NO_BID"] },
      },
      include: {
        operator: { select: { name: true } },
        gc: { select: { name: true, relationshipStatus: true } },
        facility: { select: { facilityName: true, capacityMW: true } },
      },
      orderBy: { weightedValue: "desc" },
    });

    // Total weighted pipeline
    const totalWeightedValue = opportunities.reduce(
      (sum, o) => sum + (o.weightedValue ? Number(o.weightedValue) : 0),
      0
    );

    const totalEstimatedValue = opportunities.reduce(
      (sum, o) => sum + (o.estimatedValue ? Number(o.estimatedValue) : 0),
      0
    );

    // Breakdown by GC relationship status
    const byStatus: Record<string, { count: number; estimatedValue: number; weightedValue: number }> = {};
    for (const key of Object.keys(GC_RELATIONSHIP_STATUS)) {
      byStatus[key] = { count: 0, estimatedValue: 0, weightedValue: 0 };
    }

    for (const opp of opportunities) {
      const status = opp.gc?.relationshipStatus ?? "NO_CONTACT";
      if (!byStatus[status]) {
        byStatus[status] = { count: 0, estimatedValue: 0, weightedValue: 0 };
      }
      byStatus[status].count++;
      byStatus[status].estimatedValue += opp.estimatedValue ? Number(opp.estimatedValue) : 0;
      byStatus[status].weightedValue += opp.weightedValue ? Number(opp.weightedValue) : 0;
    }

    // Top 10 opportunities
    const topOpportunities = opportunities.slice(0, 10).map((o) => ({
      id: o.id,
      name: o.name,
      status: o.status,
      estimatedValue: o.estimatedValue ? Number(o.estimatedValue) : null,
      weightedValue: o.weightedValue ? Number(o.weightedValue) : null,
      winProbabilityPct: o.winProbabilityPct,
      operatorName: o.operator?.name ?? null,
      gcName: o.gc?.name ?? null,
      facilityName: o.facility?.facilityName ?? null,
    }));

    return NextResponse.json({
      totalOpportunities: opportunities.length,
      totalEstimatedValue,
      totalWeightedValue,
      byStatus,
      topOpportunities,
    });
  } catch (error) {
    console.error("Pipeline summary error:", error);
    return NextResponse.json({ error: "Failed to fetch pipeline summary" }, { status: 500 });
  }
}
