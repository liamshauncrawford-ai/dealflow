/**
 * AI Financial Extraction Module
 *
 * Extracts structured P&L line items and add-backs from CIM/financial
 * document text using Claude Sonnet. Follows the same pattern as cim-parser.ts.
 *
 * Trades-specific: recognizes materials vs labor COGS split, vehicle expenses,
 * tool costs, subcontractor fees, and common add-back patterns.
 */

import { callClaude, safeJsonParse } from "./claude-client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ExtractedLineItem {
  category: string;
  subcategory?: string;
  rawLabel: string;
  amount: number;
  isNegative?: boolean;
}

export interface ExtractedAddBack {
  category: string;
  description: string;
  amount: number;
  confidence: number;
  sourceLabel?: string;
}

export interface ExtractedPeriod {
  periodType: string;
  year: number;
  quarter?: number;
  lineItems: ExtractedLineItem[];
  addBacks: ExtractedAddBack[];
}

export interface FinancialExtractionResult {
  periods: ExtractedPeriod[];
  notes: string;
  confidence: number;
}

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
7. All amounts should be positive numbers. Use isNegative=true for COGS/OPEX items

Respond ONLY with a JSON object matching the schema. No explanation text.`;

// ─────────────────────────────────────────────
// Extraction function
// ─────────────────────────────────────────────

export async function extractFinancials(
  documentText: string
): Promise<FinancialExtractionResult> {
  const response = await callClaude({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract all P&L line items and add-backs from the following document text.

## Document Text
${documentText}

## Required Response Schema
{
  "periods": [
    {
      "periodType": "ANNUAL" | "QUARTERLY" | "LTM" | "YTD",
      "year": 2023,
      "quarter": null,
      "lineItems": [
        {
          "category": "REVENUE" | "COGS" | "OPEX" | "D_AND_A" | "INTEREST" | "TAX" | "OTHER_INCOME" | "OTHER_EXPENSE",
          "subcategory": "optional subcategory",
          "rawLabel": "original label from document",
          "amount": 1234567,
          "isNegative": false
        }
      ],
      "addBacks": [
        {
          "category": "OWNER_COMPENSATION" | "PERSONAL_EXPENSES" | "ONE_TIME_COSTS" | "DISCRETIONARY" | "RELATED_PARTY" | "NON_CASH" | "OTHER",
          "description": "what this add-back is",
          "amount": 50000,
          "confidence": 0.9,
          "sourceLabel": "original text that indicates this is an add-back"
        }
      ]
    }
  ],
  "notes": "any important observations about data quality or missing information",
  "confidence": 0.85
}`,
      },
    ],
    maxTokens: 8192,
  });

  return safeJsonParse<FinancialExtractionResult>(response.text);
}
