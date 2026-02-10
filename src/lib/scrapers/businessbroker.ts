import * as cheerio from "cheerio";
import { BaseScraper } from "./base-scraper";
import type { ScraperFilters, RawListing } from "./base-scraper";
import {
  parsePrice,
  parseLocation,
  normalizeText,
  extractEmails,
  extractPhones,
} from "./parser-utils";

type LoadedCheerio = ReturnType<typeof cheerio.load>;

const BASE_URL = "https://www.businessbroker.net";

export class BusinessBrokerScraper extends BaseScraper {
  constructor() {
    super("BUSINESSBROKER");
  }

  // ── Search URL builder ──

  buildSearchUrl(filters: ScraperFilters): string {
    // BusinessBroker.net uses path-based state filtering plus query params
    const state = (filters.state ?? "colorado").toLowerCase().replace(/\s+/g, "-");
    let url = `${BASE_URL}/businesses-for-sale/${state}`;

    const params = new URLSearchParams();

    if (filters.minPrice !== undefined) {
      params.set("price_min", String(filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      params.set("price_max", String(filters.maxPrice));
    }
    if (filters.minCashFlow !== undefined) {
      params.set("cashflow_min", String(filters.minCashFlow));
    }
    if (filters.city) {
      params.set("city", filters.city);
    }

    const paramString = params.toString();
    if (paramString) {
      url += `?${paramString}`;
    }

    return url;
  }

  // ── Search results parser ──

  parseSearchResults(
    html: string
  ): Array<{ url: string; preview: Partial<RawListing> }> {
    const $ = cheerio.load(html);
    const results: Array<{ url: string; preview: Partial<RawListing> }> = [];

    // BusinessBroker.net uses several possible selectors for listing cards.
    const listingCards = $(
      ".listing-card, .listing, .search-result, [class*='listing'], .business-listing"
    );

    listingCards.each((_index, element) => {
      try {
        const card = $(element);

        // Find the main link to the detail page
        const linkEl = card
          .find(
            "a.listing-title, a.listingLink, h3 a, h2 a, a[href*='/listing/'], a[href*='/business/']"
          )
          .first();
        const href = linkEl.attr("href");
        if (!href) return; // Skip cards without a link

        const detailUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

        // Parse preview data from the card
        const title = normalizeText(linkEl.text());
        if (!title) return;

        // Asking price -- look for common price containers
        const priceText =
          card
            .find(".price, .asking-price, [class*='price'], .listingPrice")
            .first()
            .text() ||
          card.find("span:contains('Asking Price')").next().text();
        const askingPrice = parsePrice(priceText);

        // Cash flow
        const cashFlowText =
          card
            .find("[class*='cashFlow'], [class*='cash-flow']")
            .first()
            .text() ||
          card.find("span:contains('Cash Flow')").next().text();
        const cashFlow = parsePrice(cashFlowText);

        // Location
        const locationText =
          card
            .find(".location, .listingLocation, [class*='location']")
            .first()
            .text() ||
          card.find("span:contains('Location')").next().text();
        const location = parseLocation(locationText);

        // Short description
        const description = normalizeText(
          card
            .find(
              ".description, .listingDescription, [class*='description'], p"
            )
            .first()
            .text()
        );

        results.push({
          url: detailUrl,
          preview: {
            title,
            askingPrice,
            cashFlow,
            city: location.city,
            state: location.state,
            zipCode: location.zipCode,
            description: description || null,
          },
        });
      } catch {
        // Skip malformed cards
      }
    });

    return results;
  }

  // ── Detail page parser ──

  async parseDetailPage(html: string, url: string): Promise<RawListing> {
    const $ = cheerio.load(html);

    // ── Title ──
    const title = normalizeText(
      $(
        "h1, .listing-title, .businessTitle, [class*='listingTitle']"
      )
        .first()
        .text()
    );

    // ── Financial fields ──
    const askingPrice = this.extractFinancialField($, [
      "Asking Price",
      "Price",
      "List Price",
    ]);
    const revenue = this.extractFinancialField($, [
      "Gross Revenue",
      "Revenue",
      "Annual Revenue",
      "Annual Sales",
    ]);
    const cashFlow = this.extractFinancialField($, [
      "Cash Flow",
      "Discretionary Cash Flow",
      "Owner Cash Flow",
    ]);
    const ebitda = this.extractFinancialField($, ["EBITDA"]);
    const sde = this.extractFinancialField($, [
      "SDE",
      "Seller's Discretionary Earnings",
      "Seller Discretionary Earnings",
    ]);
    const inventory = this.extractFinancialField($, [
      "Inventory",
      "Inventory Included",
    ]);
    const ffe = this.extractFinancialField($, [
      "FF&E",
      "Furniture, Fixtures & Equipment",
      "Fixtures & Equipment",
    ]);
    const realEstate = this.extractFinancialField($, [
      "Real Estate",
      "Real Estate Included",
      "Property",
      "Property Value",
    ]);

    // ── Location ──
    const locationText =
      $(
        ".location, .listingLocation, [class*='location'], .businessLocation"
      )
        .first()
        .text() ||
      this.extractTextByLabel($, ["Location", "City", "State"]);
    const location = parseLocation(locationText);

    // ── Industry / Category ──
    const industry =
      normalizeText(
        this.extractTextByLabel($, [
          "Industry",
          "Business Type",
          "Type",
        ])
      ) || null;
    const category =
      normalizeText(
        this.extractTextByLabel($, [
          "Category",
          "Sub-Category",
          "Subcategory",
        ])
      ) || null;

    // ── Broker info ──
    const brokerSection = $(
      ".broker, .brokerInfo, [class*='broker'], .contactInfo, .listingBroker, .agent-info"
    );
    const brokerName =
      normalizeText(
        brokerSection
          .find(".brokerName, .name, h3, h4, [class*='name']")
          .first()
          .text()
      ) || null;
    const brokerCompany =
      normalizeText(
        brokerSection
          .find(".company, .brokerCompany, [class*='company']")
          .first()
          .text()
      ) || null;

    // Extract phone and email from the broker section or full page
    const brokerText = brokerSection.text();
    const pageText = $("body").text();
    const phones = extractPhones(brokerText);
    const emails = extractEmails(brokerText);
    const brokerPhone = phones[0] || extractPhones(pageText)[0] || null;
    const brokerEmail = emails[0] || null;

    // ── Business details ──
    const employeesText = this.extractTextByLabel($, [
      "Employees",
      "Number of Employees",
      "# of Employees",
      "Full-Time Employees",
    ]);
    const employees = employeesText
      ? parseInt(employeesText.replace(/\D/g, ""), 10) || null
      : null;

    const establishedText = this.extractTextByLabel($, [
      "Established",
      "Year Established",
      "Founded",
    ]);
    const established = establishedText
      ? parseInt(establishedText.replace(/\D/g, ""), 10) || null
      : null;

    const sellerFinancingText = this.extractTextByLabel($, [
      "Seller Financing",
      "Owner Financing",
      "Financing",
      "Financing Available",
    ]);
    const sellerFinancing = sellerFinancingText
      ? /yes|available|offered|true/i.test(sellerFinancingText)
      : null;

    const reasonForSale =
      normalizeText(
        this.extractTextByLabel($, [
          "Reason for Selling",
          "Reason for Sale",
        ])
      ) || null;

    const facilities =
      normalizeText(
        this.extractTextByLabel($, [
          "Facilities",
          "Facility",
          "Real Estate",
          "Lease Information",
          "Building Information",
        ])
      ) || null;

    // ── Description ──
    const description =
      normalizeText(
        $(
          ".businessDescription, .listing-description, .description, [class*='description'], #businessDescription"
        )
          .first()
          .text()
      ) || null;

    // ── Listing date ──
    const dateText = this.extractTextByLabel($, [
      "Listed",
      "Date Listed",
      "Listing Date",
      "Date Added",
    ]);
    const listingDate = dateText ? this.parseDate(dateText) : null;

    // ── Source ID from URL ──
    const sourceId = this.extractSourceId(url);

    // ── Raw data snapshot ──
    const rawData: Record<string, unknown> = {
      scrapedUrl: url,
      scrapedAt: new Date().toISOString(),
      htmlTitle: $("title").text(),
    };

    // Collect all key-value pairs from the detail page
    $("dt, .label, th, [class*='label']").each((_i, el) => {
      const label = normalizeText($(el).text()).replace(/:$/, "");
      const valueEl = $(el).next("dd, .value, td, [class*='value']");
      const value = normalizeText(valueEl.text());
      if (label && value) {
        rawData[label] = value;
      }
    });

    return {
      sourceId,
      sourceUrl: url,
      title: title || "Untitled Listing",
      askingPrice,
      revenue,
      cashFlow,
      ebitda,
      sde,
      industry,
      category,
      city: location.city,
      state: location.state,
      zipCode: location.zipCode,
      description,
      brokerName,
      brokerCompany,
      brokerPhone,
      brokerEmail,
      employees,
      established,
      sellerFinancing,
      inventory,
      ffe,
      realEstate,
      reasonForSale,
      facilities,
      listingDate,
      rawData,
    };
  }

  // ── Pagination ──

  getNextPageUrl(html: string): string | null {
    const $ = cheerio.load(html);

    // BusinessBroker.net pagination: look for "Next" link or right-arrow pagination
    const nextLink = $(
      'a.next, a[rel="next"], .pagination a:contains("Next"), .pager a:contains("Next"), a:contains("Next >"), a.next-page'
    ).first();

    const href = nextLink.attr("href");
    if (!href) return null;

    return href.startsWith("http") ? href : `${BASE_URL}${href}`;
  }

  // ── Private helpers ──

  /**
   * Extract a financial value by searching for a label followed by a value.
   * BusinessBroker.net uses various markup patterns: dt/dd pairs, definition lists,
   * tables, and label/value divs.
   */
  private extractFinancialField(
    $: LoadedCheerio,
    labels: string[]
  ): number | null {
    for (const label of labels) {
      // Pattern 1: dt/dd pairs
      const dtMatch = $(`dt:contains("${label}")`).first();
      if (dtMatch.length) {
        const ddText = dtMatch.next("dd").text();
        const value = parsePrice(ddText);
        if (value !== null) return value;
      }

      // Pattern 2: th/td pairs
      const thMatch = $(`th:contains("${label}")`).first();
      if (thMatch.length) {
        const tdText =
          thMatch.next("td").text() || thMatch.parent().find("td").text();
        const value = parsePrice(tdText);
        if (value !== null) return value;
      }

      // Pattern 3: label/value div pairs
      const labelMatch = $(
        `[class*='label']:contains("${label}"), .label:contains("${label}"), span:contains("${label}")`
      ).first();
      if (labelMatch.length) {
        const valueEl = labelMatch.next("[class*='value'], .value, span");
        const value = parsePrice(valueEl.text());
        if (value !== null) return value;

        // Try the parent's next sibling
        const parentNext = labelMatch.parent().next();
        const parentValue = parsePrice(parentNext.text());
        if (parentValue !== null) return parentValue;
      }
    }

    return null;
  }

  /**
   * Extract text content associated with a label on the page.
   */
  private extractTextByLabel(
    $: LoadedCheerio,
    labels: string[]
  ): string {
    for (const label of labels) {
      // dt/dd
      const dtMatch = $(`dt:contains("${label}")`).first();
      if (dtMatch.length) {
        return normalizeText(dtMatch.next("dd").text());
      }

      // th/td
      const thMatch = $(`th:contains("${label}")`).first();
      if (thMatch.length) {
        return normalizeText(
          thMatch.next("td").text() || thMatch.parent().find("td").text()
        );
      }

      // label/value divs
      const labelMatch = $(
        `[class*='label']:contains("${label}"), .label:contains("${label}"), span:contains("${label}")`
      ).first();
      if (labelMatch.length) {
        const valueEl = labelMatch.next("[class*='value'], .value, span");
        const text = normalizeText(valueEl.text());
        if (text) return text;

        const parentNext = labelMatch.parent().next();
        return normalizeText(parentNext.text());
      }
    }

    return "";
  }

  /**
   * Extract a BusinessBroker.net listing source ID from the URL.
   * URLs follow patterns like: /listing/XXXXXXX or /business/XXXXXXX
   */
  private extractSourceId(url: string): string | null {
    // Pattern: /listing/123456 or /business/123456
    const pathMatch = url.match(/\/(?:listing|business)\/(\d+)/);
    if (pathMatch) return pathMatch[1];

    // Fallback: grab any long numeric ID from the URL
    const idMatch = url.match(/\/(\d{5,})(?:[/?#]|$)/);
    if (idMatch) return idMatch[1];

    // Try query parameter
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("id") || urlObj.searchParams.get("listing_id") || null;
    } catch {
      return null;
    }
  }

  /**
   * Parse a date string into a Date object. Handles various formats.
   */
  private parseDate(text: string): Date | null {
    if (!text) return null;
    const cleaned = normalizeText(text);
    const parsed = new Date(cleaned);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
}
