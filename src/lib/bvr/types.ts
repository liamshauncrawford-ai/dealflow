/**
 * BVR import types — shared across DealStats and BizComps mappers.
 */

export interface BvrRawRow {
  [key: string]: string | number | null | undefined;
}

export interface BvrParsedTransaction {
  sicCode: string | null;
  naicsCode: string | null;
  industry: string | null;
  transactionDate: Date | null;
  mvic: number | null;
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  ebitdaMarginPct: number | null;
  mvicEbitdaMultiple: number | null;
  mvicRevenueMultiple: number | null;
  mvicSdeMultiple: number | null;
  pctCashAtClose: number | null;
  sellerNoteAmount: number | null;
  sellerNoteTermYears: number | null;
  sellerNoteRate: number | null;
  earnoutAmount: number | null;
  employeeCount: number | null;
  yearsInBusiness: number | null;
  state: string | null;
  targetRank: number | null;
}

export interface MapperResult {
  transactions: BvrParsedTransaction[];
  unmappedColumns: string[];
  parseErrors: Array<{ row: number; field: string; error: string }>;
}
