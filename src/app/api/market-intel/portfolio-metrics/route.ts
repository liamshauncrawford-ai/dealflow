import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/market-intel/portfolio-metrics
 * Returns accessible pipeline value, GC relationship counts, opportunity counts.
 */
export async function GET() {
  try {
    // GC relationship breakdown
    const gcsByStatus = await prisma.generalContractor.groupBy({
      by: ["relationshipStatus"],
      _count: true,
    });

    // Total qualified GCs
    const qualifiedGCs = await prisma.generalContractor.count({
      where: { subQualificationStatus: { in: ["QUALIFIED", "PREFERRED"] } },
    });

    // Active opportunities
    const activeOpportunities = await prisma.cablingOpportunity.count({
      where: { status: { notIn: ["COMPLETED", "LOST", "NO_BID"] } },
    });

    // Pipeline value
    const pipeline = await prisma.cablingOpportunity.aggregate({
      where: { status: { notIn: ["COMPLETED", "LOST", "NO_BID"] } },
      _sum: {
        estimatedValue: true,
        weightedValue: true,
      },
    });

    // Accessible value (where GC is qualified or better)
    const qualifiedGcIds = await prisma.generalContractor.findMany({
      where: { subQualificationStatus: { in: ["QUALIFIED", "PREFERRED"] } },
      select: { id: true },
    });

    const accessiblePipeline = await prisma.cablingOpportunity.aggregate({
      where: {
        gcId: { in: qualifiedGcIds.map((g) => g.id) },
        status: { notIn: ["COMPLETED", "LOST", "NO_BID"] },
      },
      _sum: {
        estimatedValue: true,
        weightedValue: true,
      },
    });

    // Pipeline targets in acquisition pipeline
    const targetsInPipeline = await prisma.opportunity.count({
      where: {
        stage: { notIn: ["CLOSED_LOST", "ON_HOLD"] },
        listing: {
          primaryTrade: { in: ["STRUCTURED_CABLING", "SECURITY_SURVEILLANCE", "FIRE_ALARM", "ELECTRICAL"] },
        },
      },
    });

    return NextResponse.json({
      gcRelationships: gcsByStatus.map((g) => ({
        status: g.relationshipStatus,
        count: g._count,
      })),
      qualifiedGCs,
      activeOpportunities,
      totalEstimatedValue: pipeline._sum.estimatedValue ? Number(pipeline._sum.estimatedValue) : 0,
      totalWeightedValue: pipeline._sum.weightedValue ? Number(pipeline._sum.weightedValue) : 0,
      accessibleEstimatedValue: accessiblePipeline._sum.estimatedValue
        ? Number(accessiblePipeline._sum.estimatedValue)
        : 0,
      accessibleWeightedValue: accessiblePipeline._sum.weightedValue
        ? Number(accessiblePipeline._sum.weightedValue)
        : 0,
      targetsInPipeline,
    });
  } catch (error) {
    console.error("Portfolio metrics error:", error);
    return NextResponse.json({ error: "Failed to fetch portfolio metrics" }, { status: 500 });
  }
}
