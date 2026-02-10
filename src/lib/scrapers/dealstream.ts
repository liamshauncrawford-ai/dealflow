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

const BASE_URL = "https://www.dealstream.com";

export class DealStreamScraper extends BaseScraper {
  constructor() {
    super("DEALSTREAM");
  }

  // ── Search URL builder ──

  buildSearchUrl(filters: ScraperFilters): string {
    const params = new URLSearchParams();

    if (filters.state) {
      params.set("location", filters.state.toLowerCase().replace(/\s+/g, "-"));
    }
    if (filters.minPrice !== undefined) {
      params.set("min_price", String(filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      params.set("max_price", String(filters.maxPrice));
    }
    if (filters.minCashFlow !== undefined) {
      params.set("min_cashflow", String(filters.minCashFlow));
    }
    if (filters.city) {
      params.set("city", filters.city.toLowerCase().replace(/\s+/g, "-"));
    }

    const paramString = params.toString();
    let url = `${BASE_URL}/businesses-for-sale`;

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

    // DealStream uses several possible selectors for listing cards
    const listingCards = $(
      ".deal-card, .listing, .deal-listing, [class*='deal'], .search-result"
    );

    listingCards.each((_index, element) => {
      try {
        const card = $(element);

        // Find the main link to the detail page
        const linkEl = card
          .find(
            "a.deal-title, a.listing-title, h3 a, h2 a, a[href*='/deal/'], a[href*='/business/'], a[href*='/listing/']"
          )
          .first();
        const href = linkEl.attr("href");
        if (!href) return; // Skip cards without a link

        const detailUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

        // Parse preview data from the card
        const title = normalizeText(linkEl.text());
        if (!title) return;

        // Asking price
        const priceText =
          card
            .find(".price, .deal-price, .asking-price, [class*='price']")
            .first()
            .text() ||
          card.find("span:contains('Asking Price')").next().text() ||
          card.find("span:contains('Price')").next().text();
        const askingPrice = parsePrice(priceText);

        // Cash flow
        const cashFlowText =
          card
            .find("[class*='cashFlow'], [class*='cash-flow'], [class*='cashflow']")
            .first()
            .text() ||
          card.find("span:contains('Cash Flow')").next().text();
        const cashFlow = parsePrice(cashFlowText);

        // Location
        const locationText =
          card
            .find(".location, .deal-location, [class*='location']")
            .first()
            .text() ||
          card.find("span:contains('Location')").next().text();
        const location = parseLocation(locationText);

        // Category
        const category =
          normalizeText(
            card
              .find(".category, .deal-category, [class*='category'], [class*='industry']")
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
      $("h1, .deal-title, .listing-title, [class*='dealTitle'], [class*='listingTitle']")
        .first()
        .text()
    );

    // ── Financial fields ──
    const askingPrice = this.extractFinancialField($, [
      "Asking Price",
      "Price",
      "Deal Price",
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
      "Annual Cash Flow",
    ]);
    const ebitda = this.extractFinancialField($, [
      "EBITDA",
      "Adjusted EBITDA",
    ]);
    const sde = this.extractFinancialField($, [
      "SDE",
      "Seller's Discretionary Earnings",
      "Seller Discretionary Earnings",
    ]);
    const inventory = this.extractFinancialField($, [
      "Inventory",
      "Inventory Included",
      "Inventory Value",
    ]);
    const ffe = this.extractFinancialField($, [
      "FF&E",
      "Furniture, Fixtures & Equipment",
      "Fixtures & Equipment",
      "FFE",
    ]);
    const realEstate = this.extractFinancialField($, [
      "Real Estate",
      "Real Estate Included",
      "Real Estate Value",
      "Property Value",
    ]);

    // ── Location ──
    const locationText =
      $(".location, .deal-location, [class*='location'], .businessLocation")
        .first()
        .text() ||
      this.extractTextByLabel($, ["Location", "City", "State", "Region"]);
    const location = parseLocation(locationText);

    // ── Industry / Category ──
    const industry =
      normalizeText(
        this.extractTextByLabel($, [
          "Industry",
          "Business Type",
          "Sector",
          "Type",
        ])
      ) || null;
    const category =
      normalizeText(
        this.extractTextByLabel($, [
          "Category",
          "Sub-Category",
          "Subcategory",
          "Sub-Sector",
        ])
      ) || null;

    // ── Advisor / Broker info ──
    // DealStream calls brokers "advisors"
    const brokerSection = $(
      ".advisor, .advisorInfo, .broker, .brokerInfo, [class*='advisor'], [class*='broker'], .contactInfo, .deal-contact"
    );
    const brokerName =
      normalizeText(
        brokerSection
          .find(
            ".advisorName, .brokerName, .name, h3, h4, [class*='name']"
          )
          .first()
          .text()
      ) || null;
    const brokerCompany =
      normalizeText(
        brokerSection
          .find(
            ".company, .advisorCompany, .brokerCompany, [class*='company'], [class*='firm']"
          )
          .first()
          .text()
      ) || null;

    // Extract phone and email from the advisor/broker section or full page
    const brokerText = brokerSection.text();
    const pageText = $("body").text();
    const phones = extractPhones(brokerText);
    const emails = extractEmails(brokerText);
    const brokerPhone = phones[0] || extractPhones(pageText)[0] || null;
    const brokerEmail = emails[0] || extractEmails(pageText)[0] || null;

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
      "Year Founded",
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

    const facilities =
      normalizeText(
        this.extractTextByLabel($, [
          "Facilities",
          "Facility",
          "Lease Information",
          "Property Details",
          "Building",
        ])
      ) || null;

    // ── Description ──
    const description =
      normalizeText(
        $(
          ".deal-description, .listing-description, .description, .businessDescription, [class*='description'], #dealDescription, #businessDescription"
        )
          .first()
          .text()
      ) || null;

    // ── Listing date ──
    const dateText = this.extractTextByLabel($, [
      "Listed",
      "Date Listed",
      "Listing Date",
      "Date Posted",
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

    // DealStream pagination: look for "Next" link or right-arrow pagination
    const nextLink = $(
      'a.next, a[rel="next"], .pagination a:contains("Next"), .pager a:contains("Next"), a:contains("Next >"), a:contains("\u00bb"), .next-page a'
    ).first();

    const href = nextLink.attr("href");
    if (!href) return null;

    return href.startsWith("http") ? href : `${BASE_URL}${href}`;
  }

  // ── Private helpers ──

  /**
   * Extract a financial value by searching for a label followed by a value.
   * DealStream uses structured financial tables and various markup patterns.
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

      // Pattern 2: th/td pairs (financial tables)
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

      // Pattern 4: row-based layout (common in DealStream detail pages)
      const rowMatch = $(
        `.detail-row:contains("${label}"), .info-row:contains("${label}"), tr:contains("${label}")`
      ).first();
      if (rowMatch.length) {
        const valueText =
          rowMatch.find(".value, td:last-child, span:last-child").text();
        const value = parsePrice(valueText);
        if (value !== null) return value;
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

      // Row-based layout
      const rowMatch = $(
        `.detail-row:contains("${label}"), .info-row:contains("${label}"), tr:contains("${label}")`
      ).first();
      if (rowMatch.length) {
        const valueText = normalizeText(
          rowMatch.find(".value, td:last-child, span:last-child").text()
        );
        if (valueText) return valueText;
      }
    }

    return "";
  }

  /**
   * Extract a DealStream listing source ID from the URL.
   * URLs follow patterns like: /deal/123456 or /businesses-for-sale/slug-123456
   */
  private extractSourceId(url: string): string | null {
    // Pattern: /deal/123456 or trailing numeric ID
    const dealMatch = url.match(/\/deal\/(\d+)/);
    if (dealMatch) return dealMatch[1];

    // Pattern: slug-123456 or /listing/123456
    const idMatch = url.match(/\/(\d{4,})(?:[/?#]|$)/);
    if (idMatch) return idMatch[1];

    // Trailing ID after a hyphen: /some-deal-name-123456
    const trailingIdMatch = url.match(/-(\d{4,})(?:[/?#]|$)/);
    if (trailingIdMatch) return trailingIdMatch[1];

    // Try query parameter
    try {
      const urlObj = new URL(url);
      return (
        urlObj.searchParams.get("id") ||
        urlObj.searchParams.get("deal_id") ||
        null
      );
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
