/**
 * Meeting Notes Extractor
 *
 * Takes raw meeting notes and produces structured insights using Claude.
 * Part of the Notes -> AI Integration workstream (Task 9).
 */

import { callClaude } from "@/lib/ai/claude-client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ExtractionResult {
  extractedContent: string;
  inputTokens: number;
  outputTokens: number;
}

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an M&A analyst extracting structured insights from meeting notes for a commercial services acquisition on Colorado's Front Range.

Given raw meeting notes, extract:
1. KEY FACTS: Important new information learned (financials, operations, personnel, licensing, etc.)
2. ACTION ITEMS: Follow-up tasks with deadlines if mentioned
3. RED FLAGS: Concerns, risks, or negative signals
4. POSITIVE SIGNALS: Encouraging indicators for the deal
5. UPDATED DEAL ASSESSMENT: How do these findings change the overall attractiveness?
6. QUESTIONS TO FOLLOW UP: What wasn't answered or needs deeper investigation?

Format as clean markdown with headers for each section. Be thorough but concise.`;

// ─────────────────────────────────────────────
// Extraction function
// ─────────────────────────────────────────────

export async function extractMeetingNotes(
  rawNotes: string,
  opportunityTitle: string,
  existingContext?: string,
): Promise<ExtractionResult> {
  let userPrompt = `## Opportunity: ${opportunityTitle}\n\n## Raw Meeting Notes\n${rawNotes}`;

  if (existingContext) {
    userPrompt += `\n\n## Existing Context\nHere is context from previous notes and research on this opportunity:\n${existingContext}`;
  }

  const response = await callClaude({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 4096,
    temperature: 0,
  });

  return {
    extractedContent: response.text,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
