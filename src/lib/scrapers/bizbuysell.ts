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

const BASE_URL = "https://www.bizbuysell.com";

export class BizBuySellScraper extends BaseScraper {
  constructor() {
    super("BIZBUYSELL");
  }

  // ── Search URL builder ──

  buildSearchUrl(filters: ScraperFilters): string {
    // BizBuySell URL patterns:
    //   Category: /colorado-{category}-businesses-for-sale/
    //   Generic:  /colorado-businesses-for-sale/?q_kw={keyword}
    const stateInput = (filters.state ?? "colorado").toLowerCase();
    const state = stateInput === "co" ? "colorado" : stateInput.replace(/\s+/g, "-");

    // If a category slug is provided, use it in the URL path
    const slug = filters.categorySlug
      ? `${state}-${filters.categorySlug}-businesses-for-sale`
      : `${state}-businesses-for-sale`;

    let url = `${BASE_URL}/${slug}/`;

    const params = new URLSearchParams();

    // Keyword search — thesis-targeted
    if (filters.keyword) {
      params.set("q_kw", filters.keyword);
    }
    if (filters.minPrice !== undefined) {
      params.set("q_price_min", String(filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      params.set("q_price_max", String(filters.maxPrice));
    }
    if (filters.minCashFlow !== undefined) {
      params.set("q_cf_min", String(filters.minCashFlow));
    }
    if (filters.city) {
      params.set("q_city", filters.city);
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

    // ── Strategy 1: BizBuySell Angular app ──
    // Structure: <a class="diamond" href="..."> wraps <div class="listing">
    $("a.diamond[href]").each((_index, element) => {
      try {
        const link = $(element);
        const href = link.attr("href");
        if (!href || !href.includes("/business-opportunity/")) return;

        const detailUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
        const card = link.find(".listing").first();

        const title = normalizeText(
          card.find(".title, span.title").first().text() || link.attr("title") || ""
        );
        if (!title) return;

        const priceText = card.find(".asking-price").first().text();
        const askingPrice = parsePrice(priceText);

        const cashFlowText = card.find(".cash-flow, .cash-flow-on-mobile, [class*='cash-flow']").first().text();
        const cashFlow = parsePrice(cashFlowText);

        const locationText = card.find(".location").first().text();
        const location = parseLocation(locationText);

        const description = normalizeText(
          card.find(".description").first().text()
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

    // ── Strategy 2: Fallback generic selectors ──
    if (results.length === 0) {
      const listingCards = $(
        ".listing, .businessCard, .search-result, [class*='listing-card'], .bfsListing"
      );

      listingCards.each((_index, element) => {
        try {
          const card = $(element);

          // Check if parent <a> has the link (Angular structure)
          const parentLink = card.parent("a[href]");
          let href = parentLink.attr("href");

          // Also check for links inside the card
          if (!href) {
            const linkEl = card.find(
              "a.listingTitle, a.listing-title, h3 a, h2 a, a[href*='/business-opportunity/'], a[href*='/businesses-for-sale/']"
            ).first();
            href = linkEl.attr("href");
          }

          if (!href) return;

          const detailUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

          const title = normalizeText(
            card.find(".title, h3, h2").first().text() ||
            parentLink.attr("title") ||
            ""
          );
          if (!title) return;

          const priceText =
            card.find(".price, .asking-price, [class*='price'], .listingPrice").first().text() ||
            card.find("span:contains('Asking Price')").next().text();
          const askingPrice = parsePrice(priceText);

          const cashFlowText =
            card.find("[class*='cashFlow'], [class*='cash-flow']").first().text() ||
            card.find("span:contains('Cash Flow')").next().text();
          const cashFlow = parsePrice(cashFlowText);

          const locationText =
            card.find(".location, .listingLocation, [class*='location']").first().text() ||
            card.find("span:contains('Location')").next().text();
          const location = parseLocation(locationText);

          const description = normalizeText(
            card.find(".description, .listingDescription, [class*='description'], p").first().text()
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
    }

    return results;
  }

  // ── Detail page parser ──

  async parseDetailPage(html: string, url: string): Promise<RawListing> {
    const $ = cheerio.load(html);

    // ── Title ──
    const title = normalizeText(
      $("h1, .listing-title, .businessTitle, [class*='listingTitle']").first().text()
    );

    // ── Financial fields ──
    const askingPrice = this.extractFinancialField($, [
      "Asking Price",
      "Price",
    ]);
    const revenue = this.extractFinancialField($, [
      "Gross Revenue",
      "Revenue",
      "Annual Revenue",
    ]);
    const cashFlow = this.extractFinancialField($, [
      "Cash Flow",
      "Discretionary Cash Flow",
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
    ]);

    // ── Location ──
    const locationText =
      $(".location, .listingLocation, [class*='location'], .businessLocation")
        .first()
        .text() ||
      this.extractTextByLabel($, ["Location", "City", "State"]);
    const location = parseLocation(locationText);

    // ── Industry / Category ──
    const industry = normalizeText(
      this.extractTextByLabel($, ["Industry", "Business Type", "Type"])
    ) || null;
    const category = normalizeText(
      this.extractTextByLabel($, ["Category", "Sub-Category", "Subcategory"])
    ) || null;

    // ── Broker info ──
    const brokerSection = $(".broker, .brokerInfo, [class*='broker'], .contactInfo, .listingBroker");
    const brokerName = normalizeText(
      brokerSection.find(".brokerName, .name, h3, h4, [class*='name']").first().text()
    ) || null;
    const brokerCompany = normalizeText(
      brokerSection.find(".company, .brokerCompany, [class*='company']").first().text()
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
    ]);
    const employees = employeesText ? parseInt(employeesText.replace(/\D/g, ""), 10) || null : null;

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
    ]);
    const sellerFinancing = sellerFinancingText
      ? /yes|available|offered|true/i.test(sellerFinancingText)
      : null;

    const reasonForSale = normalizeText(
      this.extractTextByLabel($, ["Reason for Selling", "Reason for Sale"])
    ) || null;

    const facilities = normalizeText(
      this.extractTextByLabel($, [
        "Facilities",
        "Facility",
        "Real Estate",
        "Lease Information",
      ])
    ) || null;

    // ── Description ──
    const description = normalizeText(
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

    // BizBuySell pagination: look for "Next" link or right-arrow pagination
    const nextLink = $(
      'a.next, a[rel="next"], .pagination a:contains("Next"), .pager a:contains("Next"), a:contains("Next >")'
    ).first();

    const href = nextLink.attr("href");
    if (!href) return null;

    return href.startsWith("http") ? href : `${BASE_URL}${href}`;
  }

  // ── Private helpers ──

  /**
   * Extract a financial value by searching for a label followed by a value.
   * BizBuySell uses various markup patterns: dl/dt/dd, tables, divs with labels, etc.
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
        const tdText = thMatch.next("td").text() || thMatch.parent().find("td").text();
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
   * Extract a BizBuySell listing source ID from the URL.
   * URLs follow the pattern: /businesses-for-sale/detail/XYZ/123456
   */
  private extractSourceId(url: string): string | null {
    // Pattern: /detail/.../123456 or listing ID at end of URL
    const idMatch = url.match(/\/(\d{5,})(?:[/?#]|$)/);
    if (idMatch) return idMatch[1];

    // Try query parameter
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("id") || null;
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
