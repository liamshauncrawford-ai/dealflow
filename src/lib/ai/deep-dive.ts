/**
 * Target Deep Dive — AI-powered investment memo generator.
 *
 * Sends listing data to Claude and returns a structured acquisition analysis.
 * Results are cached in AIAnalysisResult for re-display without re-calling the API.
 */

import { callClaude, safeJsonParse } from "./claude-client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DeepDiveInput {
  companyName: string;
  /** All available fields serialized for the prompt */
  companyData: string;
  /** Recent activity log entries */
  recentActivity?: string;
  /** Known GC relationships, DC project involvement */
  marketPosition?: string;
}

export interface DeepDiveResult {
  executive_summary: string;
  thesis_fit_assessment: {
    overall_rating: "A" | "B" | "C" | "D" | "F";
    composite_score: number;
    strengths: string[];
    weaknesses: string[];
    strategic_rationale: string;
  };
  preliminary_valuation: {
    estimated_revenue: string;
    estimated_ebitda: string;
    estimated_ebitda_margin: string;
    recommended_multiple_range: string;
    implied_ev_range: string;
    valuation_rationale: string;
    comparable_transactions: string[];
  };
  deal_structure_suggestion: {
    total_ev: string;
    equity_required: string;
    bank_debt: string;
    seller_note: string;
    earnout_component: string | null;
    monthly_debt_service_estimate: string;
    estimated_free_cash_flow_year_1: string;
    debt_service_coverage_ratio: string;
  };
  synergy_analysis: {
    revenue_synergies: string[];
    cost_synergies: string[];
    estimated_annual_synergy_value: string;
    synergy_timeline: string;
  };
  platform_value_creation: {
    how_this_fits_the_platform: string;
    cross_sell_opportunities: string[];
    customer_overlap: string;
    gc_relationship_value: string;
    data_center_pipeline_access: string;
  };
  risk_assessment: {
    key_risks: Array<{
      risk: string;
      severity: "high" | "medium" | "low";
      mitigation: string;
    }>;
    deal_breakers: string[] | null;
    information_gaps: string[];
  };
  recommended_next_steps: string[];
  outreach_strategy: {
    approach: "direct" | "broker" | "mutual_introduction" | "letter_campaign";
    suggested_opening: string;
    timing_considerations: string;
  };
}

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────

const DEEP_DIVE_SYSTEM_PROMPT = `You are a seasoned M&A advisor preparing an investment memo for a search fund entrepreneur evaluating a potential platform acquisition. The buyer is acquiring a structured cabling contractor on Colorado's Front Range to build a platform serving the booming data center construction market.

BUYER PROFILE:
- Available equity: $800K
- Bank debt: 70-75% LTV
- Seller financing: Can request 15-20%
- Comfortable EV range: $3.5M-$9M for platform
- Target EBITDA: $900K-$1.75M
- Post-EMBA, full-time operator starting March 2026
- Already closing PMS commercial division ($1.4M revenue, small deal)
- Plans to bolt on 2-3 additional companies in years 2-4
- Exit horizon: 7-10 years at 7-10x EBITDA

MARKET CONTEXT:
- Colorado has 60-80+ data centers, multiple hyperscale projects under construction
- QTS Aurora: 177MW ($1B+, Holder Construction GC) — largest in state
- CoreSite DE3: 60MW campus (DPR Construction GC) — first purpose-built DC in Denver in 20 years
- Flexential Parker: 22.5MW (new build, 2026)
- Global AI Windsor: Up to 1GW long-term (Phase 1: 18-24MW)
- Xcel Energy has 5.8GW of pending DC applications
- Two competing bills in legislature (incentive vs environmental)
- Key GCs: DPR, Holder, Hensel Phelps, Mortenson, Constructiv

You MUST respond with ONLY valid JSON (no markdown, no code fences) matching this exact schema:
{
  "executive_summary": "3-4 sentence overview",
  "thesis_fit_assessment": {
    "overall_rating": "A"|"B"|"C"|"D"|"F",
    "composite_score": 0-100,
    "strengths": ["..."],
    "weaknesses": ["..."],
    "strategic_rationale": "..."
  },
  "preliminary_valuation": {
    "estimated_revenue": "$XM",
    "estimated_ebitda": "$XK-$XM",
    "estimated_ebitda_margin": "X%",
    "recommended_multiple_range": "X.Xx-X.Xx",
    "implied_ev_range": "$XM-$XM",
    "valuation_rationale": "...",
    "comparable_transactions": ["..."]
  },
  "deal_structure_suggestion": {
    "total_ev": "$XM",
    "equity_required": "$XK",
    "bank_debt": "$XM",
    "seller_note": "$XK",
    "earnout_component": "..." or null,
    "monthly_debt_service_estimate": "$XK",
    "estimated_free_cash_flow_year_1": "$XK",
    "debt_service_coverage_ratio": "X.Xx"
  },
  "synergy_analysis": {
    "revenue_synergies": ["..."],
    "cost_synergies": ["..."],
    "estimated_annual_synergy_value": "$XK",
    "synergy_timeline": "..."
  },
  "platform_value_creation": {
    "how_this_fits_the_platform": "...",
    "cross_sell_opportunities": ["..."],
    "customer_overlap": "...",
    "gc_relationship_value": "...",
    "data_center_pipeline_access": "..."
  },
  "risk_assessment": {
    "key_risks": [{"risk": "...", "severity": "high"|"medium"|"low", "mitigation": "..."}],
    "deal_breakers": ["..."] or null,
    "information_gaps": ["..."]
  },
  "recommended_next_steps": ["..."],
  "outreach_strategy": {
    "approach": "direct"|"broker"|"mutual_introduction"|"letter_campaign",
    "suggested_opening": "1-2 sentences",
    "timing_considerations": "..."
  }
}`;

// ─────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────

export async function runDeepDive(
  input: DeepDiveInput
): Promise<{ result: DeepDiveResult; inputTokens: number; outputTokens: number }> {
  const userPrompt = [
    `Company: ${input.companyName}`,
    `Available Data:\n${input.companyData}`,
    input.recentActivity ? `Recent Activity:\n${input.recentActivity}` : null,
    input.marketPosition ? `Market Position:\n${input.marketPosition}` : null,
    "",
    "Generate the investment memo.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await callClaude({
    model: "sonnet4",
    system: DEEP_DIVE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 4096,
    temperature: 0.3,
  });

  const result = safeJsonParse<DeepDiveResult>(response.text);

  return {
    result,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
