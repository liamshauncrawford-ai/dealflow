/**
 * Company Enrichment Agent — AI-powered preliminary intelligence dossier.
 *
 * Takes existing listing data and asks Claude to analyze, estimate,
 * and fill in gaps based on public data patterns. In Phase 5, actual
 * scraper data (CSOS, DORA, BBB, Google Places) will feed in here too.
 */

import { callClaude, safeJsonParse } from "./claude-client";

export interface EnrichmentInput {
  companyName: string;
  companyData: string;
}

export interface EnrichmentResult {
  company_summary: string;
  estimated_founding_year: number | null;
  estimated_owner_age_range: string | null;
  estimated_employee_count: number | null;
  estimated_revenue_range: string;
  owner_names: Array<{
    name: string;
    title: string;
    estimated_age: string;
  }>;
  license_status: "active" | "expired" | "unknown";
  license_types: string[];
  reputation_score: number;
  red_flags: string[];
  positive_signals: string[];
  succession_risk: "high" | "medium" | "low" | "unknown";
  data_center_relevance: "confirmed" | "likely" | "possible" | "unlikely";
  enrichment_confidence: "high" | "medium" | "low";
}

const ENRICHMENT_SYSTEM_PROMPT = `You are a due diligence research analyst specializing in Colorado trade contractors. Given available data about a contractor, compile a preliminary intelligence dossier.

Focus on:
- Ownership structure and key person identification
- Age of business and likely owner age (infer from formation date, industry patterns)
- Size indicators (employee count, review volume, office size)
- Reputation and quality signals
- Any red flags (complaints, license issues, lawsuits)
- Estimated revenue range (based on employee count, trade, Colorado market)
- Data center market relevance

IMPORTANT: Base estimates on Colorado market data:
- Structured cabling contractors with 10-30 employees typically do $2M-$6M revenue
- Electrical contractors are larger, typically $5M-$15M
- Security/BAS companies are mid-range, $2M-$8M
- Companies founded 15+ years ago often have owners approaching retirement age

Return ONLY valid JSON (no markdown, no code fences):
{
  "company_summary": "2-3 sentence overview",
  "estimated_founding_year": number or null,
  "estimated_owner_age_range": "55-65" or null,
  "estimated_employee_count": number or null,
  "estimated_revenue_range": "$XM-$XM",
  "owner_names": [{"name": "...", "title": "...", "estimated_age": "..."}],
  "license_status": "active"|"expired"|"unknown",
  "license_types": ["Electrical Contractor", ...],
  "reputation_score": 1-10,
  "red_flags": ["..."],
  "positive_signals": ["..."],
  "succession_risk": "high"|"medium"|"low"|"unknown",
  "data_center_relevance": "confirmed"|"likely"|"possible"|"unlikely",
  "enrichment_confidence": "high"|"medium"|"low"
}`;

export async function runEnrichment(
  input: EnrichmentInput
): Promise<{
  result: EnrichmentResult;
  inputTokens: number;
  outputTokens: number;
}> {
  const response = await callClaude({
    model: "sonnet4",
    system: ENRICHMENT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Company: ${input.companyName}\n\nAvailable Data:\n${input.companyData}\n\nCompile the intelligence dossier.`,
      },
    ],
    maxTokens: 2048,
    temperature: 0.2,
  });

  const result = safeJsonParse<EnrichmentResult>(response.text);

  return {
    result,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
