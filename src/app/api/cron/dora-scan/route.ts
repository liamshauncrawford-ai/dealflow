import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  searchDora,
  isLicenseExpiringSoon,
  normalizeBusinessName,
} from "@/lib/scrapers/dora-scraper";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/dora-scan
 * Searches DORA for contractor licenses, then cross-references with
 * existing Listings to enrich them with license data.
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
      data: { agentName: "dora_scan", status: "running" },
    });

    // Step 1: Search DORA
    const { licenses, errors: searchErrors, queriesRun } = await searchDora();

    if (licenses.length === 0) {
      await prisma.aIAgentRun.update({
        where: { id: agentRun.id },
        data: {
          status: searchErrors.length > 0 ? "partial" : "success",
          summary: `Searched ${queriesRun} license types, found 0 licenses. ${searchErrors.length} errors.`,
          errorMessage: searchErrors.length > 0 ? searchErrors.join("; ") : null,
          completedAt: new Date(),
        },
      });
      return NextResponse.json({
        message: "DORA scan complete — no licenses found",
        queriesRun,
        errors: searchErrors.length,
      });
    }

    // Step 2: Load all existing listings for cross-reference
    const listings = await prisma.listing.findMany({
      where: { isHidden: false },
      select: {
        id: true,
        title: true,
        businessName: true,
        certifications: true,
        enrichmentStatus: true,
      },
    });

    // Build a name lookup map (normalized name → listing IDs)
    const nameToListings = new Map<string, string[]>();
    for (const listing of listings) {
      const names = [listing.businessName, listing.title].filter(Boolean);
      for (const name of names) {
        const normalized = normalizeBusinessName(name!);
        if (normalized.length < 3) continue;
        const existing = nameToListings.get(normalized) ?? [];
        existing.push(listing.id);
        nameToListings.set(normalized, existing);
      }
    }

    // Step 3: Cross-reference licenses with listings
    let enriched = 0;
    let notifications = 0;

    for (const license of licenses) {
      // Try to match by business name or license holder name
      const namesToCheck = [license.businessName, license.licenseName].filter(Boolean);

      for (const name of namesToCheck) {
        const normalized = normalizeBusinessName(name!);
        const matchingListingIds = nameToListings.get(normalized);

        if (matchingListingIds) {
          for (const listingId of matchingListingIds) {
            const listing = listings.find((l) => l.id === listingId);
            if (!listing) continue;

            // Add license type to certifications if not already present
            const currentCerts = listing.certifications ?? [];
            const certString = `DORA: ${license.licenseType}`;

            if (!currentCerts.includes(certString)) {
              await prisma.listing.update({
                where: { id: listingId },
                data: {
                  certifications: { push: certString },
                  enrichmentStatus: "complete",
                  enrichmentDate: new Date(),
                },
              });
              enriched++;

              // Notification for expiring license
              if (isLicenseExpiringSoon(license)) {
                await prisma.notification.create({
                  data: {
                    type: "ENRICHMENT_COMPLETE",
                    title: `License Expiring: ${name}`,
                    message: `${license.licenseType} license #${license.licenseNumber} expires ${license.expirationDate}. Potential exit signal.`,
                    priority: "high",
                    entityType: "listing",
                    entityId: listingId,
                    actionUrl: `/listings/${listingId}`,
                  },
                });
                notifications++;
              }
            }
          }
        }
      }
    }

    // Finalize agent run
    await prisma.aIAgentRun.update({
      where: { id: agentRun.id },
      data: {
        status: searchErrors.length > 0 ? "partial" : "success",
        itemsProcessed: licenses.length,
        itemsUpdated: enriched,
        apiCallsMade: queriesRun,
        summary: `DORA: ${licenses.length} licenses found, ${enriched} listings enriched, ${notifications} notifications`,
        errorMessage: searchErrors.length > 0 ? searchErrors.slice(0, 5).join("; ") : null,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "DORA scan complete",
      queriesRun,
      licensesFound: licenses.length,
      enriched,
      notifications,
      errors: searchErrors.length,
    });
  } catch (error) {
    console.error("DORA scan error:", error);

    try {
      const latestRun = await prisma.aIAgentRun.findFirst({
        where: { agentName: "dora_scan", status: "running" },
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
      { error: "DORA scan failed", detail: error instanceof Error ? error.message : undefined },
      { status: 500 },
    );
  }
}
