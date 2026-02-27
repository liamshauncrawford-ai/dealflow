/**
 * AI-powered scenario comparison for valuation models.
 *
 * Uses Claude structured output to generate deal comparison analysis
 * with value creation decomposition, covenant checks, and negotiation advice.
 */

import { callClaudeStructured } from "./claude-client";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

// ─────────────────────────────────────────────
// Structured output schema
// ─────────────────────────────────────────────

export interface ScenarioComparisonResult {
  verdict: string;
  risk_adjusted_assessment: string;
  value_creation_bridge: Array<{
    scenario_name: string;
    ebitda_growth_pct: number;
    multiple_expansion_pct: number;
    debt_paydown_pct: number;
  }>;
  covenant_check: string;
  downside_resilience: string;
  negotiation_strategy: string;
}

const COMPARISON_SCHEMA = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      description: "2-3 sentence recommendation of which scenario is best and why",
    },
    risk_adjusted_assessment: {
      type: "string",
      description: "Which scenario has the best risk/return profile. Flag scenarios where returns depend too heavily on a single lever.",
    },
    value_creation_bridge: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scenario_name: { type: "string" },
          ebitda_growth_pct: { type: "number", description: "% of total return from EBITDA growth" },
          multiple_expansion_pct: { type: "number", description: "% of total return from multiple expansion" },
          debt_paydown_pct: { type: "number", description: "% of total return from debt paydown" },
        },
        required: ["scenario_name", "ebitda_growth_pct", "multiple_expansion_pct", "debt_paydown_pct"],
        additionalProperties: false,
      },
      description: "IRR decomposition per scenario: what % of returns come from each lever",
    },
    covenant_check: {
      type: "string",
      description: "Would each scenario pass SBA 7(a) underwriting (DSCR >= 1.25x)? Would bank lenders be comfortable?",
    },
    downside_resilience: {
      type: "string",
      description: "If EBITDA drops 20%, what happens to each scenario's DSCR and cash flow?",
    },
    negotiation_strategy: {
      type: "string",
      description: "Deal-specific advice on structuring the initial offer based on scenario analysis",
    },
  },
  required: [
    "verdict",
    "risk_adjusted_assessment",
    "value_creation_bridge",
    "covenant_check",
    "downside_resilience",
    "negotiation_strategy",
  ],
  additionalProperties: false,
} as const;

const COMPARISON_OUTPUT_FORMAT = jsonSchemaOutputFormat(COMPARISON_SCHEMA);

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior M&A advisor at Crawford Holdings, a PE-backed holding company acquiring commercial trade contractors on the Colorado Front Range.

Crawford Holdings acquisition thesis:
- Entry multiples: 4-5x EBITDA for platform, 2.5-3.5x for bolt-on acquisitions
- Target exit: 7-10x EBITDA after 5-7 years of value creation
- SBA 7(a) underwriting: DSCR must be >= 1.25x (1.5x preferred for conventional)
- PE IRR hurdle: 15-25% target range, 20%+ for deals with execution risk
- Value creation levers: EBITDA growth (organic + bolt-on), multiple expansion (scale premium), debt paydown

You are comparing 2-3 valuation scenarios for the same acquisition target. Analyze them through a buyer's lens.

For the value creation bridge, decompose each scenario's total returns into three components:
1. EBITDA Growth %: Returns attributable to revenue growth + margin improvement
2. Multiple Expansion %: Returns from entry-to-exit multiple arbitrage
3. Debt Paydown %: Returns from principal amortization during hold period
These three should sum to approximately 100% for each scenario.

For downside resilience, model a 20% EBITDA decline and estimate the impact on DSCR and cash flow for each scenario.

Be specific with numbers. Reference actual scenario values in your analysis.`;

// ─────────────────────────────────────────────
// Generation function
// ─────────────────────────────────────────────

interface ComparisonInput {
  companyName: string;
  scenarios: Array<{
    name: string;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
  }>;
}

export async function generateScenarioComparison(input: ComparisonInput) {
  const scenarioDetails = input.scenarios
    .map((s) => {
      const i = s.inputs as Record<string, number>;
      const o = s.outputs as Record<string, Record<string, number>>;

      return `=== ${s.name} ===
KEY INPUTS:
  Entry Multiple: ${i.entry_multiple}x (${i.valuation_method || "ebitda"} method)
  Revenue: $${(i.target_revenue || 0).toLocaleString()}
  EBITDA: $${(i.target_ebitda || 0).toLocaleString()}
  Revenue Growth Rate: ${((i.revenue_growth_rate || 0) * 100).toFixed(1)}%
  Equity: ${((i.equity_pct || 0) * 100).toFixed(0)}%
  Bank Debt: ${((i.bank_debt_pct || 0) * 100).toFixed(0)}% at ${((i.bank_interest_rate || 0) * 100).toFixed(1)}%, ${i.bank_term_years || 0}yr term
  Seller Note: ${((i.seller_note_pct || 0) * 100).toFixed(0)}% at ${((i.seller_note_rate || 0) * 100).toFixed(1)}%, ${i.seller_note_term || 0}yr term
  Exit Year: ${i.exit_year || 0}
  Exit Multiple: ${i.exit_multiple || 0}x (${i.exit_valuation_method || "ebitda"} method)

KEY OUTPUTS:
  Enterprise Value: $${(o?.deal?.enterprise_value || 0).toLocaleString()}
  Equity Check: $${(o?.deal?.equity_check || 0).toLocaleString()}
  Bank Debt: $${(o?.deal?.bank_debt || 0).toLocaleString()}
  Seller Note: $${(o?.deal?.seller_note || 0).toLocaleString()}
  Adjusted EBITDA: $${(o?.cashFlow?.adjusted_ebitda || 0).toLocaleString()}
  DSCR: ${(o?.cashFlow?.dscr === Infinity ? "N/A" : (o?.cashFlow?.dscr || 0).toFixed(2))}x
  Y1 After-Tax CF: $${(o?.cashFlow?.after_tax_cash_flow || 0).toLocaleString()}
  MOIC: ${(o?.exit?.moic || 0).toFixed(2)}x
  IRR: ${o?.exit?.irr != null ? ((o.exit.irr || 0) * 100).toFixed(1) : "N/A"}%
  Exit EV: $${(o?.exit?.exit_ev || 0).toLocaleString()}
  Remaining Debt at Exit: $${(o?.exit?.remaining_debt_at_exit || 0).toLocaleString()}
  Total Return: $${(o?.exit?.total_return || 0).toLocaleString()}`;
    })
    .join("\n\n");

  const userPrompt = `Compare the following valuation scenarios for "${input.companyName}":\n\n${scenarioDetails}\n\nProvide your structured comparison analysis.`;

  return callClaudeStructured<ScenarioComparisonResult>({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 4096,
    outputFormat: COMPARISON_OUTPUT_FORMAT,
  });
}
