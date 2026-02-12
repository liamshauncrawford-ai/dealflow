import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  scrapeListingFromUrl,
  detectPlatformFromUrl,
  getSupportedDomains,
} from "@/lib/scrapers/url-scraper";

const scrapeUrlSchema = z.object({
  url: z.string().url("Please enter a valid URL").max(2000),
});

/**
 * POST /api/scrape-url
 *
 * Scrapes a single listing URL and returns the parsed data as JSON.
 * Does NOT persist the listing — the caller uses the data to pre-fill a form.
 *
 * Request body: { url: string }
 * Response: { platform, listing, scrapedAt } or { error }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = scrapeUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid URL" },
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    // Quick check: is this a supported platform?
    const platform = detectPlatformFromUrl(url);
    if (!platform) {
      return NextResponse.json(
        {
          error: `Unsupported platform. Supported domains: ${getSupportedDomains().join(", ")}`,
          platform: null,
        },
        { status: 400 }
      );
    }

    // Scrape the listing
    const result = await scrapeListingFromUrl(url);

    return NextResponse.json({
      platform: result.platform,
      listing: result.listing,
      scrapedAt: result.scrapedAt.toISOString(),
    });
  } catch (err) {
    console.error("[scrape-url] Error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to scrape URL",
      },
      { status: 500 }
    );
  }
}
