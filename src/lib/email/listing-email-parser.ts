/**
 * Listing email parser — extracts listing data from email alerts.
 *
 * Parses HTML bodies from BizBuySell, BizQuest, DealStream, Transworld,
 * and other listing platforms to extract deal data and feed through the
 * standard post-processor pipeline.
 */

import { prisma } from "@/lib/db";
import { parsePrice, parseLocation } from "@/lib/scrapers/parser-utils";
import { processScrapedListings } from "@/lib/scrapers/post-processor";
import type { RawListing, ScrapeResult } from "@/lib/scrapers/base-scraper";
import type { Platform } from "@prisma/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ParseResult {
  emailsParsed: number;
  listingsExtracted: number;
  listingsProcessed: number;
  errors: string[];
}

interface ExtractedAlertListing {
  title: string;
  sourceUrl: string;
  askingPrice: number | null;
  cashFlow: number | null;
  revenue: number | null;
  city: string | null;
  state: string | null;
  description: string | null;
  platform: string;
}

// ─────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────

/**
 * Parse unparsed listing alert emails and extract listing data.
 * Feeds extracted listings through the standard post-processor pipeline.
 */
export async function parseListingAlertEmails(): Promise<ParseResult> {
  const result: ParseResult = {
    emailsParsed: 0,
    listingsExtracted: 0,
    listingsProcessed: 0,
    errors: [],
  };

  // Find unparsed listing alert emails with HTML body
  const alertEmails = await prisma.email.findMany({
    where: {
      isListingAlert: true,
      listingAlertParsed: false,
      bodyHtml: { not: null },
    },
    take: 100, // Process in batches
    orderBy: { receivedAt: "desc" },
  });

  if (alertEmails.length === 0) {
    return result;
  }

  const allListings: RawListing[] = [];

  for (const email of alertEmails) {
    try {
      const extracted = parseAlertEmailHtml(
        email.bodyHtml!,
        email.fromAddress,
        email.subject
      );

      if (extracted.length > 0) {
        // Convert to RawListing format
        for (const listing of extracted) {
          const raw = alertToRawListing(listing);
          if (raw) {
            allListings.push(raw);
            result.listingsExtracted++;
          }
        }
      }

      // Mark email as parsed
      await prisma.email.update({
        where: { id: email.id },
        data: { listingAlertParsed: true },
      });

      result.emailsParsed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Email ${email.id}: ${msg}`);
    }
  }

  // Process all extracted listings through the standard pipeline
  if (allListings.length > 0) {
    // Group by platform
    const byPlatform = new Map<string, RawListing[]>();
    for (const listing of allListings) {
      const platform = listing.platform ?? "BIZBUYSELL";
      const existing = byPlatform.get(platform) ?? [];
      existing.push(listing);
      byPlatform.set(platform, existing);
    }

    for (const [platform, listings] of byPlatform) {
      try {
        const scrapeResult: ScrapeResult = {
          platform: platform as Platform,
          listings,
          errors: [],
          startedAt: new Date(),
          completedAt: new Date(),
        };

        const processed = await processScrapedListings(scrapeResult);
        result.listingsProcessed += processed.newCount + processed.updatedCount;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Processing ${platform} listings: ${msg}`);
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// HTML parsing — dispatcher
// ─────────────────────────────────────────────

function parseAlertEmailHtml(
  html: string,
  fromAddress: string,
  subject: string | null
): ExtractedAlertListing[] {
  const normalizedFrom = fromAddress.toLowerCase();

  // Skip known newsletter / non-listing senders
  if (NEWSLETTER_SENDERS.some((s) => normalizedFrom.includes(s))) {
    return [];
  }

  if (normalizedFrom.includes("bizbuysell.com")) {
    return parseBizBuySellAlert(html);
  }
  if (normalizedFrom.includes("bizquest.com")) {
    return parseBizQuestAlert(html);
  }
  if (normalizedFrom.includes("dealstream")) {
    return parseDealStreamAlert(html, subject);
  }
  if (
    normalizedFrom.includes("transworld") ||
    normalizedFrom.includes("tworld")
  ) {
    return parseTransworldAlert(html);
  }

  // Unknown platform — skip rather than create junk listings
  return [];
}

// ─────────────────────────────────────────────
// BizBuySell parser
// ─────────────────────────────────────────────

function parseBizBuySellAlert(html: string): ExtractedAlertListing[] {
  const listings: ExtractedAlertListing[] = [];

  const linkPattern =
    /href=["'](https?:\/\/(?:www\.)?bizbuysell\.com\/Business-Opportunity\/[^"']+)["'][^>]*>([^<]+)/gi;

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const sourceUrl = match[1];
    const title = decodeHtmlEntities(match[2]).trim();

    if (!title || title.length < 5) continue;
    if (isJunkTitle(title)) continue;

    const startIdx = match.index;
    const context = html.substring(startIdx, startIdx + 800);

    const askingPrice = extractMoneyFromContext(context, [
      "asking price",
      "price",
      "listed at",
    ]);
    const cashFlow = extractMoneyFromContext(context, [
      "cash flow",
      "discretionary",
    ]);
    const revenue = extractMoneyFromContext(context, ["revenue", "sales"]);
    const location = extractLocationFromContext(context);

    listings.push({
      title,
      sourceUrl,
      askingPrice,
      cashFlow,
      revenue,
      city: location?.city ?? null,
      state: location?.state ?? null,
      description: null,
      platform: "BIZBUYSELL",
    });
  }

  return listings;
}

// ─────────────────────────────────────────────
// BizQuest parser
// ─────────────────────────────────────────────

function parseBizQuestAlert(html: string): ExtractedAlertListing[] {
  const listings: ExtractedAlertListing[] = [];

  const linkPattern =
    /href=["'](https?:\/\/(?:www\.)?bizquest\.com\/listing-detail\/[^"']+)["'][^>]*>([^<]+)/gi;

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const sourceUrl = match[1];
    const title = decodeHtmlEntities(match[2]).trim();

    if (!title || title.length < 5) continue;
    if (isJunkTitle(title)) continue;

    const startIdx = match.index;
    const context = html.substring(startIdx, startIdx + 800);

    const askingPrice = extractMoneyFromContext(context, [
      "asking price",
      "price",
    ]);
    const cashFlow = extractMoneyFromContext(context, [
      "cash flow",
      "discretionary",
    ]);
    const revenue = extractMoneyFromContext(context, ["revenue", "sales"]);
    const location = extractLocationFromContext(context);

    listings.push({
      title,
      sourceUrl,
      askingPrice,
      cashFlow,
      revenue,
      city: location?.city ?? null,
      state: location?.state ?? null,
      description: null,
      platform: "BIZQUEST",
    });
  }

  return listings;
}

