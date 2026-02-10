/**
 * Browser-based scraper using Playwright connected to the user's REAL Chrome.
 *
 * BizBuySell and similar sites use Akamai bot detection that fingerprints
 * TLS connections (JA3/JA4) and detects automated browsers. The only reliable
 * way to bypass this is to use the user's actual Chrome browser.
 *
 * Architecture:
 * 1. User starts Chrome with --remote-debugging-port=9222
 * 2. Scraper connects via CDP (Chrome DevTools Protocol)
 * 3. Opens new tabs, scrapes, then closes them
 * 4. User's cookies, extensions, and TLS fingerprint are all genuine
 *
 * If CDP connection fails, falls back to Playwright's own Chromium
 * (works for sites without strong bot detection like BusinessBroker.net).
 */

import { Platform } from "@prisma/client";
import type { Browser, BrowserContext, Page } from "playwright";
import { prisma } from "@/lib/db";
import { loadCookies } from "./cookie-manager";
import type { RawListing, ScrapeResult, ScraperFilters } from "./base-scraper";
import { BizBuySellScraper } from "./bizbuysell";
import { processScrapedListings } from "./post-processor";

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const MAX_PAGES = 5;
const PAGE_TIMEOUT = 45_000;
const DELAY_BETWEEN_PAGES_MS = 3000;
const DELAY_BETWEEN_DETAILS_MS = 2000;
const MAX_DETAILS_PER_RUN = 25;
const CDP_PORT = 9222;

// ─────────────────────────────────────────────
// Stealth init script (for fallback Playwright browser)
// ─────────────────────────────────────────────

const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  if (!window.chrome) {
    window.chrome = {
      runtime: { onMessage: { addListener: function(){}, removeListener: function(){} }, sendMessage: function(){} },
      loadTimes: function(){ return {} }, csi: function(){ return {} },
      app: { isInstalled: false, getDetails: function(){}, getIsInstalled: function(){}, installState: function(){} }
    };
  }
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const p = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 }
      ];
      p.refresh = function(){};
      return p;
    }
  });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
`;

// ─────────────────────────────────────────────
// Browser connection helpers
// ─────────────────────────────────────────────

interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  isConnected: boolean; // true = CDP connection to real Chrome
}

async function connectToChrome(): Promise<BrowserSession | null> {
  try {
    const { chromium } = await import("playwright");

    // Try to connect to user's Chrome via CDP
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`, {
      timeout: 5000,
    });

    // Use the default browser context (has the user's cookies, sessions, etc.)
    const contexts = browser.contexts();
    const context = contexts[0] || await browser.newContext();

    console.log("[BROWSER] Connected to Chrome via CDP — using real browser");
    return { browser, context, isConnected: true };
  } catch {
    console.log("[BROWSER] CDP connection failed — Chrome not running with --remote-debugging-port");
    return null;
  }
}

async function launchPlaywright(): Promise<BrowserSession> {
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--lang=en-US,en",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "America/Denver",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  await context.addInitScript(STEALTH_SCRIPT);

  console.log("[BROWSER] Using Playwright Chromium (fallback — may not bypass Akamai)");
  return { browser, context, isConnected: false };
}

// ─────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────

