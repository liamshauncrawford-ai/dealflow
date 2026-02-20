import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  runRecentDeduplication,
  autoMergeCandidates,
} from "@/lib/dedup/dedup-engine";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/dedup-scan
 * Runs deduplication on recent listings (last 7 days), then auto-merges
 * high-confidence duplicates. Creates notifications for manual review candidates.
 *
 * Protected by CRON_SECRET. Designed for weekly execution.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (CRON_SECRET && token !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agentRun = await prisma.aIAgentRun.create({
      data: { agentName: "dedup_scan", status: "running" },
    });

    // Step 1: Run dedup on recent listings
    const { candidatesFound, groupsCreated, errors } =
      await runRecentDeduplication(7);

    // Step 2: Auto-merge high-confidence duplicates
    let autoMerged = 0;
    try {
      autoMerged = await autoMergeCandidates();
    } catch (err) {
      errors.push(
        `Auto-merge error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Step 3: Count pending candidates that need manual review
    const pendingReview = await prisma.dedupCandidate.count({
      where: { status: "PENDING" },
    });

    // Step 4: Create notification if there are candidates needing review
    if (candidatesFound > autoMerged && pendingReview > 0) {
      await prisma.notification.create({
        data: {
          type: "ENRICHMENT_COMPLETE",
          title: `Dedup: ${pendingReview} candidates need review`,
          message: `Found ${candidatesFound} duplicate candidates, auto-merged ${autoMerged}. ${pendingReview} pairs pending manual review.`,
          priority: pendingReview > 10 ? "high" : "normal",
          entityType: "listing",
          actionUrl: "/settings/scraping",
        },
      });
    }

    // Finalize agent run
    await prisma.aIAgentRun.update({
      where: { id: agentRun.id },
      data: {
        status: errors.length > 0 ? "partial" : "success",
        itemsProcessed: candidatesFound,
        itemsCreated: groupsCreated,
        itemsUpdated: autoMerged,
        summary: `Dedup: ${candidatesFound} candidates, ${autoMerged} auto-merged, ${groupsCreated} groups, ${pendingReview} pending review`,
        errorMessage:
          errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Dedup scan complete",
      candidatesFound,
      groupsCreated,
      autoMerged,
      pendingReview,
      errors: errors.length,
    });
  } catch (error) {
    console.error("Dedup scan error:", error);

    try {
      const latestRun = await prisma.aIAgentRun.findFirst({
        where: { agentName: "dedup_scan", status: "running" },
        orderBy: { startedAt: "desc" },
      });
      if (latestRun) {
        await prisma.aIAgentRun.update({
          where: { id: latestRun.id },
          data: {
            status: "error",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          },
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      {
        error: "Dedup scan failed",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
