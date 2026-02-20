/**
 * DORA (Dept of Regulatory Agencies) license scraper.
 *
 * Searches Colorado's contractor license database for relevant license types:
 * - Electrical Contractor (Master / Journeyman)
 * - Low Voltage Installer
 * - Fire Alarm Installer
 * - Security Systems Contractor
 *
 * This is primarily an enrichment tool — it adds license data to existing
 * Listing records rather than creating new ones. However, businesses found
 * in DORA that don't exist in the DB can be flagged for investigation.
 *
 * Enrichment signals:
 * - License approaching expiration = possible exit signal
 * - Multiple license types = diversified capabilities
 * - Cross-reference with CSOS entity records
 */

import * as cheerio from "cheerio";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DoraLicense {
  licenseName: string;
  licenseNumber: string;
  licenseType: string;
  status: string; // "Active", "Expired", "Revoked", etc.
  issueDate: string | null;
  expirationDate: string | null;
  businessName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

export interface DoraScanResult {
  licenses: DoraLicense[];
  errors: string[];
  queriesRun: number;
}

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const LICENSE_TYPES = [
  "Electrical Contractor",
  "Low Voltage Installer",
  "Fire Alarm Installer",
  "Security Systems Contractor",
];

const DORA_SEARCH_URL = "https://apps.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx";

const REQUEST_DELAY_MS = 2500; // Polite delay between requests

// ─────────────────────────────────────────────
// Scraper
// ─────────────────────────────────────────────

/**
 * Search DORA for all configured license types.
 * Returns deduplicated licenses across all searches.
 */
export async function searchDora(): Promise<DoraScanResult> {
  const allLicenses = new Map<string, DoraLicense>();
  const errors: string[] = [];
  let queriesRun = 0;

  for (const licenseType of LICENSE_TYPES) {
    try {
      const licenses = await searchDoraLicenseType(licenseType);
      queriesRun++;

      for (const license of licenses) {
        const key = license.licenseNumber || `${license.licenseName}-${license.licenseType}`;
        if (!allLicenses.has(key)) {
          allLicenses.set(key, license);
        }
      }

      // Polite delay
      if (queriesRun < LICENSE_TYPES.length) {
        await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${licenseType}] ${msg}`);
    }
  }

  return {
    licenses: Array.from(allLicenses.values()),
    errors,
    queriesRun,
  };
}

/**
 * Search DORA for a single license type.
 * DORA's lookup page is ASP.NET WebForms — requires fetching the page first
 * to get ViewState, then POST with search parameters.
 */
async function searchDoraLicenseType(licenseType: string): Promise<DoraLicense[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    // Step 1: GET the search page to extract ASP.NET ViewState
    const pageRes = await fetch(DORA_SEARCH_URL, {
      headers: {
        "User-Agent": "DealFlow Research Tool (contact: liamshauncrawford@gmail.com)",
      },
      signal: controller.signal,
    });

    if (!pageRes.ok) {
      throw new Error(`DORA page returned ${pageRes.status}`);
    }

    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    // Extract ASP.NET hidden fields
    const viewState = $("input[name='__VIEWSTATE']").val() as string | undefined;
    const eventValidation = $("input[name='__EVENTVALIDATION']").val() as string | undefined;
    const viewStateGenerator = $("input[name='__VIEWSTATEGENERATOR']").val() as string | undefined;

    if (!viewState) {
      throw new Error("Could not extract DORA ViewState — page structure may have changed");
    }

    // Step 2: POST the search form
    const formData = new URLSearchParams();
    formData.set("__VIEWSTATE", viewState);
    if (eventValidation) formData.set("__EVENTVALIDATION", eventValidation);
    if (viewStateGenerator) formData.set("__VIEWSTATEGENERATOR", viewStateGenerator);
    formData.set("ctl00$ContentPlaceHolder1$txtLicenseType", licenseType);
    formData.set("ctl00$ContentPlaceHolder1$txtState", "CO");
    formData.set("ctl00$ContentPlaceHolder1$btnSearch", "Search");

    const searchRes = await fetch(DORA_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "DealFlow Research Tool (contact: liamshauncrawford@gmail.com)",
      },
      body: formData.toString(),
      signal: controller.signal,
    });

    if (!searchRes.ok) {
      throw new Error(`DORA search returned ${searchRes.status}`);
    }

    const resultsHtml = await searchRes.text();
    return parseDoraResults(resultsHtml, licenseType);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse DORA license search results HTML.
 */
function parseDoraResults(html: string, licenseType: string): DoraLicense[] {
  const $ = cheerio.load(html);
  const licenses: DoraLicense[] = [];

  // DORA results are typically in a GridView table
  $("table.GridView tr, table[id*='GridView'] tr, table.results tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return; // Skip header rows

    const licenseName = $(cells[0]).text().trim();
    if (!licenseName) return;

    const licenseNumber = cells.length > 1 ? $(cells[1]).text().trim() : "";
    const status = cells.length > 2 ? $(cells[2]).text().trim() : "Unknown";
    const issueDate = cells.length > 3 ? $(cells[3]).text().trim() : null;
    const expirationDate = cells.length > 4 ? $(cells[4]).text().trim() : null;
    const businessName = cells.length > 5 ? $(cells[5]).text().trim() : null;
    const address = cells.length > 6 ? $(cells[6]).text().trim() : null;

    // Try to extract city/state from address
    let city: string | null = null;
    let state: string | null = "CO";
    if (address) {
      const cityMatch = address.match(/,\s*([^,]+),\s*CO/i);
      if (cityMatch) city = cityMatch[1].trim();
    }

    licenses.push({
      licenseName,
      licenseNumber,
      licenseType,
      status: status || "Unknown",
      issueDate: issueDate || null,
      expirationDate: expirationDate || null,
      businessName: businessName || null,
      address: address || null,
      city,
      state,
    });
  });

  return licenses;
}

/**
 * Check if a license is expiring soon (within 6 months).
 * This is an acquisition signal — owner may not be renewing.
 */
export function isLicenseExpiringSoon(license: DoraLicense): boolean {
  if (!license.expirationDate) return false;

  const expDate = new Date(license.expirationDate);
  if (isNaN(expDate.getTime())) return false;

  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

  return expDate <= sixMonthsFromNow && expDate >= new Date();
}

/**
 * Normalize a business name for fuzzy matching.
 * Strips common suffixes (LLC, Inc, Corp, Co, etc.) and normalizes whitespace.
 */
export function normalizeBusinessName(name: string): string {
  return name
    .replace(/,?\s*(LLC|L\.L\.C\.|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Company|Ltd\.?|Limited|LP|L\.P\.)$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
