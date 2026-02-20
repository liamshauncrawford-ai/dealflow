import { NextRequest, NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  searchCsos,
  isAcquisitionSignal,
} from "@/lib/scrapers/csos-scraper";
import { csosEntityToRawListing } from "@/lib/scrapers/csos-helpers";
import { processScrapedListings } from "@/lib/scrapers/post-processor";
import type { RawListing, ScrapeResult } from "@/lib/scrapers/base-scraper";
import { requireCronOrAuth } from "@/lib/auth-helpers";

/**
 * POST /api/cron/csos-scan
 * Searches the Colorado Secretary of State for businesses matching
 * acquisition-relevant trade keywords. New entities become Listing records.
 * Auth: CRON_SECRET (external scheduler) or session cookie (dashboard).
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCronOrAuth(request);
    if (!authResult.authorized) return authResult.error;

    const agentRun = await prisma.aIAgentRun.create({
      data: { agentName: "csos_scan", status: "running" },
    });

    // Step 1: Search CSOS
    const { entities, errors: searchErrors, queriesRun } = await searchCsos();

    if (entities.length === 0) {
      await prisma.aIAgentRun.update({
        where: { id: agentRun.id },
        data: {
          status: searchErrors.length > 0 ? "partial" : "success",
          summary: `Searched ${queriesRun} terms, found 0 entities. ${searchErrors.length} errors.`,
          errorMessage: searchErrors.length > 0 ? searchErrors.join("; ") : null,
          completedAt: new Date(),
        },
      });
      return NextResponse.json({
        message: "CSOS scan complete — no entities found",
        queriesRun,
        errors: searchErrors.length,
      });
    }

    // Step 2: Convert CSOS entities to RawListing format
    const rawListings: RawListing[] = entities.map((entity) => csosEntityToRawListing(entity));

    // Step 3: Feed through existing post-processor pipeline
    const scrapeResult: ScrapeResult = {
      platform: Platform.MANUAL, // No CSOS enum — use MANUAL with metadata
      listings: rawListings,
      errors: searchErrors,
      startedAt: new Date(),
      completedAt: new Date(),
    };

    const { newCount, updatedCount, errors: processErrors } =
      await processScrapedListings(scrapeResult);

    // Step 4: Create notifications for acquisition signals
    let notifications = 0;
    for (const entity of entities) {
      const signal = isAcquisitionSignal(entity);
      if (signal.isSignal) {
        // Check if we already have a notification for this entity recently
        const existing = await prisma.notification.findFirst({
          where: {
            title: { contains: entity.entityName },
            type: "HIGH_SCORE_DISCOVERY",
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
          },
        });

        if (!existing) {
          await prisma.notification.create({
            data: {
              type: "HIGH_SCORE_DISCOVERY",
              title: `CSOS Discovery: ${entity.entityName}`,
              message: signal.reason ?? "Potential acquisition target found via public records",
              priority: entity.status.toLowerCase().includes("delinquent") ? "high" : "normal",
              entityType: "listing",
            },
          });
          notifications++;
        }
      }
    }

    // Finalize agent run
    const allErrors = [...searchErrors, ...processErrors];
    await prisma.aIAgentRun.update({
      where: { id: agentRun.id },
      data: {
        status: allErrors.length > 0 ? "partial" : "success",
        itemsProcessed: entities.length,
        itemsCreated: newCount,
        itemsUpdated: updatedCount,
        apiCallsMade: queriesRun,
        summary: `CSOS: ${entities.length} entities, ${newCount} new, ${updatedCount} updated, ${notifications} notifications`,
        errorMessage: allErrors.length > 0 ? allErrors.slice(0, 5).join("; ") : null,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "CSOS scan complete",
      queriesRun,
      entitiesFound: entities.length,
      new: newCount,
      updated: updatedCount,
      notifications,
      errors: allErrors.length,
    });
  } catch (error) {
    console.error("CSOS scan error:", error);

    try {
      const latestRun = await prisma.aIAgentRun.findFirst({
        where: { agentName: "csos_scan", status: "running" },
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
      { error: "CSOS scan failed", detail: error instanceof Error ? error.message : undefined },
      { status: 500 },
    );
  }
}

