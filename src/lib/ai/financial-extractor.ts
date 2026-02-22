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

export interface ExtractedPeriod {
  periodType: string;
  year: number;
  quarter?: number | null;
  lineItems: ExtractedLineItem[];
  addBacks: ExtractedAddBack[];
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
  properties: {
    periods: {
      type: "array",
      items: {
        type: "object",
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
              required: ["category", "rawLabel", "amount"],
            },
          },
          addBacks: {
            type: "array",
            items: {
              type: "object",
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
              required: ["category", "description", "amount", "confidence"],
            },
          },
        },
        required: ["periodType", "year", "lineItems", "addBacks"],
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
- Data center / telecom electrical contractors
- B2B service companies with trades labor

IMPORTANT extraction rules:
1. Extract EVERY line item you find, preserving the original label as "rawLabel"
2. Categorize each line item into one of: REVENUE, COGS, OPEX, D_AND_A, INTEREST, TAX, OTHER_INCOME, OTHER_EXPENSE
3. For trades businesses, common COGS subcategories: Materials, Labor, Subcontractors, Equipment Rental
4. Identify add-backs (owner adjustments that inflate normalized earnings):
   - OWNER_COMPENSATION: owner salary above market rate, owner benefits, personal insurance
   - PERSONAL_EXPENSES: personal vehicle, personal travel, personal meals
   - ONE_TIME_COSTS: lawsuit settlements, one-time consulting, relocation costs
   - DISCRETIONARY: donations, sponsorships, country club dues
   - RELATED_PARTY: above-market rent to owner-related entity, related-party fees
   - NON_CASH: depreciation add-backs, amortization of intangibles
   - OTHER: anything else that's clearly discretionary or non-recurring
5. Assign confidence (0-1) to each add-back based on how clearly it's identified
6. If the document has multiple years, extract each as a separate period
7. All amounts should be positive numbers. Use isNegative=true for COGS/OPEX items`;

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