// ─────────────────────────────────────────────
// DealStream parser
// ─────────────────────────────────────────────

/**
 * DealStream emails have two formats:
 * 1. "Search Genius" — single listing with title in a prominent heading
 * 2. "Today's New Listings" — daily digest with categorized listings
 *
 * Both use tracking URLs (tracking.genius.dealstream.com) that redirect.
 * Listing titles appear as visible text near these tracking links.
 */
function parseDealStreamAlert(
  html: string,
  subject: string | null
): ExtractedAlertListing[] {
  const listings: ExtractedAlertListing[] = [];

  // Extract listing titles from HTML structure.
  // DealStream emails have listing titles as standalone text nodes between tags.
  // We extract all visible text segments from the HTML.
  const textNodes = extractTextNodes(html);

  // Filter for listing titles: they appear after "Today's New Listings" or
  // after category headers like "Businesses For Sale - Construction".
  // Strategy: collect text nodes that look like listing titles (capitalized,
  // reasonable length, not junk).
  let inListingSection = false;
  const seenTitles = new Set<string>();

  for (let i = 0; i < textNodes.length; i++) {
    const text = textNodes[i].trim();

    // Detect start of listing section
    if (text.includes("Today's New Listings") || text.includes("new listings that were just posted")) {
      inListingSection = true;
      continue;
    }

    // Skip category headers
    if (text.match(/^Businesses For Sale\s*-/i)) {
      continue;
    }

    // Stop at footer indicators
    if (
      text.includes("change your email preferences") ||
      text.includes("245 First Street")
    ) {
      break;
    }

    // For daily digest: text nodes in the listing section that look like titles
    if (inListingSection && text.length >= 10 && /^[A-Z]/.test(text) && !isJunkTitle(text)) {
      const normalizedTitle = text.replace(/\s+/g, " ");
      if (!seenTitles.has(normalizedTitle.toLowerCase())) {
        seenTitles.add(normalizedTitle.toLowerCase());
        listings.push({
          title: normalizedTitle,
          sourceUrl: `https://www.dealstream.com/search?q=${encodeURIComponent(normalizedTitle)}`,
          askingPrice: null,
          cashFlow: null,
          revenue: null,
          city: null,
          state: null,
          description: null,
          platform: "DEALSTREAM",
        });
      }
    }
  }

  // For "Search Genius" single-listing emails, extract from subject
  if (
    listings.length === 0 &&
    subject &&
    !subject.toLowerCase().includes("today's new listings")
  ) {
    const title = subject.trim();
    if (title.length >= 10 && !isJunkTitle(title)) {
      const plainText = stripHtml(html);
      listings.push({
        title,
        sourceUrl: `https://www.dealstream.com/search?q=${encodeURIComponent(title)}`,
        askingPrice: extractPriceNearTitle(plainText, "asking price"),
        cashFlow: null,
        revenue: null,
        city: null,
        state: null,
        description: plainText.length > 100 ? plainText.substring(0, 500) : null,
        platform: "DEALSTREAM",
      });
    }
  }

  return listings;
}

