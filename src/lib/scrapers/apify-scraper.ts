/**
 * Apify-based BizBuySell scraper.
 *
 * Uses the Apify BizBuySell actor (acquistion-automation/bizbuysell-scraper)
 * to reliably scrape listings without dealing with Akamai bot detection.
 *
 * The actor handles: anti-bot bypass, pagination, detail page extraction,
 * and returns structured JSON with financials, broker info, and more.
 *
 * This module maps Apify's output format to our RawListing type and feeds
 * results through the existing post-processor pipeline (dedup + inference).
 */

import { Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RawListing, ScrapeResult, ScraperFilters } from "./base-scraper";
import { parsePrice, parseLocation } from "./parser-utils";
import { processScrapedListings } from "./post-processor";
import { THESIS_SEARCH_QUERIES } from "@/lib/constants";
import { BizBuySellScraper } from "./bizbuysell";

// ─────────────────────────────────────────────
// Apify actor configuration
// ─────────────────────────────────────────────

const ACTOR_ID = "acquistion-automation/bizbuysell-scraper";
const DEFAULT_MAX_ITEMS_PER_QUERY = 30;
const ACTOR_TIMEOUT_SECS = 900; // 15 minutes max (multiple searches)

// ─────────────────────────────────────────────
// Apify output types
// ─────────────────────────────────────────────

interface ApifyBizBuySellItem {
  "DATE ADDED"?: string;
  LOCATION?: string;
  TITLE?: string;
  "INDUSTRY DETAILS"?: string;
  PRICE?: string;
  EBITDA?: string;
  REVENUE?: string;
  "CASH FLOW"?: string;
  "YEAR ESTABLISHED"?: string;
  "NUMBER OF EMPLOYEES"?: string | number;
  STATE?: string;
  "LINK TO DEAL"?: string;
  "INTERMEDIARY FIRM"?: string;
  "INTERMEDIARY PHONE"?: string;
  "INTERMEDIARY NAME"?: string;
  INVENTORY?: string;
  "REASON FOR SELLING"?: string;
  "FURNITURE, FIXTURES, & EQUIPMENT (FF&E)"?: string;
  "FF&E"?: string;
  "SELLER TYPE"?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Check if Apify is configured with an API token.
 */
export function isApifyAvailable(): boolean {
  return !!process.env.APIFY_API_TOKEN;
}

/**
 * Run the Apify BizBuySell scraper using thesis-targeted search queries.
 *
 * Instead of scraping ALL Colorado listings, this builds targeted search
 * URLs for each thesis trade category (electrical, HVAC, plumbing, etc.)
 * and sends them all to the Apify actor. This means:
 *   - Fewer Apify compute units (crawling targeted pages, not the whole state)
 *   - Higher signal-to-noise ratio (most results match your thesis)
 *   - The post-processor still classifies/scores everything after
 */
export async function apifyScrape(
  runId: string,
  filters: ScraperFilters = { state: "CO" }
): Promise<void> {
  const startedAt = new Date();

  try {
    await prisma.scrapeRun.update({
      where: { id: runId },
      data: { status: "RUNNING", startedAt },
    });

    console.log("[APIFY] Starting thesis-targeted BizBuySell scrape via Apify...");

    // Dynamic import to avoid loading at startup
    const { ApifyClient } = await import("apify-client");

    const client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN!,
    });

    // Build thesis-targeted search URLs using the BizBuySell URL builder
    const scraper = new BizBuySellScraper();
    const searchUrls: string[] = [];

    for (const query of THESIS_SEARCH_QUERIES) {
      const url = scraper.buildSearchUrl({
        state: filters.state ?? "CO",
        keyword: query.keyword,
        categorySlug: query.categorySlug,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minCashFlow: filters.minCashFlow,
        city: filters.city,
      });
      searchUrls.push(url);
      console.log(`[APIFY]   → ${query.label}: ${url}`);
    }

    console.log(`[APIFY] Sending ${searchUrls.length} thesis-targeted search URLs to Apify actor`);

    // Compute total max items — sum of per-query limits or default
    const totalMaxItems = THESIS_SEARCH_QUERIES.reduce(
      (sum, q) => sum + (q.maxItems ?? DEFAULT_MAX_ITEMS_PER_QUERY),
      0
    );

    // Start the actor with ALL targeted URLs at once
    const run = await client
      .actor(ACTOR_ID)
      .call(
        {
          startUrls: searchUrls,
          maxItems: totalMaxItems,
        },
        {
          timeout: ACTOR_TIMEOUT_SECS,
        }
      );

    console.log(`[APIFY] Actor run completed with status: ${run.status}`);

    if (run.status !== "SUCCEEDED") {
      throw new Error(`Apify actor run failed with status: ${run.status}`);
    }

    // Fetch dataset items
    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    console.log(`[APIFY] Retrieved ${items.length} items from dataset`);

