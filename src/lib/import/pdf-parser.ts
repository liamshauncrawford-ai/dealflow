/**
 * PDF parser for CIM (Confidential Information Memorandum) documents.
 *
 * Extracts business details and financial metrics from PDF text
 * using pattern-matching against common CIM layouts.
 *
 * Uses pdfjs-dist directly (instead of pdf-parse wrapper) to avoid
 * worker resolution issues in Next.js dev server.
 *
 * Lower confidence than Excel extraction since PDFs are less structured.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ExtractedCIMData {
  businessName: string | null;
  description: string | null;
  askingPrice: number | null;
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  cashFlow: number | null;
  employees: number | null;
  inventory: number | null;
  ffe: number | null;
  realEstate: number | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  established: number | null;
  reasonForSale: string | null;
  /** 0-1 confidence — generally lower than Excel extraction */
  confidence: number;
  /** Which fields were successfully extracted */
  fieldsFound: string[];
}

// ─────────────────────────────────────────────
// Financial keyword patterns
// ─────────────────────────────────────────────

interface FinancialPattern {
  field: string;
  keywords: RegExp[];
}

const FINANCIAL_PATTERNS: FinancialPattern[] = [
  {
    field: "askingPrice",
    keywords: [
      /asking\s*price/i,
      /purchase\s*price/i,
      /acquisition\s*price/i,
      /sale\s*price/i,
      /list\s*price/i,
      /offering\s*price/i,
      /total\s*price/i,
    ],
  },
  {
    field: "revenue",
    keywords: [
      /(?:gross|total|annual|net)?\s*revenue/i,
      /(?:gross|total|annual|net)?\s*sales/i,
      /top[\s-]*line/i,
    ],
  },
  {
    field: "ebitda",
    keywords: [
      /(?:adjusted?\s*)?ebitda/i,
      /adj\.?\s*ebitda/i,
      /earnings\s*before\s*interest/i,
    ],
  },
  {
    field: "sde",
    keywords: [
      /(?:adjusted?\s*)?sde/i,
      /seller'?s?\s*discretionary\s*(?:earnings|cash\s*flow)/i,
      /discretionary\s*earnings/i,
    ],
  },
  {
    field: "cashFlow",
    keywords: [
      /(?:net|adjusted|owner'?s?|free|discretionary)?\s*cash\s*flow/i,
      /operating\s*cash\s*flow/i,
    ],
  },
  {
    field: "employees",
    keywords: [
      /(?:number\s*of\s*|total\s*|#\s*)?employees/i,
      /headcount/i,
      /(?:total\s*)?staff/i,
      /\bfte\b/i,
    ],
  },
  {
    field: "inventory",
    keywords: [/(?:total\s*)?inventory(?:\s*value)?/i],
  },
  {
    field: "ffe",
    keywords: [/ff\s*&?\s*e/i, /furniture[\s,]*fixtures/i, /equipment\s*value/i],
  },
  {
    field: "realEstate",
    keywords: [
      /real\s*estate/i,
      /property\s*value/i,
      /real\s*property/i,
      /land\s*(?:and|&)\s*building/i,
    ],
  },
];

// ─────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────

/**
 * Extract raw text from a PDF buffer using pdfjs-dist.
 * Reusable by both the regex-based parser and the AI CIM parser.
 */
export async function extractPdfText(buffer: Buffer, maxPages = 30): Promise<string> {
  // Use pdfjs-dist directly to avoid pdf-parse v2 worker resolution issues
  // in Next.js dev server (pdf.worker.mjs not found in .next/dev/server/chunks/).
  //
  // CRITICAL: We use createRequire() instead of import() because Next.js/webpack
  // intercepts dynamic import() and rewrites paths to chunk references, which
  // breaks pdfjs-dist's worker file resolution. createRequire() uses Node's
  // native module loader, bypassing webpack entirely.
  const nodeRequire = createRequire(resolve(process.cwd(), "package.json"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = nodeRequire("pdfjs-dist/legacy/build/pdf.mjs");

  // Point worker to the actual file on disk via file:// URL
  const workerPath = resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc = "file://" + workerPath;

  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  let text = "";
  const pagesToRead = Math.min(doc.numPages, maxPages);
  for (let i = 1; i <= pagesToRead; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    text += (content.items as any[]).map((item) => item.str).join(" ") + "\n";
  }
  await doc.destroy();

  return text;
}

/**
 * Parse a CIM or financial PDF and extract business details
 * and financial metrics using pattern matching.
 */
export async function parseCIMPdf(filePath: string): Promise<ExtractedCIMData> {
  const result: ExtractedCIMData = {
    businessName: null,
    description: null,
    askingPrice: null,
    revenue: null,
    ebitda: null,
    sde: null,
    cashFlow: null,
    employees: null,
    inventory: null,
    ffe: null,
    realEstate: null,
    city: null,
    state: null,
    industry: null,
    established: null,
    reasonForSale: null,
    confidence: 0,
    fieldsFound: [],
  };

  try {
    const buffer = readFileSync(filePath);
    const text = await extractPdfText(buffer);

    if (!text || text.length < 50) {
      return result;
    }

    // Extract business name from first page
    result.businessName = extractBusinessName(text);
    if (result.businessName) result.fieldsFound.push("businessName");

    // Extract description
    result.description = extractDescription(text);
    if (result.description) result.fieldsFound.push("description");

    // Extract location
    const location = extractLocation(text);
    if (location.city) {
      result.city = location.city;
      result.fieldsFound.push("city");
    }
    if (location.state) {
      result.state = location.state;
      result.fieldsFound.push("state");
    }

    // Extract industry
    result.industry = extractIndustry(text);
    if (result.industry) result.fieldsFound.push("industry");

    // Extract year established
    result.established = extractEstablished(text);
    if (result.established) result.fieldsFound.push("established");

    // Extract reason for sale
    result.reasonForSale = extractReasonForSale(text);
    if (result.reasonForSale) result.fieldsFound.push("reasonForSale");

    // Extract financial metrics
    const financials = extractFinancials(text);
    const financialFields = [
      "askingPrice",
      "revenue",
      "ebitda",
      "sde",
      "cashFlow",
      "employees",
      "inventory",
      "ffe",
      "realEstate",
    ] as const;

    for (const field of financialFields) {
      if (financials[field] !== null) {
        (result as unknown as Record<string, unknown>)[field] = financials[field];
        result.fieldsFound.push(field);
      }
    }

    // Calculate confidence — lower base than Excel since PDFs are noisier
    const totalPossibleFields = 14; // all extractable fields
    const baseConfidence = result.fieldsFound.length / totalPossibleFields;
    // Cap PDF confidence at 0.75 since regex extraction is less reliable
    result.confidence = Math.min(baseConfidence, 0.75);
  } catch (error) {
    console.warn(
      `[PDF] Failed to parse ${filePath}:`,
      error instanceof Error ? error.message : error
    );
  }

  return result;
}

// ─────────────────────────────────────────────
// Extraction helpers
// ─────────────────────────────────────────────

/**
 * Extract business name — usually appears prominently in first ~500 chars.
 * Look for patterns like "Company: X", "Business Name: X", or
 * "Confidential Information Memorandum" followed by a business name.
 */
function extractBusinessName(text: string): string | null {
  const firstPage = text.substring(0, 2000);

  // Pattern 1: "Company: X" or "Business Name: X"
  const labelMatch = firstPage.match(
    /(?:company|business)\s*(?:name)?\s*[:]\s*(.+?)(?:\n|$)/i
  );
  if (labelMatch?.[1]) {
    const name = labelMatch[1].trim();
    if (name.length >= 3 && name.length <= 100) return name;
  }

  // Pattern 2: After "Confidential Information Memorandum" header
  const cimMatch = firstPage.match(
    /confidential\s*information\s*memorandum\s*(?:for\s+)?(.+?)(?:\n|$)/i
  );
  if (cimMatch?.[1]) {
    const name = cimMatch[1].trim();
    if (name.length >= 3 && name.length <= 100) return name;
  }

  // Pattern 3: "Prepared for" or "Regarding"
  const preparedMatch = firstPage.match(
    /(?:prepared\s*for|regarding)\s*[:]\s*(.+?)(?:\n|$)/i
  );
  if (preparedMatch?.[1]) {
    const name = preparedMatch[1].trim();
    if (name.length >= 3 && name.length <= 100) return name;
  }

  return null;
}

/**
 * Extract a business description / executive summary.
 * Look for sections labeled "Executive Summary", "Business Overview",
 * "Company Description", etc.
 */
function extractDescription(text: string): string | null {
  const sectionPatterns = [
    /(?:executive\s*summary|business\s*overview|company\s*(?:description|overview)|business\s*description)\s*[:\n]\s*([\s\S]{50,1500}?)(?=\n\s*(?:[A-Z][A-Z\s]{3,}|financial|revenue|asking|price|location|industry|\d+\.\s))/i,
  ];

  for (const pattern of sectionPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      // Clean up the text
      let desc = match[1]
        .replace(/\s+/g, " ")
        .trim();
      // Truncate to reasonable length
      if (desc.length > 500) {
        desc = desc.substring(0, 497) + "...";
      }
      if (desc.length >= 30) return desc;
    }
  }

  return null;
}

/**
 * Extract location from text. Look for patterns like
 * "Location: Denver, CO" or "located in Denver, Colorado".
 */
function extractLocation(text: string): {
  city: string | null;
  state: string | null;
} {
  const stateAbbrevs =
    "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY";

  // Pattern 1: "Location: City, ST"
  const locationLabel = text.match(
    new RegExp(
      `location\\s*[:.]\\s*([A-Za-z\\s]+),\\s*(${stateAbbrevs})`,
      "i"
    )
  );
  if (locationLabel) {
    return {
      city: locationLabel[1].trim(),
      state: locationLabel[2].toUpperCase(),
    };
  }

  // Pattern 2: "located in City, State"
  const locatedIn = text.match(
    new RegExp(
      `located\\s+in\\s+([A-Za-z\\s]+),\\s*(${stateAbbrevs})`,
      "i"
    )
  );
  if (locatedIn) {
    return {
      city: locatedIn[1].trim(),
      state: locatedIn[2].toUpperCase(),
    };
  }

  // Pattern 3: Any "City, ST" near beginning
  const cityState = text.substring(0, 3000).match(
    new RegExp(`([A-Z][a-z]+(?:\\s[A-Z][a-z]+)?),\\s*(${stateAbbrevs})\\b`)
  );
  if (cityState) {
    return {
      city: cityState[1].trim(),
      state: cityState[2].toUpperCase(),
    };
  }

  return { city: null, state: null };
}

/**
 * Extract industry from text.
 */
function extractIndustry(text: string): string | null {
  const match = text.match(
    /(?:industry|sector|business\s*type)\s*[:]\s*(.+?)(?:\n|$)/i
  );
  if (match?.[1]) {
    const industry = match[1].trim();
    if (industry.length >= 3 && industry.length <= 100) return industry;
  }
  return null;
}

/**
 * Extract year established.
 */
function extractEstablished(text: string): number | null {
  const patterns = [
    /(?:established|founded|in\s*business\s*since|year\s*established)\s*(?:in\s*)?[:.]?\s*(\d{4})/i,
    /(?:since|est\.?)\s*(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const year = parseInt(match[1]);
      if (year >= 1900 && year <= new Date().getFullYear()) return year;
    }
  }
  return null;
}

/**
 * Extract reason for sale.
 */
function extractReasonForSale(text: string): string | null {
  const match = text.match(
    /(?:reason\s*for\s*(?:sale|selling)|why\s*selling)\s*[:]\s*(.+?)(?:\n|$)/i
  );
  if (match?.[1]) {
    const reason = match[1].trim();
    if (reason.length >= 5 && reason.length <= 300) return reason;
  }
  return null;
}

/**
 * Extract financial metrics by finding dollar amounts near financial keywords.
 *
 * Strategy: For each financial pattern, search the text for the keyword,
 * then look for a dollar amount ($X,XXX,XXX or $X.XM) within ~100 chars.
 */
function extractFinancials(
  text: string
): Record<string, number | null> {
  const results: Record<string, number | null> = {
    askingPrice: null,
    revenue: null,
    ebitda: null,
    sde: null,
    cashFlow: null,
    employees: null,
    inventory: null,
    ffe: null,
    realEstate: null,
  };

  // Dollar amount pattern: $1,234,567 or $1.2M or $800K or 1,234,567
  const dollarPattern =
    /\$\s*([\d,]+(?:\.\d+)?)\s*(?:million|mil|mm|m|thousand|k)?|\b([\d,]+(?:\.\d+)?)\s*(?:million|mil|mm|m|thousand|k)\b/gi;

  for (const pattern of FINANCIAL_PATTERNS) {
    if (results[pattern.field] !== null) continue;

    for (const keyword of pattern.keywords) {
      const keywordMatch = keyword.exec(text);
      if (!keywordMatch) continue;

      const matchIndex = keywordMatch.index;
      // Look within 150 characters after the keyword
      const searchWindow = text.substring(matchIndex, matchIndex + 200);

      // Reset lastIndex for the dollar pattern
      dollarPattern.lastIndex = 0;
      const dollarMatch = dollarPattern.exec(searchWindow);

      if (dollarMatch) {
        const value = parseDollarAmount(dollarMatch[0]);
        if (value !== null) {
          // Special handling for employees — expect small numbers
          if (pattern.field === "employees") {
            if (value <= 10000) {
              results.employees = Math.round(value);
            }
          } else {
            results[pattern.field] = value;
          }
          break; // Found value for this field, move to next
        }
      }

      // Also check for plain numbers near employee keywords
      if (pattern.field === "employees" && results.employees === null) {
        const numMatch = searchWindow.match(/[:]\s*(\d{1,5})\b/);
        if (numMatch) {
          const emp = parseInt(numMatch[1]);
          if (emp > 0 && emp <= 10000) {
            results.employees = emp;
            break;
          }
        }
      }
    }
  }

  return results;
}

/**
 * Parse a dollar amount string into a number.
 * Handles: "$1,234,567", "$1.2M", "$1.2 million", "$800K", "$800 thousand"
 */
function parseDollarAmount(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "").trim();

  if (!cleaned) return null;

  // Check for million suffix
  const millionMatch = cleaned.match(/^([\d.]+)\s*(?:million|mil|mm|m)$/i);
  if (millionMatch) {
    const val = parseFloat(millionMatch[1]);
    return isNaN(val) ? null : val * 1_000_000;
  }

  // Check for thousand suffix
  const thousandMatch = cleaned.match(/^([\d.]+)\s*(?:thousand|k)$/i);
  if (thousandMatch) {
    const val = parseFloat(thousandMatch[1]);
    return isNaN(val) ? null : val * 1_000;
  }

  // Plain number
  const num = parseFloat(cleaned);
  return isNaN(num) || num === 0 ? null : num;
}
