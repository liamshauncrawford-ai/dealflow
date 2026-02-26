/**
 * AI Financial Extraction Module
 *
 * Extracts structured P&L line items and add-backs from CIM/financial
 * document text using Claude Sonnet with **Structured Outputs**.
 *
 * Uses `callClaudeStructured()` + `jsonSchemaOutputFormat()` to guarantee
 * valid, schema-conformant JSON on every response — no manual JSON parsing.
 *
 * Trades-specific: recognizes materials vs labor COGS split, vehicle expenses,
 * tool costs, subcontractor fees, and common add-back patterns.
 */

import { callClaudeStructured } from "./claude-client";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ExtractedLineItem {
  category: string;
  subcategory?: string | null;
  rawLabel: string;
  amount: number;
  isNegative?: boolean;
}

export interface ExtractedAddBack {
  category: string;
  description: string;
  amount: number;
  confidence: number;
  sourceLabel?: string | null;
}

export interface PnlSubtotals {
  totalRevenue?: number | null;
  totalCogs?: number | null;
  grossProfit?: number | null;
  totalExpenses?: number | null;
  netIncome?: number | null;
  ebitda?: number | null;
}

export interface ExtractedPeriod {
  periodType: string;
  year: number;
  quarter?: number | null;
  lineItems: ExtractedLineItem[];
  addBacks: ExtractedAddBack[];
  pnlSubtotals?: PnlSubtotals | null;
}

export interface FinancialExtractionResult {
  periods: ExtractedPeriod[];
  notes: string;
  confidence: number;
}

// ─────────────────────────────────────────────
// JSON Schema for Structured Outputs
// (must mirror the TypeScript types above)
// ─────────────────────────────────────────────

const FINANCIAL_EXTRACTION_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    periods: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          periodType: {
            type: "string",
            enum: ["ANNUAL", "QUARTERLY", "LTM", "YTD"],
          },
          year: { type: "integer" },
          quarter: { type: ["integer", "null"] },
          lineItems: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                category: {
                  type: "string",
                  enum: [
                    "REVENUE",
                    "COGS",
                    "OPEX",
                    "D_AND_A",
                    "INTEREST",
                    "TAX",
                    "OTHER_INCOME",
                    "OTHER_EXPENSE",
                  ],
                },
                subcategory: { type: ["string", "null"] },
                rawLabel: { type: "string" },
                amount: { type: "number" },
                isNegative: { type: "boolean" },
              },
              required: [
                "category",
                "subcategory",
                "rawLabel",
                "amount",
                "isNegative",
              ],
            },
          },
          addBacks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                category: {
                  type: "string",
                  enum: [
                    "OWNER_COMPENSATION",
                    "PERSONAL_EXPENSES",
                    "ONE_TIME_COSTS",
                    "DISCRETIONARY",
                    "RELATED_PARTY",
                    "NON_CASH",
                    "OTHER",
                  ],
                },
                description: { type: "string" },
                amount: { type: "number" },
                confidence: { type: "number" },
                sourceLabel: { type: ["string", "null"] },
              },
              required: [
                "category",
                "description",
                "amount",
                "confidence",
                "sourceLabel",
              ],
            },
          },
          pnlSubtotals: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  totalRevenue: { type: ["number", "null"] },
                  totalCogs: { type: ["number", "null"] },
                  grossProfit: { type: ["number", "null"] },
                  totalExpenses: { type: ["number", "null"] },
                  netIncome: { type: ["number", "null"] },
                  ebitda: { type: ["number", "null"] },
                },
                required: [
                  "totalRevenue",
                  "totalCogs",
                  "grossProfit",
                  "totalExpenses",
                  "netIncome",
                  "ebitda",
                ],
              },
              { type: "null" },
            ],
          },
        },
        required: [
          "periodType",
          "year",
          "quarter",
          "lineItems",
          "addBacks",
          "pnlSubtotals",
        ],
      },
    },
    notes: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["periods", "notes", "confidence"],
} as const;

// Pre-compute the output format (module-level, computed once)
const FINANCIAL_OUTPUT_FORMAT = jsonSchemaOutputFormat(FINANCIAL_EXTRACTION_SCHEMA);

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a financial data extraction specialist for M&A due diligence.
You extract structured P&L (Profit & Loss) data from business documents (CIMs, financial statements, tax returns).

