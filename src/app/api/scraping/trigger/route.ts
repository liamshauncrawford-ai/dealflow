import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Platform } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const platform = body.platform as Platform | undefined;
    const action = body.action as string | undefined;

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
          });

          // Trigger Apify scrape asynchronously
          (async () => {
            try {
              const { apifyScrape } = await import(
                "@/lib/scrapers/apify-scraper"
              );
              await apifyScrape(run.id, { state: "CO" });
            } catch (err) {
              console.error(`Apify scrape failed for ${p}:`, err);
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
