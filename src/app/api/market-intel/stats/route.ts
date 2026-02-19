import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [
      operatorCount,
      facilityCount,
      gcCount,
      opportunityCount,
      tier1Operators,
      activeCablingOpps,
      facilitiesUnderConstruction,
      totalPipelineValue,
      awardedValue,
      statusBreakdown,
    ] = await Promise.all([
      prisma.dataCenterOperator.count(),
      prisma.dCFacility.count(),
      prisma.generalContractor.count(),
      prisma.cablingOpportunity.count(),
      prisma.dataCenterOperator.count({
        where: { tier: "TIER_1_ACTIVE_CONSTRUCTION" },
      }),
      prisma.cablingOpportunity.count({
        where: {
          status: {
            in: [
              "IDENTIFIED", "PRE_RFQ", "RFQ_RECEIVED", "ESTIMATING",
              "BID_SUBMITTED", "BID_UNDER_REVIEW", "AWARDED",
              "CONTRACT_NEGOTIATION", "MOBILIZING", "IN_PROGRESS", "PUNCH_LIST",
            ],
          },
        },
      }),
      prisma.dCFacility.count({
        where: { status: "UNDER_CONSTRUCTION" },
      }),
      // Sum estimated value for active pipeline (non-terminal statuses)
      prisma.cablingOpportunity.aggregate({
        _sum: { estimatedValue: true },
        where: {
          status: {
            notIn: ["COMPLETED", "LOST", "NO_BID"],
          },
        },
      }),
      // Sum awarded value for won opportunities
      prisma.cablingOpportunity.aggregate({
        _sum: { awardedValue: true },
        where: {
          status: {
            in: ["AWARDED", "CONTRACT_NEGOTIATION", "MOBILIZING", "IN_PROGRESS", "PUNCH_LIST", "COMPLETED"],
          },
        },
      }),
      // Count by status for pipeline chart
      prisma.cablingOpportunity.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { estimatedValue: true },
      }),
    ]);

    return NextResponse.json({
      operatorCount,
      facilityCount,
      gcCount,
      opportunityCount,
      tier1Operators,
      activeCablingOpps,
      facilitiesUnderConstruction,
      totalPipelineValue: totalPipelineValue._sum.estimatedValue ?? 0,
      awardedValue: awardedValue._sum.awardedValue ?? 0,
      statusBreakdown: statusBreakdown.map((s) => ({
        status: s.status,
        count: s._count.id,
        estimatedValue: s._sum.estimatedValue ?? 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching market intel stats:", error);
    return NextResponse.json({ error: "Failed to fetch market intel stats" }, { status: 500 });
  }
}