This tool is used by a buyer evaluating small-to-mid-market businesses ($1M-$10M revenue), particularly:
- Commercial service contractors (electrical, HVAC, plumbing, roofing, etc.)
- B2B service companies with trades labor

IMPORTANT extraction rules:
1. Extract line items, preserving the original label as "rawLabel"
2. CRITICAL — LEAF ITEMS ONLY: When a P&L has both summary/total rows AND individual
   detail items beneath them, extract ONLY the leaf-level detail items — NOT the
   summary totals. For example:
   - If you see "Payroll Expenses (Total): $619,798" followed by individual wage lines
     (Salary, Regular Pay, Overtime, etc.), extract ONLY the individual wage lines.
   - If you see "Insurance (Total): $19,205" followed by Health Insurance, Liability
     Insurance, etc., extract ONLY the individual insurance lines.
   - The (Total) / summary rows would cause double-counting when our system sums the
     line items.
   Exception: If a subtotal has NO visible children (e.g., "Bank Service Charges: $1,123"
   with no breakdown), extract it as a normal line item since it IS the leaf-level data.
3. Categorize each line item into one of: REVENUE, COGS, OPEX, D_AND_A, INTEREST, TAX, OTHER_INCOME, OTHER_EXPENSE
4. For trades businesses, common COGS subcategories: Materials, Labor, Subcontractors, Equipment Rental
5. Identify add-backs (owner adjustments that inflate normalized earnings):
   - OWNER_COMPENSATION: owner salary above market rate, owner benefits, personal insurance
   - PERSONAL_EXPENSES: personal vehicle, personal travel, personal meals
   - ONE_TIME_COSTS: lawsuit settlements, one-time consulting, relocation costs
   - DISCRETIONARY: donations, sponsorships, country club dues
   - RELATED_PARTY: above-market rent to owner-related entity, related-party fees
   - NON_CASH: depreciation add-backs, amortization of intangibles
   - OTHER: anything else that's clearly discretionary or non-recurring
6. Assign confidence (0-1) to each add-back based on how clearly it's identified
7. If the document has multiple years, extract each as a separate period
8. All amounts should be positive numbers. Use isNegative=true for COGS/OPEX items
9. When the P&L directly states computed subtotals (Gross Profit, Total Revenue,
   Total COGS, Total Expenses, Net Income, EBITDA, Net Ordinary Income, etc.),
   extract them into the "pnlSubtotals" object for the period. These are used
   as override values when the line-item sum doesn't match the P&L's own math.`;

// ─────────────────────────────────────────────
// Context limit — prevents overflowing Claude's context window
// ─────────────────────────────────────────────

const MAX_TEXT_CHARS = 80_000; // ~20K tokens — leaves room for system prompt + 8K response

// ─────────────────────────────────────────────
// Extraction function
// ─────────────────────────────────────────────

export async function extractFinancials(
  documentText: string,
  options?: { divisionFilter?: string },
): Promise<FinancialExtractionResult> {
  // Cap text length to stay within context limits (same pattern as cim-parser.ts)
  const truncatedText =
    documentText.length > MAX_TEXT_CHARS
      ? documentText.slice(0, MAX_TEXT_CHARS) + "\n\n[... document truncated at 80K characters ...]"
      : documentText;

  // Build division filter instruction if provided
  const divisionInstruction = options?.divisionFilter
    ? `\n\nCRITICAL FILTER: This document may contain data for multiple divisions, segments, or classes.
ONLY extract line items for the "${options.divisionFilter}" division/segment/class.
Ignore all rows, columns, or sections that belong to other divisions.
If the document has columns per division, only use the "${options.divisionFilter}" column.
If the document organizes data by class or segment, only extract the "${options.divisionFilter}" section.\n`
    : "";

  // Call Claude with structured outputs — JSON conformance is guaranteed by the API
  const response = await callClaudeStructured<FinancialExtractionResult>({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract all P&L line items and add-backs from the following document text.${divisionInstruction}

## Document Text
${truncatedText}`,
      },
    ],
    maxTokens: 8192,
    outputFormat: FINANCIAL_OUTPUT_FORMAT,
  });

  const result = response.parsed;

  // Defensive defaults — schema guarantees these fields exist,
  // but protect against edge cases in case the values are unexpected
  if (typeof result.confidence !== "number") {
    result.confidence = 0.5;
  }
  if (!result.notes) {
    result.notes = "";
  }

  return result;
}
