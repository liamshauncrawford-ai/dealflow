import { Prisma, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RawListing, ScrapeResult } from "./base-scraper";
import { isDenverMetro } from "./parser-utils";
import { inferFinancials } from "../financial/inference-engine";
import { DEFAULT_METRO_AREA } from "@/lib/constants";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PostProcessResult {
  newCount: number;
  updatedCount: number;
  errors: string[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Convert a Prisma Decimal (or null) to a plain JS number (or null).
 * Prisma returns `Prisma.Decimal` objects for `@db.Decimal` columns.
 */
function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

/**
 * Determine the metro area for a listing based on its city.
 */
function resolveMetroArea(city: string | null | undefined): string | null {
  if (isDenverMetro(city ?? null)) {
    return DEFAULT_METRO_AREA;
  }
  return null;
}

// ─────────────────────────────────────────────
// Main post-processing pipeline
// ─────────────────────────────────────────────

/**
 * Process a batch of scraped listings:
 *  1. Upsert each listing + its ListingSource
 *  2. Run financial inference when EBITDA / SDE are not reported
 *  3. Persist inferred values back to the Listing row
 *  4. Update lastSeenAt and determine metroArea
 */
export async function processScrapedListings(
  results: ScrapeResult,
): Promise<PostProcessResult> {
  let newCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  for (const raw of results.listings) {
    try {
      // Ensure platform is set on each raw listing from the scrape result
      raw.platform = results.platform;
      const processed = await processOneListing(raw);
      if (processed === "new") {
        newCount++;
      } else if (processed === "updated") {
        updatedCount++;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      errors.push(`[${raw.sourceUrl}] ${message}`);
    }
  }

  return { newCount, updatedCount, errors };
}

// ─────────────────────────────────────────────
// Per-listing processing
// ─────────────────────────────────────────────

async function processOneListing(
  raw: RawListing,
): Promise<"new" | "updated"> {
  const now = new Date();

  // ── Step 1: Check if a ListingSource with this URL already exists ──
  const existingSource = await prisma.listingSource.findUnique({
    where: { sourceUrl: raw.sourceUrl },
    include: { listing: true },
  });

  let listingId: string;
  let isNew: boolean;

  if (existingSource) {
    // ── UPDATE path ──────────────────────────────────────────────
    isNew = false;
    listingId = existingSource.listingId;

    // Update the ListingSource metadata
    await prisma.listingSource.update({
      where: { id: existingSource.id },
      data: {
        lastScrapedAt: now,
        rawData: raw as unknown as Prisma.JsonObject,
        rawTitle: raw.title,
        rawPrice: raw.askingPrice ?? undefined,
        rawRevenue: raw.revenue ?? undefined,
        rawCashFlow: raw.cashFlow ?? undefined,
        isStale: false,
      },
    });

    // Update the parent Listing's fields -- only fill in nulls, never
    // overwrite existing data with new scrape data.
    const existing = existingSource.listing;
    const metroArea = existing.metroArea ?? resolveMetroArea(raw.city);

    await prisma.listing.update({
      where: { id: listingId },
      data: {
        title: existing.title ?? raw.title,
        businessName: existing.businessName ?? raw.businessName ?? null,
        description: existing.description ?? raw.description ?? null,
        askingPrice: existing.askingPrice ?? raw.askingPrice ?? null,
        revenue: existing.revenue ?? raw.revenue ?? null,
        ebitda: existing.ebitda ?? raw.ebitda ?? null,
        sde: existing.sde ?? raw.sde ?? null,
        cashFlow: existing.cashFlow ?? raw.cashFlow ?? null,
        inventory: existing.inventory ?? raw.inventory ?? null,
        ffe: existing.ffe ?? raw.ffe ?? null,
        realEstate: existing.realEstate ?? raw.realEstate ?? null,
        priceToEbitda: existing.priceToEbitda ?? raw.priceToEbitda ?? null,
        priceToSde: existing.priceToSde ?? raw.priceToSde ?? null,
        priceToRevenue: existing.priceToRevenue ?? raw.priceToRevenue ?? null,
        city: existing.city ?? raw.city ?? null,
        state: existing.state ?? raw.state ?? null,
        county: existing.county ?? raw.county ?? null,
        zipCode: existing.zipCode ?? raw.zipCode ?? null,
        fullAddress: existing.fullAddress ?? raw.fullAddress ?? null,
        industry: existing.industry ?? raw.industry ?? null,
        category: existing.category ?? raw.category ?? null,
        subcategory: existing.subcategory ?? raw.subcategory ?? null,
        naicsCode: existing.naicsCode ?? raw.naicsCode ?? null,
        brokerName: existing.brokerName ?? raw.brokerName ?? null,
        brokerCompany: existing.brokerCompany ?? raw.brokerCompany ?? null,
        brokerPhone: existing.brokerPhone ?? raw.brokerPhone ?? null,
        brokerEmail: existing.brokerEmail ?? raw.brokerEmail ?? null,
        sellerFinancing: existing.sellerFinancing ?? raw.sellerFinancing ?? null,
        employees: existing.employees ?? raw.employees ?? null,
        established: existing.established ?? raw.established ?? null,
        reasonForSale: existing.reasonForSale ?? raw.reasonForSale ?? null,
        facilities: existing.facilities ?? raw.facilities ?? null,
        listingDate: existing.listingDate ?? raw.listingDate ?? null,
        metroArea,
        lastSeenAt: now,
      },
    });
  } else {
    // ── CREATE path ──────────────────────────────────────────────
    isNew = true;
    const metroArea = resolveMetroArea(raw.city);

    const newListing = await prisma.listing.create({
      data: {
        title: raw.title,
        businessName: raw.businessName ?? null,
        description: raw.description ?? null,
        askingPrice: raw.askingPrice ?? null,
        revenue: raw.revenue ?? null,
        ebitda: raw.ebitda ?? null,
        sde: raw.sde ?? null,
        cashFlow: raw.cashFlow ?? null,
        inventory: raw.inventory ?? null,
        ffe: raw.ffe ?? null,
        realEstate: raw.realEstate ?? null,
        priceToEbitda: raw.priceToEbitda ?? null,
        priceToSde: raw.priceToSde ?? null,
        priceToRevenue: raw.priceToRevenue ?? null,
        city: raw.city ?? null,
        state: raw.state ?? null,
        county: raw.county ?? null,
        zipCode: raw.zipCode ?? null,
        fullAddress: raw.fullAddress ?? null,
        industry: raw.industry ?? null,
        category: raw.category ?? null,
        subcategory: raw.subcategory ?? null,
        naicsCode: raw.naicsCode ?? null,
        brokerName: raw.brokerName ?? null,
        brokerCompany: raw.brokerCompany ?? null,
        brokerPhone: raw.brokerPhone ?? null,
        brokerEmail: raw.brokerEmail ?? null,
        sellerFinancing: raw.sellerFinancing ?? null,
        employees: raw.employees ?? null,
        established: raw.established ?? null,
        reasonForSale: raw.reasonForSale ?? null,
        facilities: raw.facilities ?? null,
        listingDate: raw.listingDate ?? null,
        metroArea,
        lastSeenAt: now,
        sources: {
          create: {
            platform: raw.platform as Platform,
            sourceUrl: raw.sourceUrl,
            sourceId: raw.sourceId ?? null,
            rawData: raw as unknown as Prisma.JsonObject,
            rawTitle: raw.title,
            rawPrice: raw.askingPrice ?? null,
            rawRevenue: raw.revenue ?? null,
            rawCashFlow: raw.cashFlow ?? null,
            firstScrapedAt: now,
            lastScrapedAt: now,
          },
        },
      },
    });

    listingId = newListing.id;
  }

  // ── Step 2: Run financial inference ────────────────────────────
  // Re-read the listing to get the authoritative, merged data (the
  // update path may have filled in fields from the raw data).
  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: listingId },
  });

  // Only run inference if EBITDA or SDE is missing
  if (listing.ebitda === null || listing.sde === null) {
    const inferenceResult = await inferFinancials({
      askingPrice: decimalToNumber(listing.askingPrice),
      revenue: decimalToNumber(listing.revenue),
      ebitda: decimalToNumber(listing.ebitda),
      sde: decimalToNumber(listing.sde),
      cashFlow: decimalToNumber(listing.cashFlow),
      industry: listing.industry,
      category: listing.category,
      priceToSde: decimalToNumber(listing.priceToSde as Prisma.Decimal | null),
      priceToEbitda: decimalToNumber(listing.priceToEbitda as Prisma.Decimal | null),
    });

    // ── Step 3: Persist inferred values ────────────────────────────
    if (inferenceResult) {
      await prisma.listing.update({
        where: { id: listingId },
        data: {
          inferredEbitda: inferenceResult.inferredEbitda,
          inferredSde: inferenceResult.inferredSde,
          inferenceMethod: inferenceResult.inferenceMethod,
          inferenceConfidence: inferenceResult.inferenceConfidence,
        },
      });
    }
  }

  return isNew ? "new" : "updated";
}
