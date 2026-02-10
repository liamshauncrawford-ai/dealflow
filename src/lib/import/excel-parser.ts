/**
 * Excel parser for Crawford Acquisition financial models.
 *
 * Extracts key financial metrics from .xlsx files by scanning
 * cell values for known labels and their adjacent values.
 */

import * as XLSX from "xlsx";
import { readFileSync } from "fs";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ExtractedFinancials {
  askingPrice: number | null;
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  cashFlow: number | null;
  employees: number | null;
  inventory: number | null;
  ffe: number | null;
  realEstate: number | null;
  /** 0-1 confidence based on how many fields were found */
  confidence: number;
  /** Which fields were successfully extracted */
  fieldsFound: string[];
}

// ─────────────────────────────────────────────
// Label patterns to search for
// ─────────────────────────────────────────────

interface LabelPattern {
  field: keyof ExtractedFinancials;
  patterns: string[];
  isNumeric: true;
}

const LABEL_PATTERNS: LabelPattern[] = [
  {
    field: "askingPrice",
    patterns: [
      "asking price",
      "purchase price",
      "acquisition price",
      "offer price",
      "total price",
      "sale price",
      "list price",
      "seller asking",
      "seller's asking",
      "listing price",
    ],
    isNumeric: true,
  },
  {
    field: "revenue",
    patterns: [
      "revenue",
      "gross revenue",
      "total revenue",
      "annual revenue",
      "net revenue",
      "sales",
      "total sales",
      "gross sales",
    ],
    isNumeric: true,
  },
  {
    field: "ebitda",
    patterns: [
      "ebitda",
      "adjusted ebitda",
      "adj ebitda",
      "adj. ebitda",
      "earnings before interest",
    ],
    isNumeric: true,
  },
  {
    field: "sde",
    patterns: [
      "sde",
      "seller's discretionary earnings",
      "sellers discretionary earnings",
      "seller discretionary earnings",
      "discretionary earnings",
      "adjusted sde",
      "adj sde",
    ],
    isNumeric: true,
  },
  {
    field: "cashFlow",
    patterns: [
      "cash flow",
      "net cash flow",
      "adjusted cash flow",
      "owner cash flow",
      "owner's cash flow",
      "free cash flow",
      "discretionary cash flow",
    ],
    isNumeric: true,
  },
  {
    field: "employees",
    patterns: [
      "employees",
      "# employees",
      "number of employees",
      "total employees",
      "headcount",
      "staff",
      "fte",
    ],
    isNumeric: true,
  },
  {
    field: "inventory",
    patterns: ["inventory", "inventory value", "total inventory"],
    isNumeric: true,
  },
  {
    field: "ffe",
    patterns: [
      "ff&e",
      "ffe",
      "fixtures",
      "furniture fixtures",
      "furniture, fixtures",
      "equipment value",
    ],
    isNumeric: true,
  },
  {
    field: "realEstate",
    patterns: [
      "real estate",
      "property value",
      "real property",
      "land and building",
    ],
    isNumeric: true,
  },
];

// Total fields we try to extract (for confidence calculation)
const TOTAL_FIELDS = LABEL_PATTERNS.length;

// ─────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────

/**
 * Parse a Crawford Acquisition Excel model and extract
 * key financial metrics.
 */
