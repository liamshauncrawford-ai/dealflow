import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Platform } from "@prisma/client";
import { THESIS_SEARCH_QUERIES } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const platform = body.platform as Platform | undefined;
    const action = body.action as string | undefined;

    // ── Scrape All action ──────────────────────────────────────
    // Orchestrates all data sources in sequence
    if (action === "scrape_all") {
      const results: Record<string, unknown> = {};
      const allErrors: string[] = [];

      // 1. Email alert sync
      try {
        const { parseListingAlertEmails } = await import(
          "@/lib/email/listing-email-parser"
        );
        results.emailParse = await parseListingAlertEmails();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        allErrors.push(`Email parse: ${msg}`);
        results.emailParse = { error: msg };
      }

      // 2. BizBuySell via Apify (if configured)
      try {
        const { isApifyAvailable, apifyScrape } = await import(
          "@/lib/scrapers/apify-scraper"
        );
        if (isApifyAvailable()) {
          const run = await prisma.scrapeRun.create({
            data: {
              platform: "BIZBUYSELL",
              triggeredBy: "scrape_all",
              status: "PENDING",
            },
          });
          // Fire async — don't block
          apifyScrape(run.id, { state: "CO" }).catch((err) => {
            console.error("Apify scrape failed:", err);
            prisma.scrapeRun.update({
              where: { id: run.id },
              data: {
                status: "FAILED",
                completedAt: new Date(),
                errorLog: err instanceof Error ? err.message : String(err),
              },
            }).catch(() => {});
          });
          results.bizbuysell = { status: "queued", runId: run.id };
        } else {
          results.bizbuysell = { status: "skipped", reason: "APIFY_API_TOKEN not configured" };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        allErrors.push(`BizBuySell: ${msg}`);
        results.bizbuysell = { error: msg };
      }

      // 3. Colorado SOS scan
      try {
        const { searchCsos, isAcquisitionSignal } = await import(
          "@/lib/scrapers/csos-scraper"
        );
        const { processScrapedListings } = await import(
          "@/lib/scrapers/post-processor"
        );
        const csos = await searchCsos();
        if (csos.entities.length > 0) {
          // Convert and process (same as csos-scan cron)
          const { csosEntityToRawListing } = await import(
            "@/lib/scrapers/csos-helpers"
          );
          const rawListings = csos.entities.map(csosEntityToRawListing);
          const processed = await processScrapedListings({
            platform: Platform.MANUAL,
            listings: rawListings,
            errors: csos.errors,
            startedAt: new Date(),
            completedAt: new Date(),
          });
          results.csos = {
            entities: csos.entities.length,
            new: processed.newCount,
            updated: processed.updatedCount,
            errors: csos.errors.length,
          };
        } else {
          results.csos = { entities: 0, errors: csos.errors.length };
        }
        if (csos.errors.length > 0) allErrors.push(...csos.errors.slice(0, 3));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        allErrors.push(`CSOS: ${msg}`);
        results.csos = { error: msg };
      }

      // 4. DORA license scan
      try {
        const { searchDora, isLicenseExpiringSoon, normalizeBusinessName } = await import(
          "@/lib/scrapers/dora-scraper"
        );
        const dora = await searchDora();
        results.dora = {
          licenses: dora.licenses.length,
          errors: dora.errors.length,
        };
        if (dora.errors.length > 0) allErrors.push(...dora.errors.slice(0, 3));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        allErrors.push(`DORA: ${msg}`);
        results.dora = { error: msg };
      }

      return NextResponse.json({
        action: "scrape_all",
        results,
        errors: allErrors.length,
        errorDetails: allErrors.length > 0 ? allErrors.slice(0, 10) : undefined,
      });
    }

    // ── Email parse action ──────────────────────────────────────
    // Run listing alert parser directly (no browser scrape needed)
    if (action === "email_parse") {
      try {
        const { parseListingAlertEmails } = await import(
          "@/lib/email/listing-email-parser"
        );
        const result = await parseListingAlertEmails();
        return NextResponse.json({
          action: "email_parse",
          ...result,
        });
      } catch (err) {
        console.error("Email parse failed:", err);
        return NextResponse.json(
          { error: "Failed to parse listing alerts" },
          { status: 500 }
        );
      }
    }

    // ── Standard scrape trigger ─────────────────────────────────

    // Check for already running scrapes
    const running = await prisma.scrapeRun.findFirst({
      where: {
        status: "RUNNING",
        ...(platform ? { platform } : {}),
      },
    });

    if (running) {
      return NextResponse.json(
        {
          error: `A scrape is already running for ${running.platform}`,
          runId: running.id,
        },
        { status: 409 }
      );
    }

    // Validate platform if specified
    const validPlatforms: Platform[] = [
      "BIZBUYSELL",
      "BIZQUEST",
      "DEALSTREAM",
      "TRANSWORLD",
      "LOOPNET",
      "BUSINESSBROKER",
    ];

    if (platform && !validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: `Invalid platform: ${platform}` },
        { status: 400 }
      );
    }

    // Determine which platforms to scrape
    const platformsToScrape = platform ? [platform] : validPlatforms;

    const runs = [];
    for (const p of platformsToScrape) {
      // Only attempt Apify-backed scrapes — browser scrapers return 0 results
      // due to Akamai/Cloudflare bot protection on all platforms.
      if (p === "BIZBUYSELL") {
        const { isApifyAvailable } = await import(
          "@/lib/scrapers/apify-scraper"
        );
        if (isApifyAvailable()) {
          const run = await prisma.scrapeRun.create({
            data: {
              platform: p,
              triggeredBy: "manual",
              status: "PENDING",
            },
          });

          runs.push({
            platform: p,
            status: "queued" as const,
            runId: run.id,
            thesisQueries: THESIS_SEARCH_QUERIES.length,
            searchLabels: THESIS_SEARCH_QUERIES.map((q) => q.label),
          });

          // Trigger thesis-targeted Apify scrape asynchronously
          (async () => {
            try {
              const { apifyScrape } = await import(
                "@/lib/scrapers/apify-scraper"
              );
              await apifyScrape(run.id, {
                state: "CO",
                minCashFlow: body.minCashFlow,
                minPrice: body.minPrice,
                maxPrice: body.maxPrice,
              });
            } catch (err) {
              console.error(`Apify scrape failed for ${p}:`, err);
              // Update status to FAILED so it doesn't stay PENDING forever
              await prisma.scrapeRun.update({
                where: { id: run.id },
                data: {
                  status: "FAILED",
                  completedAt: new Date(),
                  errorLog: err instanceof Error ? err.message : String(err),
                },
              }).catch((updateErr) =>
                console.error(`Failed to update scrape run status:`, updateErr)
              );
            }
          })();

          continue;
        }
      }

      // No Apify available for this platform — skip with clear message
      runs.push({
        platform: p,
        status: "skipped" as const,
        reason:
          "Direct scraping not available (bot protection). Use email alert sync instead.",
      });
    }

    return NextResponse.json({
      runs,
      message:
        runs.every((r) => r.status === "skipped")
          ? "No platforms have direct scraping configured. Use 'Sync Gmail & Parse Alerts' to discover listings from your email subscriptions."
          : undefined,
    });
  } catch (error) {
    console.error("Error triggering scrape:", error);
    return NextResponse.json(
      { error: "Failed to trigger scrape" },
      { status: 500 }
    );
  }
}
