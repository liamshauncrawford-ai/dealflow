import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Platform } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const platform = body.platform as Platform | undefined;

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

    // Platforms that have public search results and can scrape without cookies
    const PUBLIC_PLATFORMS: Platform[] = [
      "BIZBUYSELL",
      "BIZQUEST",
      "BUSINESSBROKER",
    ];

    // Determine which platforms to scrape
    const platformsToScrape = platform ? [platform] : validPlatforms;

    const runs = [];
    for (const p of platformsToScrape) {
      const isPublicPlatform = PUBLIC_PLATFORMS.includes(p);

      // Check if cookies are valid for this platform
      const cookie = await prisma.platformCookie.findUnique({
        where: { platform: p },
      });

      // Skip platforms that require cookies but don't have them
      if (!isPublicPlatform && (!cookie || !cookie.isValid)) {
        runs.push({
          platform: p,
          status: "skipped" as const,
          reason: "No valid cookies",
        });
        continue;
      }

      // Create a scrape run record
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

      // Trigger the scrape asynchronously.
      // For BizBuySell: use Apify if configured (reliable SaaS scraper),
      // otherwise fall back to Playwright/CDP browser scraper.
      (async () => {
        try {
          if (p === "BIZBUYSELL") {
            const { isApifyAvailable, apifyScrape } = await import(
              "@/lib/scrapers/apify-scraper"
            );
            if (isApifyAvailable()) {
              await apifyScrape(run.id, { state: "CO" });
              return;
            }
          }
          // Fallback: browser-based scraper (Playwright/CDP)
          const { browserScrape } = await import(
            "@/lib/scrapers/browser-scraper"
          );
          await browserScrape(p, run.id, { state: "CO" });
        } catch (err) {
          console.error(`Scrape failed for ${p}:`, err);
        }
      })();
    }

    return NextResponse.json({ runs });
  } catch (error) {
    console.error("Error triggering scrape:", error);
    return NextResponse.json(
      { error: "Failed to trigger scrape" },
      { status: 500 }
    );
  }
}