export function parseExcelFinancials(filePath: string): ExtractedFinancials {
  const result: ExtractedFinancials = {
    askingPrice: null,
    revenue: null,
    ebitda: null,
    sde: null,
    cashFlow: null,
    employees: null,
    inventory: null,
    ffe: null,
    realEstate: null,
    confidence: 0,
    fieldsFound: [],
  };

  try {
    // Read via Buffer to handle iCloud Drive evicted files
    // (XLSX.readFile uses its own file reader which fails on iCloud paths)
    const buffer = readFileSync(filePath);
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      cellNF: true,
      cellText: false,
      cellFormula: true,
    });

    // Track which fields we've already found
    const foundFields = new Set<string>();

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // Get the range of cells
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

      // Scan every cell looking for label-value pairs
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = sheet[cellAddr];

          if (!cell || cell.t !== "s") continue; // Only text cells as labels
          const cellText = String(cell.v || "").toLowerCase().trim();
          if (!cellText || cellText.length < 2) continue;

          // Check against each label pattern
          for (const pattern of LABEL_PATTERNS) {
            if (foundFields.has(pattern.field)) continue;

            const matched = pattern.patterns.some(
              (p) => cellText === p || cellText.includes(p)
            );

            if (!matched) continue;

            // Found a matching label — look for the value
            const value = findAdjacentValue(sheet, row, col, range);

            if (value !== null) {
              if (pattern.field === "employees") {
                result.employees = Math.round(value);
              } else {
                (result as unknown as Record<string, unknown>)[pattern.field] = value;
              }
              foundFields.add(pattern.field);
              result.fieldsFound.push(pattern.field);
            }
          }
        }
      }
    }

    // Calculate confidence
    result.confidence =
      TOTAL_FIELDS > 0 ? foundFields.size / TOTAL_FIELDS : 0;
  } catch (error) {
    console.warn(
      `[EXCEL] Failed to parse ${filePath}:`,
      error instanceof Error ? error.message : error
    );
  }

  return result;
}

// ─────────────────────────────────────────────
// Value extraction helpers
// ─────────────────────────────────────────────

/**
 * Look for a numeric value adjacent to a label cell.
 * Checks: right (same row), below (same column), two cells right.
 */
function findAdjacentValue(
  sheet: XLSX.WorkSheet,
  row: number,
  col: number,
  range: XLSX.Range
): number | null {
  // Strategy 1: Cell to the right (most common)
  const rightValue = getNumericValue(sheet, row, col + 1);
  if (rightValue !== null) return rightValue;

  // Strategy 2: Two cells to the right
  if (col + 2 <= range.e.c) {
    const right2Value = getNumericValue(sheet, row, col + 2);
    if (right2Value !== null) return right2Value;
  }

  // Strategy 3: Cell below
  if (row + 1 <= range.e.r) {
    const belowValue = getNumericValue(sheet, row + 1, col);
    if (belowValue !== null) return belowValue;
  }

  // Strategy 4: Three cells to the right (for wide layouts)
  if (col + 3 <= range.e.c) {
    const right3Value = getNumericValue(sheet, row, col + 3);
    if (right3Value !== null) return right3Value;
  }

  return null;
}

/**
 * Extract a numeric value from a specific cell.
 *
 * Handles direct numbers, formula cells with cached results,
 * and string cells with formatted numbers (e.g., "$1,200,000").
 */
function getNumericValue(
  sheet: XLSX.WorkSheet,
  row: number,
  col: number
): number | null {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];

  if (!cell) return null;

  // Direct number (cell.t === "n")
  if (cell.t === "n" && typeof cell.v === "number") {
    const value = cell.v;
    if (value === 0 || isNaN(value)) return null;
    return Math.round(value * 100) / 100;
  }

  // String that looks like a number (e.g., "$1,200,000")
  if (cell.t === "s" && typeof cell.v === "string") {
    return parseNumericString(cell.v);
  }

  // Formula cell — xlsx caches the calculated result in cell.v
  // even when cell.f is present. Handle both numeric and string results.
  if (cell.f !== undefined && cell.v !== undefined) {
    if (typeof cell.v === "number") {
      if (cell.v === 0 || isNaN(cell.v)) return null;
      return Math.round(cell.v * 100) / 100;
    }
    if (typeof cell.v === "string") {
      return parseNumericString(cell.v);
    }
  }

  // Fallback: any cell with a numeric .v we haven't handled yet
  if (typeof cell.v === "number" && cell.v !== 0 && !isNaN(cell.v)) {
    return Math.round(cell.v * 100) / 100;
  }

  return null;
}

/**
 * Parse a numeric string like "$1,200,000" or "1.2M".
 */
function parseNumericString(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "").trim();

  if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "n/a") {
    return null;
  }

  // Handle M/K suffixes
  const mMatch = cleaned.match(/^([\d.]+)\s*m$/i);
  if (mMatch) {
    return parseFloat(mMatch[1]) * 1_000_000 || null;
  }

  const kMatch = cleaned.match(/^([\d.]+)\s*k$/i);
  if (kMatch) {
    return parseFloat(kMatch[1]) * 1_000 || null;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) || num === 0 ? null : num;
}
