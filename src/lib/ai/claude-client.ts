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

export type ModelChoice = "haiku" | "sonnet";

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
  haiku: "claude-haiku-4-5-20250901",
  sonnet: "claude-sonnet-4-5-20250514",
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
 * Handles cases where Claude wraps JSON in markdown code fences.
 */
export function safeJsonParse<T>(text: string): T {
  // Strip markdown code fences if present
  let cleaned = text.trim();

  // Match ```json ... ``` or ``` ... ```
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  return JSON.parse(cleaned) as T;
}

// ─────────────────────────────────────────────
// Cost estimation (for logging only)
// ─────────────────────────────────────────────

const COST_PER_MILLION: Record<ModelChoice, { input: number; output: number }> = {
  haiku: { input: 1.0, output: 5.0 },
  sonnet: { input: 3.0, output: 15.0 },
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