// ─────────────────────────────────────────────
// Transworld parser
// ─────────────────────────────────────────────

/**
 * Transworld emails list businesses with:
 * - Title text (e.g., "High-Value Contracted Supply Platform With Proven Execution")
 * - "Price: $X,XXX,XXX"
 * - "VIEW LISTING" link
 *
 * The links go to transworld.com listing pages.
 */
function parseTransworldAlert(html: string): ExtractedAlertListing[] {
  const listings: ExtractedAlertListing[] = [];

  // Extract text nodes to find listing titles from the HTML structure.
  // Transworld emails have: Title → "Price: $X" → "VIEW LISTING"
  const textNodes = extractTextNodes(html);
  const seenTitles = new Set<string>();

  for (let i = 0; i < textNodes.length; i++) {
    const text = textNodes[i].trim();

    // Look for "Price: $X,XXX,XXX" pattern
    const priceMatch = text.match(/^Price:\s*\$([\d,]+(?:\.\d{2})?)$/);
    if (priceMatch && i > 0) {
      // The previous non-empty text node should be the title
      let title: string | null = null;
      for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
        const prev = textNodes[j].trim();
        if (prev.length >= 10 && /^[A-Z]/.test(prev) && !isJunkTitle(prev)) {
          title = prev.replace(/\s+/g, " ");
          break;
        }
      }

      if (title && !seenTitles.has(title.toLowerCase())) {
        seenTitles.add(title.toLowerCase());
        const askingPrice = parsePrice(`$${priceMatch[1]}`);
        listings.push({
          title,
          sourceUrl: `https://www.tworld.com/search?q=${encodeURIComponent(title)}`,
          askingPrice,
          cashFlow: null,
          revenue: null,
          city: null,
          state: "CO", // Transworld CO office emails are Colorado-focused
          description: null,
          platform: "TRANSWORLD",
        });
      }
    }
  }

  // Also try to extract from HTML links to transworld/tworld
  const linkPattern =
    /href=["'](https?:\/\/(?:www\.)?(?:tworld|transworld)[^"']*\/(?:listing|business)[^"']+)["'][^>]*>([^<]{10,100})/gi;

  let linkMatch;
  while ((linkMatch = linkPattern.exec(html)) !== null) {
    const sourceUrl = linkMatch[1];
    const title = decodeHtmlEntities(linkMatch[2]).trim();

    if (isJunkTitle(title)) continue;
    if (listings.some((l) => l.title === title)) continue;

    const startIdx = linkMatch.index;
    const context = html.substring(startIdx, startIdx + 500);
    const askingPrice = extractMoneyFromContext(context, ["price"]);

    listings.push({
      title,
      sourceUrl,
      askingPrice,
      cashFlow: null,
      revenue: null,
      city: null,
      state: "CO",
      description: null,
      platform: "TRANSWORLD",
    });
  }

  return listings;
}

// ─────────────────────────────────────────────
// Junk title filtering
// ─────────────────────────────────────────────

/** Common junk titles from email navigation/footer links */
const JUNK_TITLES = new Set([
  "help center",
  "dealstream",
  "climate change",
  "change your email preferences",
  "request information",
  "unsubscribe",
  "view all",
  "click here",
  "manage",
  "update my buyer profile",
  "explore more opportunities",
  "all listings",
  "update now",
  "learn more",
  "our services",
  "view listing",
  "view online",
  "browse listings",
  "see all listings",
  "contact us",
  "privacy policy",
  "terms of service",
  "bizbuysell",
  "bizquest",
  "loopnet",
  "showing",
  "request info",
  "want less email? no problem...",
  "funding wanted",
  "funding available",
]);

/** Known newsletter senders that should not be parsed as listings */
const NEWSLETTER_SENDERS = [
  "newsletters.dealstream.com",
  "motley.fool.com",
];