    // Deduplicate by source URL (same listing can appear in multiple searches)
    const seenUrls = new Set<string>();
    const uniqueItems: ApifyBizBuySellItem[] = [];
    for (const item of items as ApifyBizBuySellItem[]) {
      const url = item["LINK TO DEAL"]?.trim();
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);
      uniqueItems.push(item);
    }

    console.log(
      `[APIFY] Deduplicated: ${uniqueItems.length} unique listings (${items.length - uniqueItems.length} duplicates removed)`
    );

    // Map Apify items to RawListing[]
    const listings = uniqueItems
      .map(mapApifyItemToRawListing)
      .filter((l): l is RawListing => l !== null);

    console.log(
      `[APIFY] Mapped ${listings.length} valid listings (${uniqueItems.length - listings.length} skipped)`
    );

    // Build ScrapeResult and feed through existing pipeline
    const result: ScrapeResult = {
      platform: "BIZBUYSELL" as Platform,
      listings,
      errors: [],
      startedAt,
      completedAt: new Date(),
    };

    const processResult = await processScrapedListings(result);

    await prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        listingsFound: listings.length,
        listingsNew: processResult.newCount,
        listingsUpdated: processResult.updatedCount,
        errors: processResult.errors.length,
        errorLog:
          processResult.errors.length > 0
            ? processResult.errors.join("\n")
            : null,
      },
    });

    console.log(
      `[APIFY] Scrape complete: ${listings.length} found, ` +
        `${processResult.newCount} new, ${processResult.updatedCount} updated`
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[APIFY] Scrape failed:", errorMessage);

    await prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorLog: errorMessage,
      },
    });
  }
}

// ─────────────────────────────────────────────
// Field mapping
// ─────────────────────────────────────────────

function mapApifyItemToRawListing(
  item: ApifyBizBuySellItem
): RawListing | null {
  const title = item.TITLE?.trim();
  const sourceUrl = item["LINK TO DEAL"]?.trim();

  // Must have at least a title and URL
  if (!title || !sourceUrl) return null;

  // Parse location
  const locationText = item.LOCATION?.trim() || "";
  const location = parseLocation(locationText);

  // Use STATE field as fallback for state
  const state =
    location.state ||
    normalizeState(item.STATE?.trim() || "") ||
    null;

  // Parse financial fields
  const askingPrice = parsePrice(item.PRICE || "");
  const revenue = parsePrice(item.REVENUE || "");
  const ebitda = parsePrice(item.EBITDA || "");
  const cashFlow = parsePrice(item["CASH FLOW"] || "");

  // Parse FF&E (check both field name variants)
  const ffeText =
    item["FURNITURE, FIXTURES, & EQUIPMENT (FF&E)"] ||
    item["FF&E"] ||
    "";
  const ffe = parsePrice(ffeText);

  // Parse inventory
  const inventory = parsePrice(item.INVENTORY || "");

  // Parse employees
  const employeesRaw = item["NUMBER OF EMPLOYEES"];
  const employees =
    typeof employeesRaw === "number"
      ? employeesRaw
      : employeesRaw
        ? parseInt(String(employeesRaw).replace(/\D/g, ""), 10) || null
        : null;

  // Parse year established
  const establishedRaw = item["YEAR ESTABLISHED"]?.trim();
  const established = establishedRaw
    ? parseInt(establishedRaw, 10) || null
    : null;

  // Parse listing date
  const dateAdded = item["DATE ADDED"]?.trim();
  let listingDate: Date | null = null;
  if (dateAdded) {
    const parsed = new Date(dateAdded);
    if (!isNaN(parsed.getTime())) {
      listingDate = parsed;
    }
  }

  // Compute multiples if we have the data
  const priceToEbitda =
    askingPrice && ebitda && ebitda > 0
      ? Math.round((askingPrice / ebitda) * 100) / 100
      : null;

  const priceToRevenue =
    askingPrice && revenue && revenue > 0
      ? Math.round((askingPrice / revenue) * 100) / 100
      : null;

  return {
    sourceId: null,
    sourceUrl,
    title,
    businessName: null,
    askingPrice,
    revenue,
    cashFlow,
    ebitda,
    sde: null, // Apify doesn't provide SDE directly
    priceToEbitda,
    priceToSde: null,
    priceToRevenue,
    industry: null,
    category: null,
    city: location.city,
    state,
    zipCode: location.zipCode,
    description: item["INDUSTRY DETAILS"]?.trim() || null,
    brokerName: item["INTERMEDIARY NAME"]?.trim() || null,
    brokerCompany: item["INTERMEDIARY FIRM"]?.trim() || null,
    brokerPhone: item["INTERMEDIARY PHONE"]?.trim() || null,
    brokerEmail: null,
    employees,
    established,
    sellerFinancing: null,
    inventory: ffe !== null ? null : inventory, // Avoid double-counting
    ffe,
    realEstate: null,
    reasonForSale: item["REASON FOR SELLING"]?.trim() || null,
    facilities: null,
    listingDate,
    rawData: item as unknown as Record<string, unknown>,
  };
}

// ─────────────────────────────────────────────
// State normalization helper
// ─────────────────────────────────────────────

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

function normalizeState(state: string): string | null {
  if (!state) return null;
  const lower = state.toLowerCase().trim();

  // Already a 2-letter abbreviation
  if (/^[A-Z]{2}$/i.test(state.trim())) {
    return state.trim().toUpperCase();
  }

  return STATE_ABBREVIATIONS[lower] || null;
}
