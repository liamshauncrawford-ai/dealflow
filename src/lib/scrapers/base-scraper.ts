import { Platform } from "@prisma/client";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/db";
import { getRateLimiter } from "./rate-limiter";
import { loadCookies, invalidateCookies } from "./cookie-manager";
import type { CookieData } from "./cookie-manager";

// ─────────────────────────────────────────────
// Exported interfaces
// ─────────────────────────────────────────────

export interface ScraperFilters {
  state?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minCashFlow?: number;
}

export interface RawListing {
  sourceId: string | null;
  sourceUrl: string;
  platform?: string;
  title: string;
  businessName?: string | null;
  askingPrice: number | null;
  revenue: number | null;
  cashFlow: number | null;
  ebitda: number | null;
  sde: number | null;
  priceToEbitda?: number | null;
  priceToSde?: number | null;
  priceToRevenue?: number | null;
  industry: string | null;
  category: string | null;
  subcategory?: string | null;
  naicsCode?: string | null;
  city: string | null;
  state: string | null;
  county?: string | null;
  zipCode: string | null;
  fullAddress?: string | null;
  description: string | null;
  brokerName: string | null;
  brokerCompany: string | null;
  brokerPhone: string | null;
  brokerEmail: string | null;
  employees: number | null;
  established: number | null;
  sellerFinancing: boolean | null;
  inventory: number | null;
  ffe: number | null;
  realEstate: number | null;
  reasonForSale: string | null;
  facilities: string | null;
  listingDate: Date | null;
  rawData: Record<string, unknown>;
}

export interface ScrapeResult {
  platform: Platform;
  listings: RawListing[];
  errors: string[];
  startedAt: Date;
  completedAt: Date;
}

interface SearchResultPreview {
  url: string;
  preview: Partial<RawListing>;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;
const MAX_PAGES = 50; // Safety limit to avoid infinite pagination

// Common login redirect patterns across platforms
const LOGIN_REDIRECT_PATTERNS = [
  "/login",
  "/signin",
  "/sign-in",
  "/account/login",
  "/auth/",
  "returnurl=",
  "redirect=",
];

// ─────────────────────────────────────────────
// Abstract base class
// ─────────────────────────────────────────────

export abstract class BaseScraper {
  protected platform: Platform;
  protected rateLimiter: ReturnType<typeof getRateLimiter>;

  constructor(platform: Platform) {
    this.platform = platform;
    this.rateLimiter = getRateLimiter(platform);
  }

  // ── Abstract methods that each platform scraper must implement ──

  abstract buildSearchUrl(filters: ScraperFilters): string;

  abstract parseSearchResults(html: string): SearchResultPreview[];

  abstract parseDetailPage(html: string, url: string): Promise<RawListing>;

  abstract getNextPageUrl(html: string): string | null;

  // ── Main scrape orchestration ──

  async scrape(filters: ScraperFilters): Promise<ScrapeResult> {
    const startedAt = new Date();
    const errors: string[] = [];
    const allListings: RawListing[] = [];

    // 1. Create a ScrapeRun record in the database
    const scrapeRun = await prisma.scrapeRun.create({
      data: {
        platform: this.platform,
        triggeredBy: "system",
        status: "RUNNING",
        startedAt,
      },
    });

    try {
      // 2. Load cookies for this platform
      const cookies = await loadCookies(this.platform);

      // 3. Fetch the search results page
      const searchUrl = this.buildSearchUrl(filters);
      let currentUrl: string | null = searchUrl;
      let pageCount = 0;

      while (currentUrl && pageCount < MAX_PAGES) {
        pageCount++;
        this.log(`Fetching search page ${pageCount}: ${currentUrl}`);

        let searchHtml: string;
        try {
          await this.rateLimiter.waitForSlot();
          searchHtml = await this.fetchPage(currentUrl, cookies);
        } catch (err) {
          const message = `Failed to fetch search page ${pageCount} (${currentUrl}): ${errorMessage(err)}`;
          this.log(message, "error");
          errors.push(message);
          break;
        }

        // 4. Parse search results to get listing URLs
        let searchResults: SearchResultPreview[];
        try {
          searchResults = this.parseSearchResults(searchHtml);
        } catch (err) {
          const message = `Failed to parse search results on page ${pageCount}: ${errorMessage(err)}`;
          this.log(message, "error");
          errors.push(message);
          break;
        }

        if (searchResults.length === 0) {
          this.log(`No results found on page ${pageCount}, stopping pagination`);
          break;
        }

        this.log(`Found ${searchResults.length} listings on page ${pageCount}`);

        // 5. For each listing, fetch the detail page
        for (const result of searchResults) {
          try {
            const listing = await this.fetchAndParseDetail(result.url, cookies);
            allListings.push(listing);
          } catch (err) {
            const message = `Failed to scrape detail page ${result.url}: ${errorMessage(err)}`;
            this.log(message, "error");
            errors.push(message);
            // Continue to the next listing
          }
        }

        // 6. Get next page URL for pagination
        currentUrl = this.getNextPageUrl(searchHtml);
      }

      // 7. Update the ScrapeRun record on success
      const completedAt = new Date();
      await prisma.scrapeRun.update({
        where: { id: scrapeRun.id },
        data: {
          status: "COMPLETED",
          listingsFound: allListings.length,
          errors: errors.length,
          errorLog: errors.length > 0 ? errors.join("\n") : null,
          completedAt,
        },
      });

      return {
        platform: this.platform,
        listings: allListings,
        errors,
        startedAt,
        completedAt,
      };
    } catch (err) {
      // 8. Fatal error -- mark run as FAILED
      const completedAt = new Date();
      const fatalMessage = `Fatal scrape error: ${errorMessage(err)}`;
      errors.push(fatalMessage);

      await prisma.scrapeRun.update({
        where: { id: scrapeRun.id },
        data: {
          status: "FAILED",
          listingsFound: allListings.length,
          errors: errors.length,
          errorLog: errors.join("\n"),
          completedAt,
        },
      });

      return {
        platform: this.platform,
        listings: allListings,
        errors,
        startedAt,
        completedAt,
      };
    }
  }

