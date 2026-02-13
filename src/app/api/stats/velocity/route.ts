import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PIPELINE_STAGES } from "@/lib/constants";

/**
 * GET /api/stats/velocity
 *
 * Computes average days each deal spends in each pipeline stage.
 * Uses StageChange records to calculate time between transitions.
 *
 * Returns: Array<{ stage, label, avgDays, dealCount }>
 */
export async function GET() {
  try {
    // Get all stage changes ordered by opportunity and time
    const stageChanges = await prisma.stageChange.findMany({
      select: {
        opportunityId: true,
        fromStage: true,
        toStage: true,
        createdAt: true,
      },
      orderBy: [{ opportunityId: "asc" }, { createdAt: "asc" }],
    });

    // Also get current stage + createdAt for each opportunity
    const opportunities = await prisma.opportunity.findMany({
      select: {
        id: true,
        stage: true,
        createdAt: true,
      },
    });

    const oppMap = new Map(opportunities.map((o) => [o.id, o]));

    // Group stage changes by opportunity
    const changesByOpp = new Map<
      string,
      Array<{ fromStage: string; toStage: string; createdAt: Date }>
    >();

    for (const sc of stageChanges) {
      const list = changesByOpp.get(sc.opportunityId) ?? [];
      list.push(sc);
      changesByOpp.set(sc.opportunityId, list);
    }

    // Calculate days in each stage per opportunity
    // Accumulator: stage -> { totalDays, dealIds }
    const stageAccum = new Map<
      string,
      { totalDays: number; dealIds: Set<string> }
    >();

    for (const [oppId, changes] of changesByOpp.entries()) {
      const opp = oppMap.get(oppId);
      if (!opp) continue;

      for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        const stageKey = change.fromStage;

        // Start time: previous change's createdAt, or opportunity createdAt
        const startTime =
          i === 0
            ? opp.createdAt
            : changes[i - 1].createdAt;
        const endTime = change.createdAt;

        const days =
          (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);

        if (days >= 0) {
          const accum = stageAccum.get(stageKey) ?? {
            totalDays: 0,
            dealIds: new Set<string>(),
          };
          accum.totalDays += days;
          accum.dealIds.add(oppId);
          stageAccum.set(stageKey, accum);
        }
      }

      // Current stage: time from last change to now
      if (changes.length > 0) {
        const lastChange = changes[changes.length - 1];
        const currentStage = opp.stage;
        const days =
          (Date.now() - lastChange.createdAt.getTime()) /
          (1000 * 60 * 60 * 24);

        if (days >= 0) {
          const accum = stageAccum.get(currentStage) ?? {
            totalDays: 0,
            dealIds: new Set<string>(),
          };
          accum.totalDays += days;
          accum.dealIds.add(oppId);
          stageAccum.set(currentStage, accum);
        }
      }
    }

    // For opportunities with NO stage changes, count time in their current stage
    for (const opp of opportunities) {
      if (!changesByOpp.has(opp.id)) {
        const days =
          (Date.now() - opp.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const accum = stageAccum.get(opp.stage) ?? {
          totalDays: 0,
          dealIds: new Set<string>(),
        };
        accum.totalDays += days;
        accum.dealIds.add(opp.id);
        stageAccum.set(opp.stage, accum);
      }
    }

    // Build response sorted by pipeline stage order
    const velocity = Object.entries(PIPELINE_STAGES)
      .filter(([key]) => !["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(key))
      .map(([key, stage]) => {
        const accum = stageAccum.get(key);
        const dealCount = accum?.dealIds.size ?? 0;
        const avgDays =
          dealCount > 0
            ? Math.round((accum!.totalDays / dealCount) * 10) / 10
            : 0;

        return {
          stage: key,
          label: stage.label,
          avgDays,
          dealCount,
        };
      });

    return NextResponse.json({ velocity });
  } catch (error) {
    console.error("Error computing deal velocity:", error);
    return NextResponse.json(
      { error: "Failed to compute deal velocity" },
      { status: 500 },
    );
  }
}
