import { prisma } from "@/lib/db";
import { Platform, Prisma } from "@prisma/client";
import { getScraperForPlatform } from "@/lib/scrapers/scraper-registry";
import { processScrapedListings } from "@/lib/scrapers/post-processor";
import { findDuplicatesForListing } from "@/lib/dedup/dedup-engine";
import type { RawListing, ScrapeResult } from "@/lib/scrapers/base-scraper";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type AcceptSuccess = {
  success: true;
  listingId: string;
  enriched: boolean;
};

type AcceptError = {
  error: string;
  status: number;
};

export type AcceptResult = AcceptSuccess | AcceptError;

// ─────────────────────────────────────────────
// Shared accept logic
// ─────────────────────────────────────────────

/**
 * Accept a discovery listing: enrich via detail page scrape, then
 * import into the main pipeline via processScrapedListings.
 */
export async function acceptDiscoveryListing(id: string): Promise<AcceptResult> {
  const discovery = await prisma.discoveryListing.findUnique({
    where: { id },
  });

  if (!discovery) {
    return { error: "Discovery listing not found", status: 404 };
  }

  if (discovery.status !== "NEW") {
    return { error: `Cannot accept listing with status ${discovery.status}`, status: 400 };
  }

  // ── Step 1: Attempt detail page enrichment ──
  let rawListing: RawListing;
  let enriched = false;

  try {
    const scraper = getScraperForPlatform(discovery.platform);

    // For Akamai-protected platforms, use ZenRows to fetch the detail page
    const antiBotPlatforms = new Set(["BIZBUYSELL", "BIZQUEST", "DEALSTREAM"]);
    let html: string;

    if (antiBotPlatforms.has(discovery.platform) && process.env.ZENROWS_API_KEY) {
      const params = new URLSearchParams({
        apikey: process.env.ZENROWS_API_KEY,
        url: discovery.sourceUrl,
        js_render: "true",
        antibot: "true",
        premium_proxy: "true",
        wait: "3000",
      });
      const response = await fetch(`https://api.zenrows.com/v1/?${params.toString()}`, {
        headers: { "Accept": "text/html" },
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`ZenRows HTTP ${response.status}`);
      }
      html = await response.text();
      console.log(`[accept] Fetched detail page via ZenRows (${html.length} bytes)`);
    } else {
      html = await scraper.fetchSinglePage(discovery.sourceUrl);
    }

    rawListing = await scraper.parseDetailPage(html, discovery.sourceUrl);
    enriched = true;
  } catch (err) {
    console.warn(
      `[accept] Detail enrichment failed for ${discovery.sourceUrl}, falling back to thin data:`,
      err instanceof Error ? err.message : err,
    );
    rawListing = buildRawFromDiscovery(discovery);
  }

  // ── Step 2: Import via post-processor ──
  rawListing.platform = discovery.platform;

  const scrapeResult: ScrapeResult = {
    platform: discovery.platform,
    listings: [rawListing],
    errors: [],
    startedAt: new Date(),
    completedAt: new Date(),
  };

  await processScrapedListings(scrapeResult);

  // ── Step 3: Find created listing via ListingSource ──
  const listingSource = await prisma.listingSource.findUnique({
    where: { sourceUrl: discovery.sourceUrl },
    select: { listingId: true },
  });

  if (!listingSource) {
    return { error: "Listing was not created — post-processing may have failed", status: 500 };
  }

  // ── Step 4: Update discovery listing ──
  await prisma.discoveryListing.update({
    where: { id },
    data: {
      status: "ACCEPTED",
      reviewedAt: new Date(),
      listingId: listingSource.listingId,
    },
  });

  // ── Step 5: Run dedup check for the new listing ──
  // This creates DedupCandidate records if the listing matches existing ones.
  // High-confidence matches (>0.85) are auto-merged by the dedup cron job.
  try {
    const candidates = await findDuplicatesForListing(listingSource.listingId);
    if (candidates.length > 0) {
      console.log(
        `[accept] Found ${candidates.length} potential duplicate(s) for listing ${listingSource.listingId}`
      );
    }
  } catch (dedupErr) {
    // Don't fail the accept if dedup errors — it's a secondary concern
    console.warn(
      "[accept] Dedup check failed:",
      dedupErr instanceof Error ? dedupErr.message : dedupErr
    );
  }

  return {
    success: true,
    listingId: listingSource.listingId,
    enriched,
  };
}

// ─────────────────────────────────────────────
// Helper: build RawListing from thin discovery data
// ─────────────────────────────────────────────

/**
 * Convert a DiscoveryListing record into a RawListing shape.
 * Sets all missing fields to null, converts Decimal to Number.
 */
function buildRawFromDiscovery(
  d: {
    sourceUrl: string;
    platform: Platform;
    title: string;
    businessName: string | null;
    askingPrice: Prisma.Decimal | null;
    revenue: Prisma.Decimal | null;
    cashFlow: Prisma.Decimal | null;
    ebitda: Prisma.Decimal | null;
    industry: string | null;
    city: string | null;
    state: string | null;
    description: string | null;
    brokerName: string | null;
    brokerCompany: string | null;
    rawData: Prisma.JsonValue;
  },
): RawListing {
  return {
    sourceId: null,
    sourceUrl: d.sourceUrl,
    platform: d.platform,
    title: d.title,
    businessName: d.businessName,
    askingPrice: d.askingPrice ? Number(d.askingPrice) : null,
    revenue: d.revenue ? Number(d.revenue) : null,
    cashFlow: d.cashFlow ? Number(d.cashFlow) : null,
    ebitda: d.ebitda ? Number(d.ebitda) : null,
    sde: null,
    priceToEbitda: null,
    priceToSde: null,
    priceToRevenue: null,
    industry: d.industry,
    category: null,
    subcategory: null,
    naicsCode: null,
    city: d.city,
    state: d.state,
    county: null,
    zipCode: null,
    fullAddress: null,
    description: d.description,
    brokerName: d.brokerName,
    brokerCompany: d.brokerCompany,
    brokerPhone: null,
    brokerEmail: null,
    employees: null,
    established: null,
    sellerFinancing: null,
    inventory: null,
    ffe: null,
    realEstate: null,
    reasonForSale: null,
    facilities: null,
    listingDate: null,
    rawData: (d.rawData as Record<string, unknown>) ?? {},
  };
}