export async function browserScrape(
  platform: Platform,
  runId: string,
  filters: ScraperFilters = { state: "CO" }
): Promise<void> {
  const startedAt = new Date();

  try {
    await prisma.scrapeRun.update({
      where: { id: runId },
      data: { status: "RUNNING", startedAt },
    });

    console.log(`[${platform}] Starting browser scrape...`);

    // Try CDP first (real Chrome), fall back to Playwright
    let session = await connectToChrome();
    const usedCDP = !!session;

    if (!session) {
      session = await launchPlaywright();

      // Load cookies from DB for fallback Playwright browser
      const cookies = await loadCookies(platform);
      if (cookies && cookies.length > 0) {
        const playwrightCookies = cookies
          .filter((c) => c.name && c.value && c.domain)
          .map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || "/",
            ...(c.expires && c.expires > 0 ? { expires: c.expires } : {}),
          }));

        if (playwrightCookies.length > 0) {
          try {
            await session.context.addCookies(playwrightCookies);
            console.log(`[${platform}] Loaded ${playwrightCookies.length} cookies`);
          } catch (cookieErr) {
            console.warn(
              `[${platform}] Cookie load failed:`,
              cookieErr instanceof Error ? cookieErr.message : cookieErr
            );
          }
        }
      }
    }

    try {
      const result = await scrapePlatform(platform, session.context, filters);

      // Post-process results
      const processResult = await processScrapedListings(result);

      await prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          listingsFound: result.listings.length,
          listingsNew: processResult.newCount,
          listingsUpdated: processResult.updatedCount,
          errors: result.errors.length + processResult.errors.length,
          errorLog:
            [...result.errors, ...processResult.errors].join("\n") || null,
        },
      });

      console.log(
        `[${platform}] Scrape complete: ${result.listings.length} found, ` +
          `${processResult.newCount} new, ${processResult.updatedCount} updated` +
          (usedCDP ? " (via Chrome CDP)" : " (via Playwright)")
      );
    } finally {
      // Only close the browser if we launched it ourselves
      if (!usedCDP) {
        await session.browser.close();
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[${platform}] Browser scrape failed:`, errorMessage);

    await prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorLog: errorMessage,
      },
    });
  }
}

// ─────────────────────────────────────────────
// Platform routing
// ─────────────────────────────────────────────

async function scrapePlatform(
  platform: Platform,
  context: BrowserContext,
  filters: ScraperFilters
): Promise<ScrapeResult> {
  switch (platform) {
    case "BIZBUYSELL":
      return scrapeBizBuySell(context, filters);
    case "BIZQUEST":
      return scrapeBizQuest(context, filters);
    case "BUSINESSBROKER":
      return scrapeBusinessBroker(context, filters);
    default:
      return {
        platform,
        listings: [],
        errors: [`No browser scraper implemented for ${platform}`],
        startedAt: new Date(),
        completedAt: new Date(),
      };
  }
}

// ─────────────────────────────────────────────
// Human-like behavior helpers
// ─────────────────────────────────────────────

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

async function humanDelay(page: Page, minMs = 1500, maxMs = 4000): Promise<void> {
  await page.waitForTimeout(randomDelay(minMs, maxMs));
}

async function humanScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const distance = Math.floor(Math.random() * 500) + 300;
    window.scrollBy({ top: distance, behavior: "smooth" });
    await new Promise((r) => setTimeout(r, 600));
  });
}

async function humanMouseMove(page: Page): Promise<void> {
  const x = randomDelay(200, 1200);
  const y = randomDelay(200, 700);
  await page.mouse.move(x, y);
}

// ─────────────────────────────────────────────
// BizBuySell browser scraper
// ─────────────────────────────────────────────

async function scrapeBizBuySell(
  context: BrowserContext,
  filters: ScraperFilters
): Promise<ScrapeResult> {
  const startedAt = new Date();
  const listings: RawListing[] = [];
  const errors: string[] = [];
  const parser = new BizBuySellScraper();

  const stateInput = (filters.state ?? "colorado").toLowerCase();
  const state = stateInput === "co" ? "colorado" : stateInput.replace(/\s+/g, "-");
  // Correct URL pattern: /colorado-businesses-for-sale/
  let currentUrl: string | null = `https://www.bizbuysell.com/${state}-businesses-for-sale/`;

  const page = await context.newPage();

  try {
    let pageNum = 0;

    while (currentUrl && pageNum < MAX_PAGES) {
      pageNum++;
      console.log(`[BIZBUYSELL] Fetching search page ${pageNum}: ${currentUrl}`);

      try {
        const response = await page.goto(currentUrl, {
          waitUntil: "load",
          timeout: PAGE_TIMEOUT,
        });

        // Wait for content to settle (handle JS redirects)
        await page.waitForTimeout(3000);

        // Human-like behavior (wrapped in try-catch in case of navigation)
        try {
          await humanMouseMove(page);
          await humanScroll(page);
          await humanDelay(page, 1000, 2000);
        } catch {
          // Navigation may have occurred, wait and retry
          await page.waitForTimeout(2000);
        }

        // Check for blocks
        const httpStatus = response?.status() ?? 0;
        const title = await page.title();
        let bodyText = "";
        try {
          bodyText = await page.evaluate(
            () => document.body?.innerText?.substring(0, 1000) || ""
          );
        } catch {
          // Page may still be loading/navigating
          await page.waitForTimeout(2000);
          bodyText = await page.evaluate(
            () => document.body?.innerText?.substring(0, 1000) || ""
          );
        }

        if (
          httpStatus === 403 ||
          httpStatus === 429 ||
          title.toLowerCase().includes("access denied") ||
          bodyText.toLowerCase().includes("access denied")
        ) {
          errors.push(
            `Blocked on page ${pageNum} (HTTP ${httpStatus}). ` +
              `BizBuySell requires Chrome with --remote-debugging-port=9222 for scraping. ` +
              `Title: "${title}"`
          );
          break;
        }

        if (httpStatus === 404) {
          errors.push(`Page not found (404): ${currentUrl}`);
          break;
        }

        // Scroll down multiple times to trigger lazy loading (BizBuySell loads ~56 listings)
        let previousHeight = 0;
        for (let scrollAttempt = 0; scrollAttempt < 15; scrollAttempt++) {
          const currentHeight = await page.evaluate(() => document.body.scrollHeight);
          if (scrollAttempt > 3 && currentHeight === previousHeight) break;
          previousHeight = currentHeight;
          await page.evaluate(() => window.scrollBy({ top: 800, behavior: "smooth" }));
          await page.waitForTimeout(1200 + Math.random() * 800);
        }
        // Scroll back to top
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await page.waitForTimeout(1000);

        // ── Extract listings directly from the search page DOM ──
        // BizBuySell detail pages block automated browsers, so we extract
        // all data from the search page cards (title, price, cashflow,
        // location, description, detail URL).
        const browserListings = await extractListingsFromBrowser(page);
        if (browserListings.length > 0) {
          console.log(`[BIZBUYSELL] Extracted ${browserListings.length} listings from search page`);
          listings.push(...browserListings.slice(0, MAX_DETAILS_PER_RUN - listings.length));
        } else {
          // Cheerio fallback for non-Angular versions
          const html = await page.content();
          const searchResults = parser.parseSearchResults(html);
          console.log(`[BIZBUYSELL] Cheerio found ${searchResults.length} listings on page ${pageNum}`);
          if (searchResults.length > 0) {
            // Use search preview data directly (don't visit detail pages)
            for (const result of searchResults) {
              if (listings.length >= MAX_DETAILS_PER_RUN) break;
              listings.push({
                sourceId: null,
                sourceUrl: result.url,
                title: result.preview.title || "Untitled",
                businessName: null,
                askingPrice: result.preview.askingPrice ?? null,
                revenue: null,
                cashFlow: result.preview.cashFlow ?? null,
                ebitda: null,
                sde: null,
                industry: null,
                category: null,
                city: result.preview.city ?? null,
                state: result.preview.state ?? "CO",
                zipCode: result.preview.zipCode ?? null,
                description: result.preview.description ?? null,
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
                rawData: {},
              });
            }
          } else {
            console.log(`[BIZBUYSELL] No listings found on page ${pageNum} (title: "${title}")`);
            break;
          }
        }

        // BizBuySell uses infinite scroll, no traditional pagination
        currentUrl = null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Search page ${pageNum} failed: ${msg}`);
        break;
      }

      await humanDelay(page, DELAY_BETWEEN_PAGES_MS, DELAY_BETWEEN_PAGES_MS + 2000);
    }
  } finally {
    await page.close();
  }

  return { platform: "BIZBUYSELL", listings, errors, startedAt, completedAt: new Date() };
}

// ─────────────────────────────────────────────
// BizQuest browser scraper
// ─────────────────────────────────────────────

async function scrapeBizQuest(
  context: BrowserContext,
  filters: ScraperFilters
): Promise<ScrapeResult> {
  const startedAt = new Date();
  const listings: RawListing[] = [];
  const errors: string[] = [];
  const page = await context.newPage();

  try {
    const searchUrl = `https://www.bizquest.com/businesses-for-sale/colorado/`;
    console.log(`[BIZQUEST] Fetching: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await humanDelay(page, 2500, 4000);
    await humanMouseMove(page);
    await humanScroll(page);

    const title = await page.title();
    if (title.toLowerCase().includes("access denied")) {
      errors.push("Access denied — bot detection triggered");
      return { platform: "BIZQUEST", listings, errors, startedAt, completedAt: new Date() };
    }

    const browserListings = await extractListingsFromBrowser(page);
    listings.push(...browserListings.slice(0, MAX_DETAILS_PER_RUN));
    console.log(`[BIZQUEST] Extracted ${listings.length} listings`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`BizQuest scrape failed: ${msg}`);
  } finally {
    await page.close();
  }

  return { platform: "BIZQUEST", listings, errors, startedAt, completedAt: new Date() };
}

// ─────────────────────────────────────────────
// BusinessBroker.net browser scraper
// ─────────────────────────────────────────────

async function scrapeBusinessBroker(
  context: BrowserContext,
  filters: ScraperFilters
): Promise<ScrapeResult> {
  const startedAt = new Date();
  const listings: RawListing[] = [];
  const errors: string[] = [];
  const page = await context.newPage();

  try {
    const searchUrl = `https://www.businessbroker.net/businesses-for-sale/colorado`;
    console.log(`[BUSINESSBROKER] Fetching: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await humanDelay(page, 2500, 4000);
    await humanMouseMove(page);
    await humanScroll(page);

    const browserListings = await extractListingsFromBrowser(page);
    listings.push(...browserListings.slice(0, MAX_DETAILS_PER_RUN));
    console.log(`[BUSINESSBROKER] Extracted ${listings.length} listings`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`BusinessBroker scrape failed: ${msg}`);
  } finally {
    await page.close();
  }

  return { platform: "BUSINESSBROKER", listings, errors, startedAt, completedAt: new Date() };
}

// ─────────────────────────────────────────────
// Generic browser-based listing extractor
// ─────────────────────────────────────────────

async function extractListingsFromBrowser(page: Page): Promise<RawListing[]> {
  const rawData = await page.evaluate(() => {
    const results: Array<Record<string, string | null>> = [];

    // ── Strategy 1: BizBuySell Angular app ──
    // Structure: <a class="diamond" href="..."> wraps <div class="listing">
    const diamondLinks = document.querySelectorAll("a.diamond[href]");
    if (diamondLinks.length > 0) {
      diamondLinks.forEach((link) => {
        try {
          const anchor = link as HTMLAnchorElement;
          if (!anchor.href || !anchor.href.includes("/business-opportunity/")) return;

          const card = anchor.querySelector(".listing");
          if (!card) return;

          const title =
            card.querySelector(".title, .title.h3, span.title")?.textContent?.trim() ||
            anchor.getAttribute("title") ||
            null;

          if (!title || title.length < 5) return;

          const priceText =
            card.querySelector(".asking-price")?.textContent?.trim() || null;

          const locationText =
            card.querySelector(".location")?.textContent?.trim() || null;

          const description =
            card.querySelector(".description")?.textContent?.trim() || null;

          const cashFlowEl = card.querySelector(".cash-flow, .cash-flow-on-mobile, [class*='cash-flow']");
          const cashFlowText = cashFlowEl?.textContent?.trim() || null;
          const cashFlowMatch = cashFlowText?.match(/\$?([\d,]+)/);

          const allText = card.textContent || "";
          const revenueMatch = allText.match(/revenue[:\s]*\$?([\d,]+)/i);

          results.push({
            url: anchor.href,
            title,
            price: priceText,
            location: locationText,
            cashFlow: cashFlowMatch?.[1] || null,
            revenue: revenueMatch?.[1] || null,
            description,
            broker: null,
          });
        } catch {
          // Skip
        }
      });
      if (results.length > 0) return results;
    }

    // ── Strategy 2: Generic card-based extraction ──
    const cardSelectors = [
      ".listing", ".businessCard", ".search-result",
      "[class*='listing-card']", "[class*='ListingCard']",
      ".bfsListing", ".result-card", "article", ".card",
    ];

    let cards: Element[] = [];
    for (const sel of cardSelectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 2) {
        cards = Array.from(found);
        break;
      }
    }

    // ── Strategy 3: Find links to detail pages and group by parent ──
    if (cards.length === 0) {
      const detailLinks = document.querySelectorAll(
        'a[href*="/business-opportunity/"], a[href*="/businesses-for-sale/"], a[href*="/listing/"], a[href*="/business/"]'
      );
      const parents = new Set<Element>();
      detailLinks.forEach((link) => {
        const parent = link.closest("div, li, article, section");
        if (parent) parents.add(parent);
      });
      cards = Array.from(parents);
    }

    for (const card of cards) {
      try {
        const link = card.querySelector(
          'a[href*="/business-opportunity/"], a[href*="/businesses-for-sale/"], a[href*="/listing/"], a[href*="/business/"], h2 a, h3 a'
        ) as HTMLAnchorElement | null;

        if (!link?.href) continue;
        if (link.href.includes("/category/") || link.href.includes("/state/")) continue;

        const title =
          card.querySelector(".title, h2, h3, h4, [class*='title'], [class*='Title']")
            ?.textContent?.trim() ||
          link.getAttribute("title") ||
          link.textContent?.trim() ||
          null;

        if (!title || title.length < 5) continue;

        const priceEl = card.querySelector(
          ".asking-price, [class*='price'], [class*='Price'], dt + dd, .amount"
        );
        const priceText = priceEl?.textContent?.trim() || null;

        const locationEl = card.querySelector(
          ".location, [class*='location'], [class*='Location'], .city, .area"
        );
        const locationText = locationEl?.textContent?.trim() || null;

        const allText = card.textContent || "";
        const cashFlowMatch = allText.match(/cash\s*flow[:\s]*\$?([\d,]+)/i);
        const revenueMatch = allText.match(/revenue[:\s]*\$?([\d,]+)/i);

        const descEl = card.querySelector(
          ".description, p, [class*='description'], [class*='Description'], [class*='snippet']"
        );
        const description = descEl?.textContent?.trim() || null;

        const brokerEl = card.querySelector(
          "[class*='broker'], [class*='Broker'], [class*='agent'], [class*='Agent']"
        );
        const brokerText = brokerEl?.textContent?.trim() || null;

        results.push({
          url: link.href, title, price: priceText, location: locationText,
          cashFlow: cashFlowMatch?.[1] || null, revenue: revenueMatch?.[1] || null,
          description, broker: brokerText,
        });
      } catch {
        // Skip malformed cards
      }
    }

    return results;
  });

  const { parsePrice, parseLocation, normalizeText } = await import("./parser-utils");

  return rawData
    .filter((item) => item.title && item.url)
    .map((item) => {
      const location = parseLocation(item.location || "");
      return {
        sourceId: null,
        sourceUrl: item.url!,
        title: normalizeText(item.title || "Untitled"),
        businessName: null,
        askingPrice: parsePrice(item.price || ""),
        revenue: item.revenue ? parsePrice(item.revenue) : null,
        cashFlow: item.cashFlow ? parsePrice(item.cashFlow) : null,
        ebitda: null,
        sde: null,
        industry: null,
        category: null,
        city: location.city,
        state: location.state || "CO",
        zipCode: location.zipCode,
        description: item.description
          ? normalizeText(item.description).substring(0, 500)
          : null,
        brokerName: item.broker ? normalizeText(item.broker) : null,
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
        rawData: item as unknown as Record<string, unknown>,
      };
    });
}