  // ── Fetching helpers ──

  /**
   * Fetch a page, trying Cheerio-compatible HTTP fetch first.
   * Falls back to Playwright if the HTTP fetch returns a non-parseable response
   * (e.g. a JS-rendered page or an anti-bot challenge).
   */
  protected async fetchPage(
    url: string,
    cookies: CookieData[] | null
  ): Promise<string> {
    try {
      const html = await this.fetchWithCookies(url, cookies ?? []);

      // Basic check: if the response is suspiciously short or looks like a
      // JS-only page, fall back to Playwright.
      const $ = cheerio.load(html);
      const bodyText = $("body").text().trim();
      if (bodyText.length < 100 && html.includes("<script")) {
        this.log("HTTP response appears JS-rendered, falling back to Playwright");
        return await this.fetchWithPlaywright(url, cookies ?? []);
      }

      return html;
    } catch {
      this.log("HTTP fetch failed, falling back to Playwright");
      return await this.fetchWithPlaywright(url, cookies ?? []);
    }
  }

  /**
   * Fetch HTML using Node's native fetch API with cookie headers.
   */
  protected async fetchWithCookies(
    url: string,
    cookies: CookieData[]
  ): Promise<string> {
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      redirect: "follow",
    });

    // Check if we were redirected to a login page (cookie expiry)
    const finalUrl = response.url;
    if (this.isLoginRedirect(finalUrl)) {
      this.log(`Detected login redirect for ${this.platform}, invalidating cookies`);
      await invalidateCookies(this.platform);
      throw new Error(`Login redirect detected for ${this.platform}: ${finalUrl}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
    }

    return await response.text();
  }

  /**
   * Fetch HTML using Playwright with a headed browser.
   * Detects login redirects and invalidates cookies if the session has expired.
   */
  protected async fetchWithPlaywright(
    url: string,
    cookies: CookieData[]
  ): Promise<string> {
    // Dynamic import to avoid loading Playwright when not needed
    const { chromium } = await import("playwright");

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      // Set cookies on the browser context
      if (cookies.length > 0) {
        const playwrightCookies = cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          ...(c.expires ? { expires: c.expires } : {}),
        }));
        await context.addCookies(playwrightCookies);
      }

      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

      // Check for login redirects
      const finalUrl = page.url();
      if (this.isLoginRedirect(finalUrl)) {
        this.log(`Playwright detected login redirect for ${this.platform}, invalidating cookies`);
        await invalidateCookies(this.platform);
        throw new Error(`Login redirect detected for ${this.platform}: ${finalUrl}`);
      }

      const html = await page.content();
      await context.close();
      return html;
    } finally {
      await browser.close();
    }
  }

  /**
   * Fetch and parse a detail page with retry logic (3 retries, exponential backoff).
   */
  private async fetchAndParseDetail(
    url: string,
    cookies: CookieData[] | null
  ): Promise<RawListing> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.rateLimiter.waitForSlot();
        const html = await this.fetchPage(url, cookies);
        const listing = await this.parseDetailPage(html, url);
        return listing;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.log(
          `Attempt ${attempt}/${MAX_RETRIES} failed for ${url}: ${lastError.message}`,
          "warn"
        );

        if (attempt < MAX_RETRIES) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError ?? new Error(`Failed to fetch detail page after ${MAX_RETRIES} retries: ${url}`);
  }

  // ── Utility helpers ──

  /**
   * Check whether a URL looks like a login/authentication redirect.
   */
  private isLoginRedirect(url: string): boolean {
    const lower = url.toLowerCase();
    return LOGIN_REDIRECT_PATTERNS.some((pattern) => lower.includes(pattern));
  }

  /**
   * Simple logger with platform prefix.
   */
  protected log(message: string, level: "info" | "warn" | "error" = "info"): void {
    const prefix = `[${this.platform}]`;
    switch (level) {
      case "error":
        console.error(`${prefix} ${message}`);
        break;
      case "warn":
        console.warn(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ── Helpers ──

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
