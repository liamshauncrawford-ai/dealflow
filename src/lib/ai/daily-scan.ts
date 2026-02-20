/**
 * Daily Target Discovery Scan — evaluates unscored listings against acquisition thesis.
 *
 * For listings that already have financial data but no AI score,
 * sends a batch to Claude for thesis-aligned evaluation.
 */

import { callClaude, safeJsonParse } from "./claude-client";

export interface ScanTarget {
  id: string;
  businessName: string | null;
  title: string;
  primaryTrade: string | null;
  secondaryTrades: string[];
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  askingPrice: number | null;
  city: string | null;
  state: string | null;
  established: number | null;
  certifications: string[];
  dcCertifications: string[];
  description: string | null;
  fitScore: number | null;
}

export interface ScanEvaluation {
  id: string;
  composite_score: number;
  thesis_alignment: "strong" | "moderate" | "weak" | "disqualified";
  recommended_action: "pursue_immediately" | "research_further" | "monitor" | "pass";
  key_strengths: string[];
  key_risks: string[];
  reasoning: string;
  research_questions: string[];
}

const SYSTEM_PROMPT = `You are a senior M&A analyst evaluating acquisition targets for a structured cabling / low-voltage contractor roll-up on Colorado's Front Range. The buyer is building a data center services platform.

THESIS PARAMETERS:
- Target platform: $5M-$12M revenue electrical/cabling contractor
- Target bolt-ons: $2M-$5M revenue in complementary trades
- Geography: Colorado Front Range (Denver metro, Colorado Springs, Northern CO)
- Key trades: Structured cabling, low-voltage, electrical, fire alarm, security, BAS
- Premium for: BICSI certs, data center experience, GC relationships (DPR, Holder, Hensel Phelps)
- Owner age 55+ preferred (succession opportunity)
- Entry multiple: 3-5x EBITDA

SCORING CRITERIA (weight in parentheses):
1. Owner Age / Retirement Likelihood (15%)
2. Trade Fit — structured cabling/electrical (15%)
3. Revenue Size — $2M-$12M sweet spot (10%)
4. Years in Business — 10+ years (10%)
5. Geographic Fit — CO Front Range (10%)
6. Recurring Revenue Potential (10%)
7. Cross-sell Synergy with Platform (10%)
8. Key Person Risk (5%)
9. Certifications & Moats — BICSI, NICET (5%)
10. Valuation Fit — 3-5x EBITDA (5%)

For each company, return JSON in an array. Score 0-100 composite.`;

export async function evaluateTargets(
  targets: ScanTarget[],
): Promise<{ evaluations: ScanEvaluation[]; inputTokens: number; outputTokens: number }> {
  const targetDescriptions = targets.map((t) => ({
    id: t.id,
    name: t.businessName || t.title,
    trade: t.primaryTrade,
    secondary_trades: t.secondaryTrades,
    revenue: t.revenue,
    ebitda: t.ebitda || t.sde,
    asking_price: t.askingPrice,
    city: t.city,
    state: t.state,
    established: t.established,
    certifications: [...t.certifications, ...t.dcCertifications],
    description: t.description?.slice(0, 300),
    existing_fit_score: t.fitScore,
  }));

  const userPrompt = `Evaluate these ${targets.length} companies as acquisition targets. Return a JSON array with one evaluation per company.

Each evaluation must have:
{
  "id": "<company id from input>",
  "composite_score": <number 0-100>,
  "thesis_alignment": "strong" | "moderate" | "weak" | "disqualified",
  "recommended_action": "pursue_immediately" | "research_further" | "monitor" | "pass",
  "key_strengths": ["strength 1", "strength 2"],
  "key_risks": ["risk 1", "risk 2"],
  "reasoning": "2-3 sentence explanation",
  "research_questions": ["what we need to find out"]
}

Companies to evaluate:
${JSON.stringify(targetDescriptions, null, 2)}`;

  const response = await callClaude({
    model: "sonnet4",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 4000,
  });

  const evaluations = safeJsonParse<ScanEvaluation[]>(response.text);

  return {
    evaluations: Array.isArray(evaluations) ? evaluations : [],
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
