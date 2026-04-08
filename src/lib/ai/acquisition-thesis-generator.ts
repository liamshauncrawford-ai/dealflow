/**
 * Acquisition Thesis Generator — AI-powered deal brief for Priority A packages.
 *
 * Generates a structured acquisition thesis explaining why a specific target
 * fits the companion acquisition strategy, including synergies with PMS,
 * key risks, and recommended timeline to LOI.
 */

import { callClaude, safeJsonParse } from "./claude-client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ThesisInput {
  companyName: string;
  city: string | null;
  state: string | null;
  targetRankLabel: string | null;
  revenue: number | null;
  ebitda: number | null;
  askingPrice: number | null;
  employees: number | null;
  yearsInBusiness: number | null;
  acquisitionScore: number | null;
  financialScore: number | null;
  strategicScore: number | null;
  operatorScore: number | null;
  disqualifiers: string[];
  synergyDescription: string | null;
  medianEbitdaMultiple: number | null;
  comparableCount: number;
}

export interface ThesisResult {
  synopsis: string;
  thesis: string;
  keyRisks: string[];
  recommendedTimeline: string;
}

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────

const THESIS_SYSTEM_PROMPT = `You are an M&A advisor preparing a confidential deal brief for an operator-acquirer.

BUYER CONTEXT:
- Liam Crawford, EMBA graduate, acquiring commercial technology services businesses on Colorado's Front Range
- Initial platform: PMS commercial AV division in Sheridan, CO ($28,583/mo operating loss being bridged)
- Strategy: Acquire companion businesses that generate immediate cash flow to fund PMS turnaround
- Buyer strengths: Sales/BD operations, industry relationships, SBA pre-qualified for $1-2M

YOUR TASK:
Generate a structured acquisition thesis for this specific target. Be concrete, not generic.

RESPOND WITH ONLY VALID JSON (no markdown, no code fences):
{
  "synopsis": "1-2 sentence executive summary of why this target fits",
  "thesis": "2-3 paragraphs explaining: (1) why this target type matters for the platform, (2) specific synergies with PMS, (3) how Liam's background fills the operational gap",
  "keyRisks": ["3-5 specific, actionable risk items with brief mitigations"],
  "recommendedTimeline": "Recommended timeline to LOI (e.g., '4-6 weeks')"
}`;

// ─────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────

export async function generateAcquisitionThesis(
  input: ThesisInput,
): Promise<{ result: ThesisResult; inputTokens: number; outputTokens: number }> {
  const details = [
    `Company: ${input.companyName}`,
    input.city || input.state
      ? `Location: ${[input.city, input.state].filter(Boolean).join(", ")}`
      : null,
    input.targetRankLabel ? `Target Type: ${input.targetRankLabel}` : null,
    input.revenue ? `Revenue: $${input.revenue.toLocaleString()}` : null,
    input.ebitda ? `EBITDA: $${input.ebitda.toLocaleString()}` : null,
    input.askingPrice ? `Asking Price: $${input.askingPrice.toLocaleString()}` : null,
    input.employees ? `Employees: ${input.employees}` : null,
    input.yearsInBusiness ? `Years in Business: ${input.yearsInBusiness}` : null,
    input.acquisitionScore != null ? `Acquisition Score: ${input.acquisitionScore}/100` : null,
    input.financialScore != null ? `Financial Score: ${input.financialScore}/40` : null,
    input.strategicScore != null ? `Strategic Score: ${input.strategicScore}/35` : null,
    input.operatorScore != null ? `Operator Score: ${input.operatorScore}/25` : null,
    input.disqualifiers.length > 0
      ? `Disqualifiers: ${input.disqualifiers.join(", ")}`
      : "Disqualifiers: None",
    input.synergyDescription
      ? `Synergy Context: ${input.synergyDescription}`
      : null,
    input.medianEbitdaMultiple != null
      ? `Median BVR EBITDA Multiple (comps): ${input.medianEbitdaMultiple.toFixed(2)}x (${input.comparableCount} comparable transactions)`
      : input.comparableCount > 0
        ? `Comparable Transactions: ${input.comparableCount} (no EBITDA multiples available)`
        : "Comparable Transactions: No BVR comps available for this target type",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await callClaude({
    model: "sonnet4",
    system: THESIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate an acquisition thesis for this target:\n\n${details}`,
      },
    ],
    maxTokens: 2000,
    temperature: 0.3,
  });

  const result = safeJsonParse<ThesisResult>(response.text);

  return {
    result,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
