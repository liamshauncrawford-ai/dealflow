/**
 * Market Pulse & Thesis Drift Monitor — weekly intelligence brief.
 *
 * Aggregates the past 7 days of pipeline changes, news, and score movements,
 * then asks Claude for a strategic assessment of thesis health.
 */

import { callClaude, safeJsonParse } from "./claude-client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface WeeklyDataSnapshot {
  // Pipeline
  totalTargetsTracked: number;
  actionableTargets: number; // compositeScore >= 50
  highScoreTargets: number; // compositeScore >= 70
  newListingsThisWeek: number;
  scoreChanges: Array<{ name: string; from: number; to: number }>;

  // News
  newsThisWeek: Array<{
    headline: string;
    category: string;
    urgency: string;
    impact: string;
  }>;

  // Market
  topTargets: Array<{
    name: string;
    score: number;
    trade: string | null;
    thesisAlignment: string | null;
  }>;
}

export interface WeeklyBriefResult {
  thesis_health: "strong" | "stable" | "caution" | "at_risk";
  thesis_health_reasoning: string;
  market_momentum: "accelerating" | "stable" | "decelerating" | "uncertain";
  key_developments: string[];
  emerging_risks: string[];
  emerging_opportunities: string[];
  recommended_actions_this_week: string[];
  pipeline_assessment: {
    total_targets_tracked: number;
    actionable_targets: number;
    estimated_total_pipeline_value: string;
    pipeline_gap_analysis: string;
  };
  market_metrics: {
    front_range_commercial_permits: string;
    estimated_commercial_services_tam: string;
    new_projects_announced: number;
    market_outlook: string;
  };
  thesis_drift_warnings: string[];
}

// ─────────────────────────────────────────────
// AI Brief Generation
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior M&A advisor monitoring a roll-up acquisition strategy.
The strategy is the Crawford Holdings commercial services acquisition platform — acquiring commercial service contractors across Colorado's Front Range in 11 trade categories: electrical, structured cabling, security/fire alarm, HVAC/mechanical, plumbing, framing/drywall, painting/finishing, concrete/masonry, roofing, site work, and general commercial.

THESIS PARAMETERS:
- Buyer equity: $800K ($300K personal + $500K family office)
- Debt capacity: 70-75% leverage on platform, plus seller financing
- Target platform: $5M-$12M revenue, $900K-$1.75M EBITDA at 4-5x EBITDA
- Bolt-on multiple: 2.5-3.5x EBITDA
- Exit horizon: 7-10 years at 7-10x multiple
- Target exit valuation: $25M+ revenue generating $1M+ distributions
- Buyer available full-time: March 14, 2026
- PMS commercial division closing in ~3 months (existing deal)

Provide an honest, data-driven weekly intelligence brief. Be specific about risks and what the buyer should do this week. If thesis health is deteriorating, say so clearly.`;

export async function generateWeeklyBrief(
  data: WeeklyDataSnapshot,
): Promise<{
  result: WeeklyBriefResult;
  inputTokens: number;
  outputTokens: number;
}> {
  const userPrompt = `Generate the weekly intelligence brief based on this week's data:

PIPELINE STATUS:
- Total targets tracked: ${data.totalTargetsTracked}
- Actionable targets (score >= 50): ${data.actionableTargets}
- High-score targets (score >= 70): ${data.highScoreTargets}
- New listings discovered this week: ${data.newListingsThisWeek}

TOP TARGETS:
${data.topTargets.map((t) => `- ${t.name}: Score ${t.score}, ${t.trade ?? "unknown trade"}, ${t.thesisAlignment ?? "unscored"}`).join("\n")}

SCORE CHANGES THIS WEEK:
${data.scoreChanges.length > 0 ? data.scoreChanges.map((s) => `- ${s.name}: ${s.from} → ${s.to}`).join("\n") : "None"}

NEWS THIS WEEK (${data.newsThisWeek.length} articles):
${data.newsThisWeek.map((n) => `- [${n.category}/${n.urgency}/${n.impact}] ${n.headline}`).join("\n") || "No news articles this week"}

Return your brief as JSON with this structure:
{
  "thesis_health": "strong" | "stable" | "caution" | "at_risk",
  "thesis_health_reasoning": "1-2 sentences explaining the rating",
  "market_momentum": "accelerating" | "stable" | "decelerating" | "uncertain",
  "key_developments": ["top 3-5 developments from this week"],
  "emerging_risks": ["risks to monitor"],
  "emerging_opportunities": ["opportunities to pursue"],
  "recommended_actions_this_week": ["ranked by priority"],
  "pipeline_assessment": {
    "total_targets_tracked": number,
    "actionable_targets": number,
    "estimated_total_pipeline_value": "$X million",
    "pipeline_gap_analysis": "what types of targets are missing"
  },
  "market_metrics": {
    "front_range_commercial_permits": "estimated permit volume/value",
    "estimated_commercial_services_tam": "$X million",
    "new_projects_announced": number,
    "market_outlook": "current outlook for Front Range commercial construction"
  },
  "thesis_drift_warnings": ["if strategy needs adjustment, explain why"]
}`;

  const response = await callClaude({
    model: "sonnet4",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 3000,
  });

  const result = safeJsonParse<WeeklyBriefResult>(response.text);

  return {
    result,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
