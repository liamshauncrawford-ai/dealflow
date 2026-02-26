import { Prisma, Platform, PrimaryTrade } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RawListing, ScrapeResult } from "./base-scraper";
import { isDenverMetro } from "./parser-utils";
import { inferFinancials } from "../financial/inference-engine";
import { DEFAULT_METRO_AREA } from "@/lib/constants";
import { computeFitScore } from "../scoring/fit-score-engine";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PostProcessResult {
  newCount: number;
  updatedCount: number;
  errors: string[];
}

// ─────────────────────────────────────────────
// Thesis trade detection
// ─────────────────────────────────────────────

const TRADE_KEYWORDS: Array<{ trade: PrimaryTrade; patterns: RegExp }> = [
  { trade: "ELECTRICAL", patterns: /electrical contractor|electrician|electrical service|power distribution|commercial electric/i },
  { trade: "STRUCTURED_CABLING", patterns: /structured cabling|data cabling|fiber optic|cat[56e]|network cabling|telecommunications contractor|low.?voltage.*cable/i },
  { trade: "SECURITY_FIRE_ALARM", patterns: /security system|surveillance|access control|cctv|intrusion detection|alarm system|security integrat|fire alarm|fire protection|fire suppression|life safety|fire detection/i },
  { trade: "FRAMING_DRYWALL", patterns: /framing contractor|drywall|metal stud|interior finish|wall system/i },
  { trade: "HVAC_MECHANICAL", patterns: /hvac|heating.*ventilation|air condition|mechanical contractor|building automation|bms|building management|hvac control|refrigerat/i },
  { trade: "PLUMBING", patterns: /plumbing contractor|plumber|plumbing service|pipe.*fit|backflow/i },
  { trade: "PAINTING_FINISHING", patterns: /painting contractor|commercial paint|industrial coat|finish.*contractor/i },
  { trade: "CONCRETE_MASONRY", patterns: /concrete contractor|masonry|foundation|flatwork|paving|brick.*lay/i },
  { trade: "ROOFING", patterns: /roofing contractor|commercial roof|roof.*repair|roof.*install/i },
  { trade: "SITE_WORK", patterns: /excavat|site work|grading|demolition|earthwork|utility.*install/i },
  { trade: "GENERAL_COMMERCIAL", patterns: /general contractor|construction.*sub|specialty contractor|commercial.*construct/i },
];

/**
 * Auto-detect primary trade from listing text content.
 */
function detectPrimaryTrade(title: string, description: string | null, industry: string | null, category: string | null): PrimaryTrade | null {
  const text = [title, description, industry, category].filter(Boolean).join(" ");
  for (const { trade, patterns } of TRADE_KEYWORDS) {
    if (patterns.test(text)) return trade;
  }
  return null;
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

  // ── Step 4: Auto-classify thesis fields for new listings ─────
  if (isNew) {
    const freshListing = await prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
    });

    const detectedTrade = detectPrimaryTrade(
      freshListing.title,
      freshListing.description,
      freshListing.industry,
      freshListing.category,
    );
    const isColorado = freshListing.state?.toUpperCase() === "CO";

    // Only set thesis fields if we detected a relevant trade
    if (detectedTrade) {
      const fitResult = computeFitScore({
        primaryTrade: detectedTrade,
        secondaryTrades: [],
        revenue: decimalToNumber(freshListing.revenue),
        established: freshListing.established,
        state: freshListing.state,
        metroArea: freshListing.metroArea,
        certifications: [],
        askingPrice: decimalToNumber(freshListing.askingPrice),
        ebitda: decimalToNumber(freshListing.ebitda),
        inferredEbitda: decimalToNumber(freshListing.inferredEbitda as Prisma.Decimal | null),
        targetMultipleLow: 3.0,
        targetMultipleHigh: 5.0,
        estimatedAgeRange: null,
        keyPersonRisk: null,
        recurringRevenuePct: null,
      });

      await prisma.listing.update({
        where: { id: listingId },
        data: {
          primaryTrade: detectedTrade,
          fitScore: fitResult.fitScore,
          tier: isColorado && fitResult.fitScore >= 60
            ? "TIER_1_ACTIVE"
            : isColorado && fitResult.fitScore >= 40
              ? "TIER_2_WATCH"
              : "TIER_3_DISQUALIFIED",
          targetMultipleLow: 3.0,
          targetMultipleHigh: 5.0,
        },
      });
    }
  }

  return isNew ? "new" : "updated";
}
