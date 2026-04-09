import { Platform, Prisma, SearchProfile } from "@prisma/client";
import { prisma } from "@/lib/db";
import { browserScrapeForDiscovery } from "@/lib/scrapers/browser-scraper";
import type { RawListing, ScraperFilters } from "@/lib/scrapers/base-scraper";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RunResult {
  profileId: string;
  newDiscoveries: number;
  skippedDuplicates: number;
  errors: string[];
  platformResults: PlatformResult[];
}

interface PlatformResult {
  platform: Platform;
  listingsFound: number;
  newCount: number;
  skippedCount: number;
  errors: string[];
}

// ─────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────

/**
 * Run a search profile across all its configured platforms.
 * For each platform: scrape listings, dedup against existing
 * discovery listings and the main pipeline, then stage as NEW.
 */
export async function runSearchProfile(
  profile: SearchProfile
): Promise<RunResult> {
  const errors: string[] = [];
  const platformResults: PlatformResult[] = [];
  let totalNew = 0;
  let totalSkipped = 0;

  const filters = (profile.filters ?? {}) as ScraperFilters;

  for (const platform of profile.platforms) {
    try {
      // 1. Scrape for discovery (no auto-import)
      const scrapeResult = await scrapeForDiscovery(platform, filters);

      if (scrapeResult.errors.length > 0) {
        errors.push(
          ...scrapeResult.errors.map((e) => `[${platform}] ${e}`)
        );
      }

      // 2. Stage discovery listings (dedup + insert)
      const staged = await stageDiscoveryListings(
        profile.id,
        platform,
        scrapeResult.listings
      );

      totalNew += staged.newCount;
      totalSkipped += staged.skippedCount;

      platformResults.push({
        platform,
        listingsFound: scrapeResult.listings.length,
        newCount: staged.newCount,
        skippedCount: staged.skippedCount,
        errors: scrapeResult.errors,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${platform}] Fatal error: ${msg}`);
      platformResults.push({
        platform,
        listingsFound: 0,
        newCount: 0,
        skippedCount: 0,
        errors: [msg],
      });
    }
  }

  // Update profile timestamps
  const now = new Date();
  const nextRunAt = profile.cronExpression
    ? computeNextRun(profile.cronExpression)
    : null;

  await prisma.searchProfile.update({
    where: { id: profile.id },
    data: { lastRunAt: now, nextRunAt },
  });

  return {
    profileId: profile.id,
    newDiscoveries: totalNew,
    skippedDuplicates: totalSkipped,
    errors,
    platformResults,
  };
}

// ─────────────────────────────────────────────
// Scrape for discovery (browser-based, no auto-import)
// ─────────────────────────────────────────────

/**
 * Use the browser scraper (Playwright/CDP) to get raw listings WITHOUT
 * auto-importing them into the pipeline. This bypasses bot detection
 * (Akamai, Cloudflare) by using a real browser session, while returning
 * raw ScrapeResult for staging into the discovery queue.
 */
async function scrapeForDiscovery(
  platform: Platform,
  filters: ScraperFilters
): Promise<{ listings: RawListing[]; errors: string[] }> {
  const result = await browserScrapeForDiscovery(platform, filters);

  return {
    listings: result.listings,
    errors: result.errors,
  };
}

// ─────────────────────────────────────────────
// Stage discovery listings (dedup + insert)
// ─────────────────────────────────────────────

/**
 * For each raw listing:
 * 1. Skip if no sourceUrl
 * 2. Skip if already exists in DiscoveryListing (any profile)
 * 3. Skip if already in the main pipeline (ListingSource)
 * 4. Create as NEW DiscoveryListing
 */
async function stageDiscoveryListings(
  profileId: string,
  platform: Platform,
  rawListings: RawListing[]
): Promise<{ newCount: number; skippedCount: number }> {
  let newCount = 0;
  let skippedCount = 0;

  for (const raw of rawListings) {
    if (!raw.sourceUrl) {
      skippedCount++;
      continue;
    }

    // Check if already discovered
    const existingDiscovery = await prisma.discoveryListing.findUnique({
      where: { sourceUrl: raw.sourceUrl },
      select: { id: true, status: true },
    });

    if (existingDiscovery) {
      // Update existing NEW discoveries with fresher data (e.g. better titles)
      if (existingDiscovery.status === "NEW") {
        await prisma.discoveryListing.update({
          where: { id: existingDiscovery.id },
          data: {
            title: raw.title,
            askingPrice: raw.askingPrice,
            revenue: raw.revenue,
            cashFlow: raw.cashFlow,
            ebitda: raw.ebitda,
            city: raw.city,
            state: raw.state,
            description: raw.description,
            rawData: (raw.rawData ?? {}) as Prisma.InputJsonValue,
          },
        });
      }
      skippedCount++;
      continue;
    }

    // Check if already in the main pipeline
    const existingSource = await prisma.listingSource.findUnique({
      where: { sourceUrl: raw.sourceUrl },
      select: { id: true },
    });

    if (existingSource) {
      skippedCount++;
      continue;
    }

    // Create new discovery listing
    await prisma.discoveryListing.create({
      data: {
        searchProfileId: profileId,
        title: raw.title,
        businessName: raw.businessName ?? null,
        askingPrice: raw.askingPrice,
        revenue: raw.revenue,
        cashFlow: raw.cashFlow,
        ebitda: raw.ebitda,
        industry: raw.industry,
        city: raw.city,
        state: raw.state,
        sourceUrl: raw.sourceUrl,
        platform,
        brokerName: raw.brokerName,
        brokerCompany: raw.brokerCompany,
        description: raw.description,
        rawData: (raw.rawData ?? {}) as Prisma.InputJsonValue,
        status: "NEW",
      },
    });

    newCount++;
  }

  return { newCount, skippedCount };
}

// ─────────────────────────────────────────────
// Cron helper
// ─────────────────────────────────────────────

/**
 * Simple next-run computation from a cron expression.
 * Parses minute and hour from standard 5-part cron (min hour dom month dow).
 * Returns tomorrow at the specified time.
 */
export function computeNextRun(cron: string): Date {
  const parts = cron.trim().split(/\s+/);
  const minute = parts[0] === "*" ? 0 : parseInt(parts[0], 10);
  const hour = parts.length > 1 && parts[1] !== "*" ? parseInt(parts[1], 10) : 6;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hour, minute, 0, 0);

  return tomorrow;
}
