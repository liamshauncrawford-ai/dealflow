import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCronOrAuth } from "@/lib/auth-helpers";
import { runSearchProfile } from "@/lib/discovery/runner";

// ─────────────────────────────────────────────
// POST /api/cron/discovery-scan
// Runs all due search profiles and expires stale discovery listings.
// Auth: CRON_SECRET (external scheduler) or session cookie (dashboard).
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCronOrAuth(request);
    if (!authResult.authorized) return authResult.error;

    const now = new Date();

    // ── Step 1: Find due search profiles ──
    const dueProfiles = await prisma.searchProfile.findMany({
      where: {
        isEnabled: true,
        OR: [
          { nextRunAt: { lte: now } },
          { nextRunAt: null, lastRunAt: null }, // Never run before
        ],
      },
    });

    // ── Step 2: Run each profile ──
    const results = [];
    for (const profile of dueProfiles) {
      try {
        const result = await runSearchProfile(profile);
        results.push({
          profileId: profile.id,
          name: profile.name,
          newDiscoveries: result.newDiscoveries,
          skippedDuplicates: result.skippedDuplicates,
          errors: result.errors,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          profileId: profile.id,
          name: profile.name,
          newDiscoveries: 0,
          skippedDuplicates: 0,
          errors: [`Fatal: ${msg}`],
        });
      }
    }

    // ── Step 3: Expire old discovery listings ──
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const expired = await prisma.discoveryListing.updateMany({
      where: {
        status: "NEW",
        discoveredAt: { lt: thirtyDaysAgo },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return NextResponse.json({
      ran: dueProfiles.length,
      results,
      expired: expired.count,
    });
  } catch (error) {
    console.error("Discovery scan cron error:", error);
    return NextResponse.json(
      { error: "Discovery scan failed" },
      { status: 500 },
    );
  }
}