/** Words that, if the title consists mostly of them, indicate junk */
const JUNK_PATTERNS = [
  /^(view|browse|explore|see|show|update|manage|change|click)/i,
  /^(our |the |a |an |your )/i,
  /^\d+\s+(new|matching|results?)/i, // "2 new listings match..."
  /^(email|preferences|profile|settings|help|support|faq)/i,
  /^(follow|connect|share|subscribe|sign)/i,
  /\.(com|net|org|io)\b/i, // Domain names
  /^https?:/i, // URLs
  /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i, // Dates
  /^(want less|no problem|manage your|update your)/i, // Footer text
  /^[A-Z][a-z]+,\s*[A-Z]{2}\s*-/i, // Location-prefixed entries like "Richmond, KY - ..."
  /^.+\s-\s.+\s-\s\$/i, // Multi-dash entries with prices like "State - Category - $Price"
  /^.+\s-\s.+\s-\sOn Request/i, // "State - Category - On Request"
  /^.+\s-\s.+\s-\s.+Will Stay/i, // "State - Category - Price - Management Will Stay"
  /\$[\d,]+.*\(\$[\d,]+.*CAD\)/i, // Contains CAD price conversion
];

function isJunkTitle(title: string): boolean {
  const lower = title.toLowerCase().trim();

  if (JUNK_TITLES.has(lower)) return true;
  if (lower.length < 5) return true;
  if (JUNK_PATTERNS.some((p) => p.test(lower))) return true;

  // Too short to be a real business listing title
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length < 2) return true;

  return false;
}

// ─────────────────────────────────────────────
// Context extraction helpers
// ─────────────────────────────────────────────

function extractMoneyFromContext(
  context: string,
  keywords: string[]
): number | null {
  const plainText = stripHtml(context);

  for (const keyword of keywords) {
    const keywordIdx = plainText.toLowerCase().indexOf(keyword);
    if (keywordIdx === -1) continue;

    const afterKeyword = plainText.substring(keywordIdx, keywordIdx + 100);
    const moneyMatch = afterKeyword.match(
      /\$[\d,]+(?:\.\d{2})?|\$[\d.]+\s*(?:million|mil|m|thousand|k)/i
    );

    if (moneyMatch) {
      const parsed = parsePrice(moneyMatch[0]);
      if (parsed !== null && parsed > 0) return parsed;
    }
  }

  return null;
}

function extractPriceNearTitle(
  plainText: string,
  searchTerm: string
): number | null {
  const idx = plainText.toLowerCase().indexOf(searchTerm.toLowerCase());
  if (idx === -1) return null;

  const context = plainText.substring(idx, idx + 300);
  const moneyMatch = context.match(
    /\$[\d,]+(?:\.\d{2})?|\$[\d.]+\s*(?:million|mil|m|thousand|k)/i
  );

  if (moneyMatch) {
    const parsed = parsePrice(moneyMatch[0]);
    if (parsed !== null && parsed > 0) return parsed;
  }

  return null;
}

function extractLocationFromContext(
  context: string
): { city: string; state: string } | null {
  const plainText = stripHtml(context);
  const location = parseLocation(plainText);

  if (location.city && location.state) {
    return { city: location.city, state: location.state };
  }

  return null;
}

// ─────────────────────────────────────────────
// Conversion helpers
// ─────────────────────────────────────────────

function alertToRawListing(alert: ExtractedAlertListing): RawListing | null {
  if (!alert.sourceUrl || !alert.title) return null;

  return {
    sourceId: null,
    sourceUrl: alert.sourceUrl,
    platform: alert.platform,
    title: alert.title,
    askingPrice: alert.askingPrice,
    revenue: alert.revenue,
    cashFlow: alert.cashFlow,
    ebitda: null,
    sde: null,
    industry: null,
    category: null,
    city: alert.city,
    state: alert.state,
    zipCode: null,
    description: alert.description,
    brokerName: null,
    brokerCompany: null,
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
    rawData: { source: "email_alert", platform: alert.platform },
  };
}

// ─────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────

/**
 * Extract visible text nodes from HTML, preserving boundaries between tags.
 * Returns individual text segments, not a single concatenated string.
 * This preserves the document structure that stripHtml() loses.
 */
function extractTextNodes(html: string): string[] {
  // Remove style and script blocks
  const cleaned = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Split on tags to get text between them
  const segments = cleaned.split(/<[^>]+>/);

  return segments
    .map((s) => decodeHtmlEntities(s.replace(/\s+/g, " ").trim()))
    .filter((s) => s.length > 0 && s !== "&nbsp;");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}
