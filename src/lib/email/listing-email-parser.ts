/**
 * Listing email parser — extracts listing data from email alerts.
 *
 * Parses HTML bodies from BizBuySell, BizQuest, DealStream, Transworld,
 * and other listing platforms to extract deal data and feed through the
 * standard post-processor pipeline.
 *
 * Enhanced extraction: pulls EBITDA, SDE, broker info, industry/category,
 * description, employees, and other fields from email context when available.
 */

import { prisma } from "@/lib/db";
import {
  parsePrice,
  parseLocation,
  extractEmails,
  extractPhones,
} from "@/lib/scrapers/parser-utils";
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
  ebitda: number | null;
  sde: number | null;
  city: string | null;
  state: string | null;
  description: string | null;
  industry: string | null;
  category: string | null;
  brokerName: string | null;
  brokerCompany: string | null;
  brokerPhone: string | null;
  brokerEmail: string | null;
  employees: number | null;
  established: number | null;
  sellerFinancing: boolean | null;
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

  // Match both /Business-Opportunity/ and /businesses-for-sale/ URL patterns
  const linkPattern =
    /href=["'](https?:\/\/(?:www\.)?bizbuysell\.com\/(?:Business-Opportunity|businesses-for-sale)\/[^"']+)["'][^>]*>([^<]+)/gi;

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const sourceUrl = match[1];
    const title = decodeHtmlEntities(match[2]).trim();

    if (!title || title.length < 5) continue;
    if (isJunkTitle(title)) continue;

    // Expanded context window for richer extraction
    const startIdx = match.index;
    const context = html.substring(startIdx, startIdx + 1500);

    const listing = extractFullListingFromContext(context, {
      title,
      sourceUrl,
      platform: "BIZBUYSELL",
    });

    listings.push(listing);
  }

  return listings;
}

// ─────────────────────────────────────────────
// BizQuest parser
// ─────────────────────────────────────────────

