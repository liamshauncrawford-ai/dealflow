/**
 * BVR BizComps column mapper.
 * Maps BizComps Excel export columns to the common BvrParsedTransaction schema.
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
 * BizComps uses different column names than DealStats.
 */
const COLUMN_MAP: Record<string, FieldName> = {
  "gross revenue": "revenue",
  "annual gross": "revenue",
  "total price": "mvic",
  "selling price": "mvic",
  "sale price": "mvic",
  "disc. earnings": "sde",
  "discretionary earnings": "sde",
  sde: "sde",
  "price/disc. earnings": "mvicSdeMultiple",
  "price/sde": "mvicSdeMultiple",
  "price/gross": "mvicRevenueMultiple",
  "price/revenue": "mvicRevenueMultiple",
  "down payment %": "pctCashAtClose",
  "down pmt %": "pctCashAtClose",
  sic: "sicCode",
  "sic code": "sicCode",
  naics: "naicsCode",
  "naics code": "naicsCode",
  date: "transactionDate",
  "sale date": "transactionDate",
  "close date": "transactionDate",
  state: "state",
  employees: "employeeCount",
  "# employees": "employeeCount",
  years: "yearsInBusiness",
  "yrs est": "yearsInBusiness",
  "years established": "yearsInBusiness",
  industry: "industry",
  "business type": "industry",
  "seller note": "sellerNoteAmount",
  "seller financing": "sellerNoteAmount",
  earnout: "earnoutAmount",
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
 * Map BizComps rows to normalized BvrParsedTransaction objects.
 */
export function mapBizCompsRows(rows: BvrRawRow[]): MapperResult {
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
