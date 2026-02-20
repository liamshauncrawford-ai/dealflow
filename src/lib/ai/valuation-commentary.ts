import { callClaude, safeJsonParse } from "./claude-client";

const SYSTEM_PROMPT = `You are a seasoned M&A advisor specializing in lower-middle-market acquisitions of specialty trade contractors, particularly electrical, structured cabling, and data center services companies in the Colorado Front Range.

You are reviewing a financial model for a potential acquisition. The buyer is building a data center services platform through a roll-up strategy — buying at 3-5x EBITDA and building toward an 8-10x exit multiple through scale, cross-sell, and multiple arbitrage.

Provide a candid, practical assessment. Be specific about risks and opportunities. Reference the actual numbers from the model.`;

export interface ValuationCommentaryInput {
  companyName: string;
  modelOutputs: {
    enterprise_value: number;
    equity_check: number;
    bank_debt: number;
    seller_note: number;
    entry_multiple: number;
    exit_multiple: number;
    exit_year: number;
    adjusted_ebitda: number;
    dscr: number;
    after_tax_cash_flow: number;
    moic: number;
    irr: number | null;
    revenue: number;
    revenue_growth_rate: number;
    ebitda_margin: number;
  };
}

export interface ValuationCommentary {
  deal_rating: "A" | "B" | "C" | "D" | "F";
  key_insight: string;
  risk_adjusted_assessment: string;
  comparable_context: string;
  structure_optimization: string;
  negotiation_leverage_points: string[];
  sensitivity_warnings: string[];
  recommendation: string;
}

export async function generateValuationCommentary(
  input: ValuationCommentaryInput,
): Promise<{ result: ValuationCommentary; inputTokens: number; outputTokens: number }> {
  const m = input.modelOutputs;

  const userPrompt = `Analyze this acquisition model for "${input.companyName}":

DEAL STRUCTURE:
- Enterprise Value: $${(m.enterprise_value / 1000).toFixed(0)}K at ${m.entry_multiple}x EBITDA
- Equity Check: $${(m.equity_check / 1000).toFixed(0)}K
- Bank Debt: $${(m.bank_debt / 1000).toFixed(0)}K
- Seller Note: $${(m.seller_note / 1000).toFixed(0)}K

OPERATING METRICS:
- Revenue: $${(m.revenue / 1000).toFixed(0)}K
- EBITDA Margin: ${(m.ebitda_margin * 100).toFixed(1)}%
- Revenue Growth Assumption: ${(m.revenue_growth_rate * 100).toFixed(1)}%
- Adjusted EBITDA (after buyer salary): $${(m.adjusted_ebitda / 1000).toFixed(0)}K
- After-tax Cash Flow Y1: $${(m.after_tax_cash_flow / 1000).toFixed(0)}K
- DSCR: ${m.dscr.toFixed(2)}x

RETURN METRICS:
- Exit @ Year ${m.exit_year} at ${m.exit_multiple}x
- MOIC: ${m.moic.toFixed(1)}x
- IRR: ${m.irr != null ? (m.irr * 100).toFixed(1) + "%" : "N/A"}

Provide your analysis as JSON with this exact structure:
{
  "deal_rating": "A" | "B" | "C" | "D" | "F",
  "key_insight": "most important thing about this deal in 1-2 sentences",
  "risk_adjusted_assessment": "honest assessment of risk vs reward, 2-3 sentences",
  "comparable_context": "how this compares to typical trade contractor acquisitions, 2-3 sentences",
  "structure_optimization": "specific suggestions to improve the deal structure, 2-3 sentences",
  "negotiation_leverage_points": ["point 1", "point 2", "point 3"],
  "sensitivity_warnings": ["what assumptions this is most sensitive to"],
  "recommendation": "clear action recommendation in 1-2 sentences"
}`;

  const response = await callClaude({
    model: "sonnet4",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 1500,
  });

  const result = safeJsonParse<ValuationCommentary>(response.text);

  return {
    result,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