function parseBizQuestAlert(html: string): ExtractedAlertListing[] {
  const listings: ExtractedAlertListing[] = [];

  // Match both /listing-detail/ and /listing/ URL patterns
  const linkPattern =
    /href=["'](https?:\/\/(?:www\.)?bizquest\.com\/(?:listing-detail|listing)\/[^"']+)["'][^>]*>([^<]+)/gi;

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const sourceUrl = match[1];
    const title = decodeHtmlEntities(match[2]).trim();

    if (!title || title.length < 5) continue;
    if (isJunkTitle(title)) continue;

    // Expanded context window
    const startIdx = match.index;
    const context = html.substring(startIdx, startIdx + 1500);

    const listing = extractFullListingFromContext(context, {
      title,
      sourceUrl,
      platform: "BIZQUEST",
    });

    listings.push(listing);
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
  const textNodes = extractTextNodes(html);

  let inListingSection = false;
  let currentCategory: string | null = null;
  const seenTitles = new Set<string>();

  for (let i = 0; i < textNodes.length; i++) {
    const text = textNodes[i].trim();

    // Detect start of listing section
    if (text.includes("Today's New Listings") || text.includes("new listings that were just posted")) {
      inListingSection = true;
      continue;
    }

    // Capture category headers like "Businesses For Sale - Construction"
    const categoryMatch = text.match(/^Businesses For Sale\s*-\s*(.+)/i);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
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

        // Look for price in nearby text nodes (within next 3 nodes)
        let askingPrice: number | null = null;
        let location: { city: string; state: string } | null = null;

        for (let j = i + 1; j < textNodes.length && j <= i + 5; j++) {
          const nearby = textNodes[j].trim();
          // Look for price patterns
          if (!askingPrice) {
            const priceMatch = nearby.match(/\$[\d,]+(?:\.\d{2})?/);
            if (priceMatch) {
              askingPrice = parsePrice(priceMatch[0]);
            }
          }
          // Look for location patterns (City, ST)
          if (!location) {
            const locMatch = nearby.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})$/);
            if (locMatch) {
              location = { city: locMatch[1], state: locMatch[2] };
            }
          }
        }

        listings.push({
          title: normalizedTitle,
          sourceUrl: `https://www.dealstream.com/search?q=${encodeURIComponent(normalizedTitle)}`,
          askingPrice,
          cashFlow: null,
          revenue: null,
          ebitda: null,
          sde: null,
          city: location?.city ?? null,
          state: location?.state ?? null,
          description: null,
          industry: null,
          category: currentCategory,
          brokerName: null,
          brokerCompany: null,
          brokerPhone: null,
          brokerEmail: null,
          employees: null,
          established: null,
          sellerFinancing: null,
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

      // Extract more data from the email body
      const askingPrice = extractPriceNearTitle(plainText, "asking price") ??
        extractPriceNearTitle(plainText, "price");
      const revenue = extractPriceNearTitle(plainText, "revenue");
      const ebitda = extractPriceNearTitle(plainText, "ebitda");
      const cashFlow = extractPriceNearTitle(plainText, "cash flow");
      const location = extractLocationFromContext(html);

      listings.push({
        title,
        sourceUrl: `https://www.dealstream.com/search?q=${encodeURIComponent(title)}`,
        askingPrice,
        cashFlow,
        revenue,
        ebitda,
        sde: null,
        city: location?.city ?? null,
        state: location?.state ?? null,
        description: plainText.length > 100 ? plainText.substring(0, 500) : null,
        industry: null,
        category: null,
        brokerName: null,
        brokerCompany: null,
        brokerPhone: null,
        brokerEmail: null,
        employees: null,
        established: null,
        sellerFinancing: null,
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
 */
function parseTransworldAlert(html: string): ExtractedAlertListing[] {
  const listings: ExtractedAlertListing[] = [];

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

        // Look for location in nearby text nodes
        let city: string | null = null;
        let state: string | null = "CO"; // Default for Transworld CO office

        for (let j = i - 4; j <= i + 3 && j < textNodes.length; j++) {
          if (j < 0 || j === i) continue;
          const nearby = textNodes[j].trim();
          const locMatch = nearby.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})$/);
          if (locMatch) {
            city = locMatch[1];
            state = locMatch[2];
            break;
          }
        }

        listings.push({
          title,
          sourceUrl: `https://www.tworld.com/search?q=${encodeURIComponent(title)}`,
          askingPrice,
          cashFlow: null,
          revenue: null,
          ebitda: null,
          sde: null,
          city,
          state,
          description: null,
          industry: null,
          category: null,
          brokerName: null,
          brokerCompany: null,
          brokerPhone: null,
          brokerEmail: null,
          employees: null,
          established: null,
          sellerFinancing: null,
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
    const context = html.substring(startIdx, startIdx + 1000);

    const listing = extractFullListingFromContext(context, {
      title,
      sourceUrl,
      platform: "TRANSWORLD",
    });
    listing.state = listing.state ?? "CO"; // Default for Transworld CO office
    listings.push(listing);
  }

  return listings;
}

// ─────────────────────────────────────────────
// Enhanced context extraction
// ─────────────────────────────────────────────

/**
 * Extract all available listing fields from the HTML context around a listing link.
 * This is the enhanced extraction that pulls EBITDA, SDE, broker info, etc.
 */
function extractFullListingFromContext(
  context: string,
  base: { title: string; sourceUrl: string; platform: string }
): ExtractedAlertListing {
  const plainText = stripHtml(context);

  // Financial fields
  const askingPrice = extractMoneyFromContext(context, [
    "asking price",
    "price",
    "listed at",
  ]);
  const cashFlow = extractMoneyFromContext(context, [
    "cash flow",
    "discretionary cash flow",
    "discretionary",
  ]);
  const revenue = extractMoneyFromContext(context, [
    "gross revenue",
    "revenue",
    "annual revenue",
    "sales",
  ]);
  const ebitda = extractMoneyFromContext(context, ["ebitda"]);
  const sde = extractMoneyFromContext(context, [
    "sde",
    "seller's discretionary earnings",
    "seller discretionary earnings",
    "seller's discretionary",
  ]);

  // Location
  const location = extractLocationFromContext(context);

  // Broker info from context
  const brokerInfo = extractBrokerFromContext(context);

  // Description: grab a clean text snippet (first substantive paragraph near the listing)
  const description = extractDescriptionFromContext(plainText, base.title);

  // Industry / category from context
  const industry = extractLabelValue(plainText, [
    "industry",
    "business type",
    "type",
  ]);
  const category = extractLabelValue(plainText, [
    "category",
    "sub-category",
    "subcategory",
  ]);

  // Employees
  const employeesText = extractLabelValue(plainText, [
    "employees",
    "number of employees",
    "# of employees",
    "staff",
  ]);
  const employees = employeesText
    ? parseInt(employeesText.replace(/\D/g, ""), 10) || null
    : null;

  // Year established
  const establishedText = extractLabelValue(plainText, [
    "established",
    "year established",
    "founded",
  ]);
  const established = establishedText
    ? parseInt(establishedText.replace(/\D/g, ""), 10) || null
    : null;

  // Seller financing
  const financingText = extractLabelValue(plainText, [
    "seller financing",
    "owner financing",
    "financing",
  ]);
  const sellerFinancing = financingText
    ? /yes|available|offered|true/i.test(financingText)
    : null;

  return {
    title: base.title,
    sourceUrl: base.sourceUrl,
    askingPrice,
    cashFlow,
    revenue,
    ebitda,
    sde,
    city: location?.city ?? null,
    state: location?.state ?? null,
    description,
    industry,
    category,
    brokerName: brokerInfo.name,
    brokerCompany: brokerInfo.company,
    brokerPhone: brokerInfo.phone,
    brokerEmail: brokerInfo.email,
    employees,
    established,
    sellerFinancing,
    platform: base.platform,
  };
}

/**
 * Extract broker information from the HTML context.
 * Looks for broker sections, contact info patterns, and email/phone.
 */
function extractBrokerFromContext(context: string): {
  name: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
} {
  const plainText = stripHtml(context);

  // Try to find broker name from labeled patterns
  const brokerName = extractLabelValue(plainText, [
    "broker",
    "listed by",
    "contact",
    "intermediary",
    "agent",
  ]);

  // Try to find company
  const brokerCompany = extractLabelValue(plainText, [
    "brokerage",
    "firm",
    "company",
    "intermediary firm",
  ]);

  // Extract phone numbers from the context (prefer broker section)
  const phones = extractPhones(plainText);
  const brokerPhone = phones[0] || null;

  // Extract email addresses
  const emails = extractEmails(plainText);
  // Filter out common non-broker emails
  const brokerEmail = emails.find(
    (e) =>
      !e.includes("noreply") &&
      !e.includes("no-reply") &&
      !e.includes("support@") &&
      !e.includes("info@bizbuysell") &&
      !e.includes("info@bizquest") &&
      !e.includes("unsubscribe")
  ) ?? null;

  return {
    name: brokerName,
    company: brokerCompany,
    phone: brokerPhone,
    email: brokerEmail,
  };
}

/**
 * Extract a clean description snippet from the plain text near the listing title.
 */
function extractDescriptionFromContext(
  plainText: string,
  title: string
): string | null {
  const titleIdx = plainText.indexOf(title);
  if (titleIdx === -1) return null;

  // Get text after the title
  const afterTitle = plainText.substring(titleIdx + title.length).trim();

  // Take first 300 chars, stopping at a sentence boundary if possible
  if (afterTitle.length < 20) return null;

  const snippet = afterTitle.substring(0, 300);
  const sentenceEnd = snippet.lastIndexOf(".");
  const cleaned = sentenceEnd > 50
    ? snippet.substring(0, sentenceEnd + 1).trim()
    : snippet.trim();

  // Filter out junk descriptions
  if (cleaned.length < 20) return null;
  if (/^(view|click|browse|learn|contact|call|email)/i.test(cleaned)) return null;

  return cleaned;
}

/**
 * Extract a value that follows a label in plain text.
 * Example: "Industry: Manufacturing" → "Manufacturing"
 */
function extractLabelValue(
  plainText: string,
  labels: string[]
): string | null {
  for (const label of labels) {
    // Pattern: "Label: Value" or "Label Value" (with colon optional)
    const pattern = new RegExp(
      `${escapeRegex(label)}[:\\s]+([^\\n$]{2,50})`,
      "i"
    );
    const match = plainText.match(pattern);
    if (match) {
      const value = match[1].trim();
      // Don't return values that look like more labels or junk
      if (value.length > 1 && value.length < 50 && !/^[\d$]/.test(value)) {
        return value;
      }
    }
  }
  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    ebitda: alert.ebitda,
    sde: alert.sde,
    industry: alert.industry,
    category: alert.category,
    city: alert.city,
    state: alert.state,
    zipCode: null,
    description: alert.description,
    brokerName: alert.brokerName,
    brokerCompany: alert.brokerCompany,
    brokerPhone: alert.brokerPhone,
    brokerEmail: alert.brokerEmail,
    employees: alert.employees,
    established: alert.established,
    sellerFinancing: alert.sellerFinancing,
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
