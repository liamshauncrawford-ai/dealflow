/**
 * Common parsing helper functions used across all platform scrapers.
 */

/**
 * Parse a price string into a numeric value.
 * Handles formats like "$1,200,000", "$1.2M", "$800K", "1200000", "Not Disclosed", etc.
 * Returns null if the price cannot be parsed.
 */
export function parsePrice(text: string): number | null {
  if (!text) return null;

  const cleaned = text.trim().toLowerCase();

  // Detect "not disclosed", "n/a", "upon request", "confidential", etc.
  if (
    cleaned.includes("not disclosed") ||
    cleaned.includes("n/a") ||
    cleaned.includes("upon request") ||
    cleaned.includes("confidential") ||
    cleaned.includes("call") ||
    cleaned === "-" ||
    cleaned === ""
  ) {
    return null;
  }

  // Remove dollar signs and whitespace
  let normalized = cleaned.replace(/[$\s]/g, "");

  // Handle millions: "1.2m" or "1.2 million"
  const millionMatch = normalized.match(/^([\d,.]+)\s*m(?:illion)?$/);
  if (millionMatch) {
    const value = parseFloat(millionMatch[1].replace(/,/g, ""));
    return isNaN(value) ? null : Math.round(value * 1_000_000);
  }

  // Handle thousands: "800k" or "800 thousand"
  const thousandMatch = normalized.match(/^([\d,.]+)\s*k(?:thousand)?$/);
  if (thousandMatch) {
    const value = parseFloat(thousandMatch[1].replace(/,/g, ""));
    return isNaN(value) ? null : Math.round(value * 1_000);
  }

  // Handle billions: "1.2b" or "1.2 billion"
  const billionMatch = normalized.match(/^([\d,.]+)\s*b(?:illion)?$/);
  if (billionMatch) {
    const value = parseFloat(billionMatch[1].replace(/,/g, ""));
    return isNaN(value) ? null : Math.round(value * 1_000_000_000);
  }

  // Standard numeric: "1,200,000" or "1200000"
  normalized = normalized.replace(/,/g, "");
  const value = parseFloat(normalized);
  return isNaN(value) ? null : Math.round(value);
}

/**
 * Parse a location string into city, state, and zip code components.
 * Handles formats like:
 *   "Denver, CO"
 *   "Denver, CO 80202"
 *   "Denver, Colorado"
 *   "Colorado"
 */
export function parseLocation(text: string): {
  city: string | null;
  state: string | null;
  zipCode: string | null;
} {
  const result: { city: string | null; state: string | null; zipCode: string | null } = {
    city: null,
    state: null,
    zipCode: null,
  };

  if (!text) return result;

  let cleaned = normalizeText(text);

  // Extract zip code (5-digit or 5+4 format)
  const zipMatch = cleaned.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) {
    result.zipCode = zipMatch[1];
    cleaned = cleaned.replace(zipMatch[0], "").trim();
  }

  // Try "City, State" pattern
  const cityStateMatch = cleaned.match(/^(.+?),\s*(.+)$/);
  if (cityStateMatch) {
    result.city = cityStateMatch[1].trim() || null;
    const stateRaw = cityStateMatch[2].trim();
    result.state = normalizeState(stateRaw) || stateRaw || null;
  } else {
    // Could be just a state or just a city
    const stateAbbrev = normalizeState(cleaned);
    if (stateAbbrev) {
      result.state = stateAbbrev;
    } else {
      // Assume it is a city if it is a single word / short phrase
      result.city = cleaned || null;
    }
  }

  return result;
}

/**
 * Normalize whitespace: collapse multiple spaces/newlines into a single space, trim.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Extract all email addresses from a text string.
 */
export function extractEmails(text: string): string[] {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches ? [...new Set(matches.map((e) => e.toLowerCase()))] : [];
}

/**
 * Extract all phone numbers from a text string.
 * Returns numbers in a normalized format.
 */
export function extractPhones(text: string): string[] {
  if (!text) return [];

  // Match common US phone formats
  const phoneRegex =
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex);
  if (!matches) return [];

  const normalized = matches
    .map((phone) => {
      const digits = phone.replace(/\D/g, "");
      // Must have at least 10 digits to be a valid US phone
      if (digits.length < 10) return null;
      // Normalize to 10-digit format (strip leading 1)
      const tenDigit = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      if (tenDigit.length !== 10) return null;
      return `(${tenDigit.slice(0, 3)}) ${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}`;
    })
    .filter((p): p is string => p !== null);

  return [...new Set(normalized)];
}

/**
 * Check if a listing is located in Colorado.
 */
export function isColoradoListing(city: string | null, state: string | null): boolean {
  if (!state) return false;
  const normalized = state.trim().toUpperCase();
  return normalized === "CO" || normalized === "COLORADO";
}

/**
 * Denver metro area cities (case-insensitive comparison).
 */
const DENVER_METRO_CITIES: Set<string> = new Set([
  "denver",
  "aurora",
  "lakewood",
  "arvada",
  "westminster",
  "thornton",
  "centennial",
  "boulder",
  "longmont",
  "broomfield",
  "castle rock",
  "parker",
  "littleton",
  "englewood",
  "commerce city",
  "brighton",
  "northglenn",
  "wheat ridge",
  "golden",
  "louisville",
  "lafayette",
  "superior",
  "erie",
  "frederick",
  "firestone",
]);

/**
 * Check if a city is in the Denver metropolitan area.
 */
export function isDenverMetro(city: string | null): boolean {
  if (!city) return false;
  return DENVER_METRO_CITIES.has(city.trim().toLowerCase());
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

// Valid 2-letter state abbreviations
const VALID_STATE_ABBREVS = new Set(Object.values(STATE_ABBREVIATIONS));

/**
 * Normalize a state name or abbreviation to its 2-letter abbreviation.
 * Returns null if not recognized.
 */
function normalizeState(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Already a 2-letter abbreviation
  if (trimmed.length === 2) {
    const upper = trimmed.toUpperCase();
    return VALID_STATE_ABBREVS.has(upper) ? upper : null;
  }

  // Full state name
  const abbrev = STATE_ABBREVIATIONS[trimmed.toLowerCase()];
  return abbrev || null;
}
