import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface GraphNode {
  id: string;
  name: string;
  type: "gc" | "operator" | "target";
  val: number; // node size
  color: string;
  tier?: string | null;
  priority?: string | null;
  relationshipStatus?: string | null;
  compositeScore?: number | null;
}

interface GraphLink {
  source: string;
  target: string;
  type: "builds_for" | "qualified_sub" | "proximity";
  label?: string;
}

interface RelationshipGap {
  gcId: string;
  gcName: string;
  priority: string | null;
  facilityCount: number;
  hasQualifiedSub: boolean;
}

/**
 * GET /api/market-intel/network
 * Returns graph data: nodes (GCs, operators, targets), links, and relationship gaps.
 */
export async function GET() {
  try {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeIds = new Set<string>();

    // Fetch GCs with their facilities and opportunities
    const gcs = await prisma.generalContractor.findMany({
      include: {
        facilities: {
          include: { operator: { select: { id: true, name: true, tier: true } } },
        },
        cablingOpportunities: {
          where: { status: { notIn: ["COMPLETED", "LOST", "NO_BID"] } },
          select: { id: true, operatorId: true },
        },
      },
    });

    // Fetch operators
    const operators = await prisma.dataCenterOperator.findMany({
      select: { id: true, name: true, tier: true },
    });

    // Fetch active cabling-trade listings
    const targets = await prisma.listing.findMany({
      where: {
        isActive: true,
        compositeScore: { gte: 60 },
        primaryTrade: { in: ["STRUCTURED_CABLING", "SECURITY_SURVEILLANCE", "FIRE_ALARM", "ELECTRICAL"] },
      },
      select: { id: true, title: true, businessName: true, compositeScore: true, primaryTrade: true },
      take: 30,
      orderBy: { compositeScore: "desc" },
    });

    // Color mapping
    const operatorColors: Record<string, string> = {
      TIER_1_ACTIVE_CONSTRUCTION: "#ef4444",
      TIER_2_EXPANSION: "#f97316",
      TIER_3_EXISTING_MAINTENANCE: "#3b82f6",
      TIER_4_RUMORED: "#9ca3af",
    };

    const gcColors: Record<string, string> = {
      HIGHEST: "#1d4ed8",
      HIGH: "#2563eb",
      MODERATE: "#60a5fa",
      MONITOR: "#93c5fd",
    };

    // Add operator nodes
    for (const op of operators) {
      nodes.push({
        id: `op-${op.id}`,
        name: op.name,
        type: "operator",
        val: 15,
        color: operatorColors[op.tier ?? "TIER_4_RUMORED"] ?? "#9ca3af",
        tier: op.tier,
      });
      nodeIds.add(`op-${op.id}`);
    }

    // Add GC nodes and links
    for (const gc of gcs) {
      nodes.push({
        id: `gc-${gc.id}`,
        name: gc.name,
        type: "gc",
        val: 20,
        color: gcColors[gc.priority ?? "MONITOR"] ?? "#93c5fd",
        priority: gc.priority,
        relationshipStatus: gc.relationshipStatus,
      });
      nodeIds.add(`gc-${gc.id}`);

      // builds_for links: GC → Operator (via facilities)
      const linkedOperatorIds = new Set<string>();
      for (const fac of gc.facilities) {
        if (fac.operator && !linkedOperatorIds.has(fac.operator.id)) {
          linkedOperatorIds.add(fac.operator.id);
          links.push({
            source: `gc-${gc.id}`,
            target: `op-${fac.operator.id}`,
            type: "builds_for",
            label: "builds for",
          });
        }
      }

      // Also link via cabling opportunities
      for (const opp of gc.cablingOpportunities) {
        if (opp.operatorId && !linkedOperatorIds.has(opp.operatorId)) {
          linkedOperatorIds.add(opp.operatorId);
          if (nodeIds.has(`op-${opp.operatorId}`)) {
            links.push({
              source: `gc-${gc.id}`,
              target: `op-${opp.operatorId}`,
              type: "builds_for",
              label: "opportunity",
            });
          }
        }
      }
    }

    // Add target nodes
    for (const t of targets) {
      nodes.push({
        id: `target-${t.id}`,
        name: t.businessName ?? t.title ?? "Unknown",
        type: "target",
        val: 10,
        color: "#8b5cf6",
        compositeScore: t.compositeScore,
      });
      nodeIds.add(`target-${t.id}`);
    }

    // Identify gaps: GCs without qualified cabling subs
    const gaps: RelationshipGap[] = gcs
      .filter((gc) => gc.priority !== "MONITOR")
      .map((gc) => ({
        gcId: gc.id,
        gcName: gc.name,
        priority: gc.priority,
        facilityCount: gc.facilities.length,
        hasQualifiedSub: gc.subQualificationStatus === "QUALIFIED" || gc.subQualificationStatus === "PREFERRED",
      }))
      .filter((g) => !g.hasQualifiedSub);

    return NextResponse.json({ nodes, links, gaps });
  } catch (error) {
    console.error("Network graph error:", error);
    return NextResponse.json({ error: "Failed to build network graph" }, { status: 500 });
  }
}
