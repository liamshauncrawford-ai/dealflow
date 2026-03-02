/**
 * Weekly Intelligence Brief Generator — produces a strategic M&A market briefing.
 *
 * Aggregates pipeline, listing, and scoring data from the past week,
 * then asks Claude for a comprehensive intelligence brief.
 */

import { callClaude, safeJsonParse } from "./claude-client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface WeeklyBriefInput {
  pipelineSummary: string;
  listingActivity: string;
  thesisConfig: string;
  scoreDistribution: string;
}

export interface WeeklyBriefResult {
  thesisHealth: string;
  marketMomentum: string;
  keyDevelopments: string[];
  recommendedActions: string[];
  pipelineMetrics: Record<string, unknown>;
  marketMetrics: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
}

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a strategic M&A intelligence analyst producing a weekly market briefing for Crawford Holdings — a PE-backed acquisition platform targeting commercial service contractors across Colorado's Front Range in 11 trade categories.

Generate a comprehensive weekly intelligence brief covering:
1. THESIS HEALTH: Overall assessment (strong/moderate/weak) with reasoning
2. MARKET MOMENTUM: Direction (accelerating/stable/decelerating) based on deal flow
3. KEY DEVELOPMENTS: 3-5 bullets on notable market events, new targets, or pipeline changes
4. RECOMMENDED ACTIONS: 3-5 prioritized action items for the coming week
5. PIPELINE METRICS: Summary of pipeline health, stalled deals, velocity
6. MARKET METRICS: Summary of market conditions, listing volume, score distribution

Return valid JSON with this structure:
{
  "thesisHealth": "strong" | "moderate" | "weak",
  "marketMomentum": "accelerating" | "stable" | "decelerating",
  "keyDevelopments": ["string"],
  "recommendedActions": ["string"],
  "pipelineMetrics": { "summary": "string", "totalValue": number, "activeDeals": number, "stalledDeals": number },
  "marketMetrics": { "summary": "string", "newListings": number, "avgScore": number, "topTrade": "string" }
}`;

// ─────────────────────────────────────────────
// Generator function
// ─────────────────────────────────────────────

export async function generateWeeklyBrief(
  input: WeeklyBriefInput,
): Promise<WeeklyBriefResult> {
  const userPrompt = `Generate the weekly intelligence brief based on this data:

PIPELINE SUMMARY:
${input.pipelineSummary}

LISTING ACTIVITY (Last 7 Days):
${input.listingActivity}

THESIS CONFIGURATION:
${input.thesisConfig}

SCORE DISTRIBUTION:
${input.scoreDistribution}

Return your analysis as JSON matching the specified structure.`;

  const response = await callClaude({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 2048,
    temperature: 0,
  });

  const parsed = safeJsonParse<{
    thesisHealth: string;
    marketMomentum: string;
    keyDevelopments: string[];
    recommendedActions: string[];
    pipelineMetrics: Record<string, unknown>;
    marketMetrics: Record<string, unknown>;
  }>(response.text);

  return {
    thesisHealth: parsed.thesisHealth,
    marketMomentum: parsed.marketMomentum,
    keyDevelopments: parsed.keyDevelopments ?? [],
    recommendedActions: parsed.recommendedActions ?? [],
    pipelineMetrics: parsed.pipelineMetrics ?? {},
    marketMetrics: parsed.marketMetrics ?? {},
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
