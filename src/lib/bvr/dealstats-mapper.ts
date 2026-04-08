/**
 * BVR DealStats column mapper.
 * Maps DealStats Excel export columns to the common BvrParsedTransaction schema.
 */

import type { BvrRawRow, BvrParsedTransaction, MapperResult } from "./types";
import { matchTargetRank } from "./rank-matcher";
import {
  parseNumber,
  parseDate,
  parseString,
  parseInt as parseIntVal,
} from "./parse-helpers";

type FieldName = keyof BvrParsedTransaction;

/**
 * Column mapping dictionary: lowercase header → field name.
 * Multiple headers can map to the same field.
 */
const COLUMN_MAP: Record<string, FieldName> = {
  "sic code": "sicCode",
  sic: "sicCode",
  "naics code": "naicsCode",
  naics: "naicsCode",
  "sale date": "transactionDate",
  "transaction date": "transactionDate",
  "close date": "transactionDate",
  mvic: "mvic",
  "market value of invested capital": "mvic",
  "sale price": "mvic",
  revenue: "revenue",
  "net revenue": "revenue",
  sales: "revenue",
  "net sales": "revenue",
  ebitda: "ebitda",
  sde: "sde",
  "seller's discretionary earnings": "sde",
  "sellers discretionary earnings": "sde",
  "ebitda margin": "ebitdaMarginPct",
  "ebitda margin %": "ebitdaMarginPct",
  "mvic/ebitda": "mvicEbitdaMultiple",
  "mvic / ebitda": "mvicEbitdaMultiple",
  "mvic/revenue": "mvicRevenueMultiple",
  "mvic / revenue": "mvicRevenueMultiple",
  "mvic/sales": "mvicRevenueMultiple",
  "mvic/sde": "mvicSdeMultiple",
  "mvic / sde": "mvicSdeMultiple",
  "% cash": "pctCashAtClose",
  "cash at close": "pctCashAtClose",
  "pct cash at close": "pctCashAtClose",
  "% cash at close": "pctCashAtClose",
  "seller note": "sellerNoteAmount",
  "seller note amount": "sellerNoteAmount",
  "note term": "sellerNoteTermYears",
  "seller note term": "sellerNoteTermYears",
  "note rate": "sellerNoteRate",
  "seller note rate": "sellerNoteRate",
  earnout: "earnoutAmount",
  "earnout amount": "earnoutAmount",
  employees: "employeeCount",
  "employee count": "employeeCount",
  "# employees": "employeeCount",
  "number of employees": "employeeCount",
  years: "yearsInBusiness",
  "years in business": "yearsInBusiness",
  "age of business": "yearsInBusiness",
  "business age": "yearsInBusiness",
  state: "state",
  industry: "industry",
  "industry description": "industry",
  "sic description": "industry",
};

/** Parser for each field type */
const FIELD_PARSERS: Record<
  FieldName,
  (val: string | number | null | undefined) => unknown
> = {
  sicCode: parseString,
  naicsCode: parseString,
  industry: parseString,
  transactionDate: parseDate,
  mvic: parseNumber,
  revenue: parseNumber,
  ebitda: parseNumber,
  sde: parseNumber,
  ebitdaMarginPct: parseNumber,
  mvicEbitdaMultiple: parseNumber,
  mvicRevenueMultiple: parseNumber,
  mvicSdeMultiple: parseNumber,
  pctCashAtClose: parseNumber,
  sellerNoteAmount: parseNumber,
  sellerNoteTermYears: parseNumber,
  sellerNoteRate: parseNumber,
  earnoutAmount: parseNumber,
  employeeCount: parseIntVal,
  yearsInBusiness: parseIntVal,
  state: parseString,
  targetRank: () => null, // computed, not parsed from row
};

/**
 * Map DealStats rows to normalized BvrParsedTransaction objects.
 */
export function mapDealStatsRows(rows: BvrRawRow[]): MapperResult {
  if (rows.length === 0) {
    return { transactions: [], unmappedColumns: [], parseErrors: [] };
  }

  // Auto-detect headers from first row's keys
  const rawHeaders = Object.keys(rows[0]);
  const headerMapping: Record<string, FieldName> = {};
  const unmappedColumns: string[] = [];

  for (const header of rawHeaders) {
    const normalized = header.trim().toLowerCase();
    const field = COLUMN_MAP[normalized];
    if (field) {
      headerMapping[header] = field;
    } else {
      unmappedColumns.push(header);
    }
  }

  const transactions: BvrParsedTransaction[] = [];
  const parseErrors: Array<{ row: number; field: string; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const txn: BvrParsedTransaction = {
      sicCode: null,
      naicsCode: null,
      industry: null,
      transactionDate: null,
      mvic: null,
      revenue: null,
      ebitda: null,
      sde: null,
      ebitdaMarginPct: null,
      mvicEbitdaMultiple: null,
      mvicRevenueMultiple: null,
      mvicSdeMultiple: null,
      pctCashAtClose: null,
      sellerNoteAmount: null,
      sellerNoteTermYears: null,
      sellerNoteRate: null,
      earnoutAmount: null,
      employeeCount: null,
      yearsInBusiness: null,
      state: null,
      targetRank: null,
    };

    for (const [header, field] of Object.entries(headerMapping)) {
      const rawVal = row[header];
      const parser = FIELD_PARSERS[field];
      try {
        const parsed = parser(rawVal);
        (txn as unknown as Record<string, unknown>)[field] = parsed;
      } catch (err) {
        parseErrors.push({
          row: i,
          field,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Compute target rank from SIC/NAICS codes
    txn.targetRank = matchTargetRank(txn.sicCode, txn.naicsCode);

    transactions.push(txn);
  }

  return { transactions, unmappedColumns, parseErrors };
}
