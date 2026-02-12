/**
 * URL Scraper Service
 *
 * Given a single listing URL from any supported platform, this service:
 *  1. Detects the platform from the URL hostname
 *  2. Gets the appropriate scraper via the scraper registry
 *  3. Fetches the page HTML
 *  4. Parses it into a RawListing using the platform's parseDetailPage()
 *
 * This is used by the /api/scrape-url endpoint for "paste URL → auto-fill" flows.
 */

import { Platform } from "@prisma/client";
import { getScraperForPlatform } from "./scraper-registry";
import type { RawListing } from "./base-scraper";

// ─────────────────────────────────────────────
// Platform detection
// ─────────────────────────────────────────────

/**
 * Map of URL hostname patterns to Platform enum values.
 * Each entry can have multiple patterns (e.g. tworld.com and transworldba.com both map to TRANSWORLD).
 */
const PLATFORM_HOSTNAME_MAP: Array<{ patterns: string[]; platform: Platform }> = [
  { patterns: ["bizbuysell.com"], platform: "BIZBUYSELL" },
  { patterns: ["bizquest.com"], platform: "BIZQUEST" },
  { patterns: ["dealstream.com"], platform: "DEALSTREAM" },
  { patterns: ["tworld.com", "transworldba.com", "tworld.biz"], platform: "TRANSWORLD" },
  { patterns: ["loopnet.com"], platform: "LOOPNET" },
  { patterns: ["businessbroker.net"], platform: "BUSINESSBROKER" },
];

/**
 * Detect the listing platform from a URL.
 * Returns null if the URL hostname doesn't match any known platform.
 */
export function detectPlatformFromUrl(url: string): Platform | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    for (const entry of PLATFORM_HOSTNAME_MAP) {
      if (entry.patterns.some((pattern) => hostname.includes(pattern))) {
        return entry.platform;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the list of supported platform domains for display in the UI.
 */
export function getSupportedDomains(): string[] {
  return PLATFORM_HOSTNAME_MAP.flatMap((entry) => entry.patterns);
}

// ─────────────────────────────────────────────
// Single-URL scraping
// ─────────────────────────────────────────────

export interface ScrapeUrlResult {
  platform: Platform;
  listing: RawListing;
  scrapedAt: Date;
}

/**
 * Scrape a single listing URL and return the parsed data.
 *
 * @param url - The listing URL to scrape
 * @returns The platform, parsed listing data, and scrape timestamp
 * @throws Error if the platform is unsupported, the page can't be fetched, or parsing fails
 */
export async function scrapeListingFromUrl(url: string): Promise<ScrapeUrlResult> {
  // 1. Detect platform
  const platform = detectPlatformFromUrl(url);
  if (!platform) {
    throw new Error(
      `Unsupported platform. URL must be from one of: ${getSupportedDomains().join(", ")}`
    );
  }

  // 2. Get the right scraper
  const scraper = getScraperForPlatform(platform);

  // 3. Fetch the page HTML
  let html: string;
  try {
    html = await scraper.fetchSinglePage(url);
  } catch (err) {
    throw new Error(
      `Failed to fetch page from ${platform}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 4. Parse the detail page
  let listing: RawListing;
  try {
    listing = await scraper.parseDetailPage(html, url);
  } catch (err) {
    throw new Error(
      `Failed to parse listing from ${platform}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return {
    platform,
    listing,
    scrapedAt: new Date(),
  };
}
