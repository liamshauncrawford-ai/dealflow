/**
 * Core Claude API client for DealFlow AI features.
 *
 * Provides a single reusable `callClaude()` function that every AI module uses.
 * Handles model selection, retries, and JSON response parsing.
 */

import Anthropic from "@anthropic-ai/sdk";

// ─────────────────────────────────────────────
// Client singleton
// ─────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ModelChoice = "haiku" | "sonnet" | "sonnet4";

export interface ClaudeCallParams {
  model: ModelChoice;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

// ─────────────────────────────────────────────
// Model mapping
// ─────────────────────────────────────────────

const MODEL_MAP: Record<ModelChoice, string> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-5",
  sonnet4: "claude-sonnet-4-20250514",  // Per architecture doc — use for background agents
};

// ─────────────────────────────────────────────
// Core call function with retry
// ─────────────────────────────────────────────

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

export async function callClaude(params: ClaudeCallParams): Promise<ClaudeResponse> {
  const client = getClient();
  const modelId = MODEL_MAP[params.model];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: modelId,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0,
        system: params.system,
        messages: params.messages,
      });

      // Extract text from content blocks
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const result: ClaudeResponse = {
        text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };

      // Log usage for cost tracking
      console.log(
        `[AI] ${params.model} (${modelId}) | ` +
          `${result.inputTokens} in / ${result.outputTokens} out | ` +
          `cost ~$${estimateCost(params.model, result.inputTokens, result.outputTokens)}`
      );

      return result;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Determine if retryable
      const status = (err as { status?: number })?.status;
      const isRetryable = status === 429 || (status !== undefined && status >= 500);

      if (!isRetryable || attempt === MAX_RETRIES) {
        break;
      }

      // Exponential backoff with jitter
      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(`[AI] Retry ${attempt + 1}/${MAX_RETRIES} after ${Math.round(delay)}ms (status: ${status})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error("Claude API call failed");
}

// ─────────────────────────────────────────────
// JSON parsing helper
// ─────────────────────────────────────────────

/**
 * Safely parse JSON from Claude's response text.
 *
 * Uses a progressive extraction strategy because Claude sometimes wraps
 * JSON in markdown code fences, prefixes it with explanation text, or
 * appends notes after the closing brace — even when told "respond ONLY
 * with JSON."
 *
 * Strategy order:
 *   1. Direct JSON.parse (cleanest case — response is pure JSON)
 *   2. Extract from ```json ... ``` code fence anywhere in the text
 *   3. Find the outermost { ... } or [ ... ] in the text
 */
export function safeJsonParse<T>(text: string): T {
  const trimmed = text.trim();

  // ── Strategy 1: Direct parse (pure JSON response) ──
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Not pure JSON — try extraction strategies
  }

  // ── Strategy 2: Extract from markdown code fence anywhere in text ──
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // Code fence content isn't valid JSON either — continue
    }
  }

  // ── Strategy 3: Find outermost { ... } or [ ... ] ──
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");

  // Pick whichever delimiter comes first (ignoring -1 = not found)
  let startChar: "{" | "[" | null = null;
  let endChar: "}" | "]" | null = null;
  let startIdx = -1;

  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    startChar = "{";
    endChar = "}";
    startIdx = firstBrace;
  } else if (firstBracket >= 0) {
    startChar = "[";
    endChar = "]";
    startIdx = firstBracket;
  }

  if (startChar && endChar && startIdx >= 0) {
    // Walk from the end to find the matching closing bracket
    const lastEnd = trimmed.lastIndexOf(endChar);
    if (lastEnd > startIdx) {
      try {
        return JSON.parse(trimmed.slice(startIdx, lastEnd + 1)) as T;
      } catch {
        // Extracted slice isn't valid JSON — fall through to error
      }
    }
  }

  // ── All strategies failed — throw with context ──
  // Include the first 200 chars of the response so error logs reveal the format
  const preview = trimmed.length > 200 ? trimmed.slice(0, 200) + "…" : trimmed;
  throw new SyntaxError(
    `Could not extract valid JSON from AI response. Preview: ${preview}`
  );
}

// ─────────────────────────────────────────────
// Cost estimation (for logging only)
// ─────────────────────────────────────────────

const COST_PER_MILLION: Record<ModelChoice, { input: number; output: number }> = {
  haiku: { input: 1.0, output: 5.0 },
  sonnet: { input: 3.0, output: 15.0 },
  sonnet4: { input: 3.0, output: 15.0 },
};

function estimateCost(model: ModelChoice, inputTokens: number, outputTokens: number): string {
  const rates = COST_PER_MILLION[model];
  const cost = (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
  return cost.toFixed(4);
}

// ─────────────────────────────────────────────
// Feature flag check
// ─────────────────────────────────────────────

/**
 * Returns true if the Anthropic API key is configured.
 * Used by UI components to conditionally show AI features.
 */
export function isAIEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
