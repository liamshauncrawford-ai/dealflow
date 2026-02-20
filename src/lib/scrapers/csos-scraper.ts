/**
 * Colorado Secretary of State (CSOS) business entity scraper.
 *
 * Searches sos.state.co.us for businesses matching acquisition-relevant
 * trade keywords (structured cabling, low voltage, security, etc.).
 *
 * Unlike BizBuySell, these aren't listed for sale — they're registered
 * Colorado businesses that could be potential acquisition targets.
 *
 * Enrichment signals:
 * - Formation date >15 years = established business
 * - Status "Delinquent" = possible owner disengagement / distress
 * - Same registered agent across entities = serial entrepreneur
 */

import * as cheerio from "cheerio";
import { parseLocation } from "./parser-utils";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CsosEntity {
  entityName: string;
  entityId: string;
  formationDate: string | null;
  status: string; // "Good Standing", "Delinquent", "Dissolved", etc.
  principalAddress: string | null;
  registeredAgent: string | null;
  entityType: string | null; // "Limited Liability Company", "Corporation", etc.
  city: string | null;
  state: string | null;
  searchTerm: string; // Which keyword found this entity
}

export interface CsosScanResult {
  entities: CsosEntity[];
  errors: string[];
  queriesRun: number;
}

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const SEARCH_TERMS = [
  "structured cabling",
  "low voltage",
  "data cabling",
  "communications contractor",
  "security systems",
  "building automation",
  "fiber optic",
  "network cabling",
];

const BASE_URL = "https://www.sos.state.co.us/biz/BusinessEntityResults.do";

const REQUEST_DELAY_MS = 2000; // Polite delay between requests

// ─────────────────────────────────────────────
// Scraper
// ─────────────────────────────────────────────

/**
 * Search CSOS for all configured trade keywords.
 * Returns deduplicated entities across all searches.
 */
export async function searchCsos(): Promise<CsosScanResult> {
  const allEntities = new Map<string, CsosEntity>();
  const errors: string[] = [];
  let queriesRun = 0;

  for (const term of SEARCH_TERMS) {
    try {
      const entities = await searchCsosTerm(term);
      queriesRun++;

      for (const entity of entities) {
        // Deduplicate by entity ID
        if (!allEntities.has(entity.entityId)) {
          allEntities.set(entity.entityId, entity);
        }
      }

      // Polite delay between requests
      if (queriesRun < SEARCH_TERMS.length) {
        await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${term}] ${msg}`);
    }
  }

  return {
    entities: Array.from(allEntities.values()),
    errors,
    queriesRun,
  };
}

/**
 * Search CSOS for a single term. Returns parsed entity results.
 */
async function searchCsosTerm(term: string): Promise<CsosEntity[]> {
  // The CSOS search uses form POST with specific parameters
  const formData = new URLSearchParams({
    "searchChoice": "name",
    "nameSearchString": term,
    "nameSearchType": "CONTAINS",
    "entityStatus": "Active", // Active includes Good Standing
    "entityTypeCode": "", // All entity types
    "principalOfficeState": "CO",
    "principalOfficeCountry": "US",
    "searchAction": "search",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "DealFlow Research Tool (contact: liamshauncrawford@gmail.com)",
      },
      body: formData.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`CSOS returned ${response.status}`);
    }

    const html = await response.text();
    return parseSearchResults(html, term);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse CSOS HTML search results into structured entities.
 * The results page has a table with columns for entity info.
 */
function parseSearchResults(html: string, searchTerm: string): CsosEntity[] {
  const $ = cheerio.load(html);
  const entities: CsosEntity[] = [];

  // CSOS results are typically in a table with class 'searchResults' or similar
  // The exact selector depends on the page structure — trying common patterns
  $("table.results tr, table#searchResults tr, table.dataTable tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return; // Skip header rows

    const entityName = $(cells[0]).text().trim();
    if (!entityName) return;

    // Extract entity ID from link href if present
    const link = $(cells[0]).find("a").attr("href") ?? "";
    const entityIdMatch = link.match(/entityId=(\d+)/);
    const entityId = entityIdMatch ? entityIdMatch[1] : `csos-${entityName.replace(/\s+/g, "-").toLowerCase()}`;

    const entityType = cells.length > 1 ? $(cells[1]).text().trim() : null;
    const status = cells.length > 2 ? $(cells[2]).text().trim() : "Unknown";
    const formationDate = cells.length > 3 ? $(cells[3]).text().trim() : null;
    const principalAddress = cells.length > 4 ? $(cells[4]).text().trim() : null;
    const registeredAgent = cells.length > 5 ? $(cells[5]).text().trim() : null;

    // Parse location from address
    const location = principalAddress ? parseLocation(principalAddress) : { city: null, state: "CO" };

    entities.push({
      entityName,
      entityId,
      formationDate: formationDate || null,
      status: status || "Unknown",
      principalAddress: principalAddress || null,
      registeredAgent: registeredAgent || null,
      entityType: entityType || null,
      city: location.city,
      state: location.state ?? "CO",
      searchTerm,
    });
  });

  // Fallback: if table parsing finds nothing, try generic row parsing
  if (entities.length === 0) {
    // Some government sites use different HTML structures
    $("div.entity-result, div.search-result, li.result-item").each((_i, el) => {
      const name = $(el).find(".entity-name, .name, h3, h4, a").first().text().trim();
      if (!name) return;

      const statusText = $(el).find(".status, .entity-status").text().trim();
      const dateText = $(el).find(".formation-date, .date").text().trim();

      entities.push({
        entityName: name,
        entityId: `csos-${name.replace(/\s+/g, "-").toLowerCase()}`,
        formationDate: dateText || null,
        status: statusText || "Unknown",
        principalAddress: null,
        registeredAgent: null,
        entityType: null,
        city: null,
        state: "CO",
        searchTerm,
      });
    });
  }

  return entities;
}

/**
 * Determine if a CSOS entity represents an established business
 * based on its formation date.
 */
export function getEstablishedYear(formationDate: string | null): number | null {
  if (!formationDate) return null;

  // Try common date formats: "MM/DD/YYYY", "YYYY-MM-DD", "Month DD, YYYY"
  const dateObj = new Date(formationDate);
  if (isNaN(dateObj.getTime())) {
    // Try extracting just a 4-digit year
    const yearMatch = formationDate.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
  }

  return dateObj.getFullYear();
}

/**
 * Check if this entity is a potential acquisition signal
 * (distressed or established enough for succession).
 */
export function isAcquisitionSignal(entity: CsosEntity): {
  isSignal: boolean;
  reason: string | null;
} {
  const established = getEstablishedYear(entity.formationDate);
  const currentYear = new Date().getFullYear();

  if (entity.status.toLowerCase().includes("delinquent")) {
    return { isSignal: true, reason: "Delinquent status — possible owner disengagement" };
  }

  if (established && currentYear - established >= 20) {
    return { isSignal: true, reason: `Established ${currentYear - established} years — likely succession candidate` };
  }

  if (established && currentYear - established >= 15) {
    return { isSignal: true, reason: `Established ${currentYear - established} years — mature business` };
  }

  return { isSignal: false, reason: null };
}
