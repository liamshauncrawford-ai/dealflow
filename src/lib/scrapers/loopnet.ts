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

const BASE_URL = "https://www.loopnet.com";

export class LoopNetScraper extends BaseScraper {
  constructor() {
    super("LOOPNET");
  }

  // ── Search URL builder ──

  buildSearchUrl(filters: ScraperFilters): string {
    // LoopNet uses path-based state filtering for business listings
    const state = (filters.state ?? "colorado").toLowerCase().replace(/\s+/g, "-");
    let url = `${BASE_URL}/biz/${state}/businesses-for-sale/`;

    const params = new URLSearchParams();

    if (filters.minPrice !== undefined) {
      params.set("pricemin", String(filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      params.set("pricemax", String(filters.maxPrice));
    }
    if (filters.minCashFlow !== undefined) {
      params.set("cashflowmin", String(filters.minCashFlow));
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

    // LoopNet uses placard-style listing cards in search results.
    // Try several selector patterns that LoopNet has used across iterations.
    const listingCards = $(
      ".placard, .listing-card, .search-result, [class*='placard'], [class*='listing']"
    );

    listingCards.each((_index, element) => {
      try {
        const card = $(element);

        // Find the main link to the detail page
        const linkEl = card
          .find(
            "a.placard-header, a.listing-title, a[href*='/biz/'], a[href*='/Listing/'], h2 a, h3 a"
          )
          .first();
        const href = linkEl.attr("href");
        if (!href) return; // Skip cards without a link

        const detailUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

        // Parse the title from the link or a heading element
        const title = normalizeText(
          linkEl.text() ||
            card.find("h2, h3, .placard-title, [class*='title']").first().text()
        );
        if (!title) return;

        // Asking price -- LoopNet uses various price containers
        const priceText =
          card
            .find(
              ".placard-price, .price, [class*='price'], [class*='Price'], .asking-price"
            )
            .first()
            .text() || "";
        const askingPrice = parsePrice(priceText);

        // Cash flow
        const cashFlowText =
          card
            .find("[class*='cashFlow'], [class*='cash-flow'], [class*='CashFlow']")
            .first()
            .text() || "";
        const cashFlow = parsePrice(cashFlowText);

        // Location -- LoopNet typically shows location in the placard subtitle
        const locationText = normalizeText(
          card
            .find(
              ".placard-subtitle, .location, [class*='location'], [class*='address'], .subtitle"
            )
            .first()
            .text()
        );
        const location = parseLocation(locationText);

        // Business type / category
        const category = normalizeText(
          card
            .find("[class*='type'], [class*='category'], .property-type, .business-type")
            .first()
            .text()
        ) || null;

        results.push({
          url: detailUrl,
          preview: {
            title,
            askingPrice,
            cashFlow,
            city: location.city,
            state: location.state,
            zipCode: location.zipCode,
            category,
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
        "h1, .listing-title, [class*='listingTitle'], [class*='propertyTitle'], .profile-hero-title"
      )
        .first()
        .text()
    );

    // ── Business name ──
    // LoopNet may show a separate business name from the listing title
    const businessName =
      normalizeText(
        this.extractTextByLabel($, ["Business Name", "Company Name", "Name"])
      ) || null;

    // ── Financial fields ──
    const askingPrice = this.extractFinancialField($, [
      "Asking Price",
      "Price",
      "Sale Price",
      "Listing Price",
    ]);
    const revenue = this.extractFinancialField($, [
      "Gross Revenue",
      "Revenue",
      "Annual Revenue",
      "Total Revenue",
    ]);
    const cashFlow = this.extractFinancialField($, [
      "Cash Flow",
      "Discretionary Cash Flow",
      "Net Cash Flow",
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
      "Included Inventory",
    ]);
    const ffe = this.extractFinancialField($, [
      "FF&E",
      "Furniture, Fixtures & Equipment",
      "Fixtures & Equipment",
      "FFE",
    ]);
    const realEstate = this.extractFinancialField($, [
      "Real Estate",
      "Real Estate Value",
      "Real Estate Included",
      "Property Value",
      "Property Included",
    ]);

    // ── Location ──
    // LoopNet often has structured address sections for properties
    const locationText =
      $(
        ".property-address, .listing-address, [class*='address'], [class*='location'], .profile-hero-sub-title"
      )
        .first()
        .text() ||
      this.extractTextByLabel($, [
        "Location",
        "Address",
        "City",
        "Property Address",
      ]);
    const location = parseLocation(locationText);

    // Try to get a more specific zip code from structured data
    const zipFromLabel = this.extractTextByLabel($, ["Zip Code", "Zip", "Postal Code"]);
    const zipMatch = zipFromLabel.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zipMatch && !location.zipCode) {
      location.zipCode = zipMatch[1];
    }

    // County
    const county =
      normalizeText(this.extractTextByLabel($, ["County"])) || null;

    // Full address
    const fullAddress =
      normalizeText(
        $(
          ".full-address, [class*='fullAddress'], [class*='full-address']"
        )
          .first()
          .text() || this.extractTextByLabel($, ["Full Address", "Address"])
      ) || null;

    // ── Industry / Category ──
    const industry =
      normalizeText(
        this.extractTextByLabel($, [
          "Industry",
          "Business Type",
          "Type of Business",
          "Type",
        ])
      ) || null;

    const category =
      normalizeText(
        this.extractTextByLabel($, [
          "Category",
          "Property Type",
          "Sub-Category",
          "Subcategory",
          "Property Sub-type",
        ])
      ) || null;

    const subcategory =
      normalizeText(
        this.extractTextByLabel($, [
          "Subcategory",
          "Sub-Category",
          "Sub-type",
          "Sub Type",
        ])
      ) || null;

    // ── Broker / Listing agent info ──
    // LoopNet uses "Listing Agent", "Broker", and "Listed By" patterns
    const brokerSection = $(
      ".broker, .brokerInfo, [class*='broker'], [class*='agent'], .listing-agent, .contactInfo, [class*='contact'], .profile-contact"
    );

    const brokerName =
      normalizeText(
        brokerSection
          .find(
            ".name, .agent-name, .broker-name, [class*='name'], h3, h4"
          )
          .first()
          .text()
      ) ||
      normalizeText(
        this.extractTextByLabel($, [
          "Listing Agent",
          "Broker",
          "Agent",
          "Listed By",
          "Contact",
        ])
      ) ||
      null;

    const brokerCompany =
      normalizeText(
        brokerSection
          .find(
            ".company, .agent-company, .broker-company, [class*='company'], [class*='firm']"
          )
          .first()
          .text()
      ) ||
      normalizeText(
        this.extractTextByLabel($, ["Company", "Firm", "Brokerage"])
      ) ||
      null;

    // Extract phone and email from the broker section or full page
    const brokerSectionText = brokerSection.text();
    const pageText = $("body").text();

    const phones = extractPhones(brokerSectionText);
    const emails = extractEmails(brokerSectionText);
    const brokerPhone = phones[0] || extractPhones(pageText)[0] || null;
    const brokerEmail = emails[0] || null;

    // ── Operational details ──
    const employeesText = this.extractTextByLabel($, [
      "Employees",
      "Number of Employees",
      "# of Employees",
      "Full-Time Employees",
      "Total Employees",
    ]);
    const employees = employeesText
      ? parseInt(employeesText.replace(/\D/g, ""), 10) || null
      : null;

    const establishedText = this.extractTextByLabel($, [
      "Established",
      "Year Established",
      "Founded",
      "Year Founded",
      "In Business Since",
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
          "Why Selling",
        ])
      ) || null;

    // ── Facilities ──
    // LoopNet has detailed real estate/facility information
    const facilitiesParts: string[] = [];
    const facilityLabels = [
      "Facilities",
      "Facility",
      "Building Size",
      "Lot Size",
      "Square Footage",
      "Sq Ft",
      "Lease Information",
      "Lease Type",
      "Lease Rate",
      "Lease Expiration",
      "Zoning",
      "Parking",
      "Building Class",
    ];
    for (const label of facilityLabels) {
      const value = normalizeText(this.extractTextByLabel($, [label]));
      if (value) {
        facilitiesParts.push(`${label}: ${value}`);
      }
    }
    const facilities = facilitiesParts.length > 0 ? facilitiesParts.join("; ") : null;

    // ── Description ──
    const description =
      normalizeText(
        $(
          ".listing-description, .property-description, .description, [class*='description'], #description, .profile-description, .business-description"
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
      "Days on Market",
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
    $("dt, .label, th, [class*='label'], [class*='Label']").each((_i, el) => {
      const label = normalizeText($(el).text()).replace(/:$/, "");
      const valueEl = $(el).next("dd, .value, td, [class*='value'], [class*='Value']");
      const value = normalizeText(valueEl.text());
      if (label && value) {
        rawData[label] = value;
      }
    });

    return {
      sourceId,
      sourceUrl: url,
      title: title || "Untitled Listing",
      businessName,
      askingPrice,
      revenue,
      cashFlow,
      ebitda,
      sde,
      inventory,
      ffe,
      realEstate,
      industry,
      category,
      subcategory,
      city: location.city,
      state: location.state,
      county,
      zipCode: location.zipCode,
      fullAddress,
      description,
      brokerName,
      brokerCompany,
      brokerPhone,
      brokerEmail,
      employees,
      established,
      sellerFinancing,
      reasonForSale,
      facilities,
      listingDate,
      rawData,
    };
  }

  // ── Pagination ──

  getNextPageUrl(html: string): string | null {
    const $ = cheerio.load(html);

    // LoopNet pagination: look for "Next" link, right-arrow, or numbered page links
    const nextLink = $(
      'a.next, a[rel="next"], .pagination a:contains("Next"), .pager a:contains("Next"), a:contains("Next >"), a[aria-label="Next"], .pagination-next a, [class*="pagination"] a:contains(">")'
    ).first();

    const href = nextLink.attr("href");
    if (!href) return null;

    return href.startsWith("http") ? href : `${BASE_URL}${href}`;
  }

  // ── Private helpers ──

  /**
   * Extract a financial value by searching for a label followed by a value.
   * LoopNet uses various markup patterns: dl/dt/dd, tables, divs with labels,
   * property detail sections, and structured data attributes.
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

      // Pattern 3: label/value div pairs (common in LoopNet property details)
      const labelMatch = $(
        `[class*='label']:contains("${label}"), .label:contains("${label}"), span:contains("${label}"), [class*='Label']:contains("${label}")`
      ).first();
      if (labelMatch.length) {
        const valueEl = labelMatch.next(
          "[class*='value'], .value, span, [class*='Value']"
        );
        const value = parsePrice(valueEl.text());
        if (value !== null) return value;

        // Try the parent's next sibling
        const parentNext = labelMatch.parent().next();
        const parentValue = parsePrice(parentNext.text());
        if (parentValue !== null) return parentValue;
      }

      // Pattern 4: LoopNet-specific data attributes
      const dataMatch = $(`[data-label="${label}"], [data-field="${label}"]`).first();
      if (dataMatch.length) {
        const value = parsePrice(dataMatch.text());
        if (value !== null) return value;
      }
    }

    return null;
  }

  /**
   * Extract text content associated with a label on the page.
   * Searches multiple common HTML patterns for label-value pairs.
   */
  private extractTextByLabel($: LoadedCheerio, labels: string[]): string {
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
        `[class*='label']:contains("${label}"), .label:contains("${label}"), span:contains("${label}"), [class*='Label']:contains("${label}")`
      ).first();
      if (labelMatch.length) {
        const valueEl = labelMatch.next(
          "[class*='value'], .value, span, [class*='Value']"
        );
        const text = normalizeText(valueEl.text());
        if (text) return text;

        const parentNext = labelMatch.parent().next();
        return normalizeText(parentNext.text());
      }

      // LoopNet data attributes
      const dataMatch = $(`[data-label="${label}"], [data-field="${label}"]`).first();
      if (dataMatch.length) {
        return normalizeText(dataMatch.text());
      }
    }

    return "";
  }

  /**
   * Extract a LoopNet listing source ID from the URL.
   * LoopNet URLs follow patterns like:
   *   /biz/.../12345678/
   *   /Listing/12345678/
   *   /listing/12345678-business-name/
   */
  private extractSourceId(url: string): string | null {
    // Pattern: /Listing/12345678 or /biz/.../12345678
    const idMatch = url.match(/\/(?:Listing|biz\/[^/]+)\/(\d{5,})(?:[/?#-]|$)/i);
    if (idMatch) return idMatch[1];

    // Fallback: last numeric segment of at least 5 digits
    const numericMatch = url.match(/\/(\d{5,})(?:[/?#]|$)/);
    if (numericMatch) return numericMatch[1];

    // Try query parameter
    try {
      const urlObj = new URL(url);
      return (
        urlObj.searchParams.get("id") ||
        urlObj.searchParams.get("listingId") ||
        null
      );
    } catch {
      return null;
    }
  }

  /**
   * Parse a date string into a Date object. Handles various formats
   * including "X days on market" patterns common on LoopNet.
   */
  private parseDate(text: string): Date | null {
    if (!text) return null;
    const cleaned = normalizeText(text);

    // Handle "X days on market" / "X days ago" patterns
    const daysMatch = cleaned.match(/(\d+)\s*days?\s*(?:on\s*market|ago)/i);
    if (daysMatch) {
      const daysAgo = parseInt(daysMatch[1], 10);
      if (!isNaN(daysAgo)) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date;
      }
    }

    // Standard date parsing
    const parsed = new Date(cleaned);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
}
