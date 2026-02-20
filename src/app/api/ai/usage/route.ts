import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ADMIN_API_KEY = process.env.ANTHROPIC_ADMIN_API_KEY;
const ANTHROPIC_API_BASE = "https://api.anthropic.com";

/**
 * Simple in-memory cache to avoid hammering the Anthropic Admin API.
 * TTL: 5 minutes.
 */
let cachedResult: { data: AnthropicUsageResponse; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ─────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────

interface AnthropicUsageResponse {
  source: "anthropic" | "local";
  period: string;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  costByModel: Record<string, { input: number; output: number; cost: number }>;
  dailyCosts: Array<{ date: string; cost: number }>;
}

// ─────────────────────────────────────────────
// Anthropic Admin API fetcher
// ─────────────────────────────────────────────

async function fetchAnthropicUsage(): Promise<AnthropicUsageResponse> {
  if (!ADMIN_API_KEY) {
    throw new Error("ANTHROPIC_ADMIN_API_KEY not configured");
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startingAt = thirtyDaysAgo.toISOString().split("T")[0] + "T00:00:00Z";
  const endingAt = now.toISOString().split("T")[0] + "T23:59:59Z";

  // Fetch usage data (token counts) grouped by model, daily buckets
  const usageParams = new URLSearchParams({
    starting_at: startingAt,
    ending_at: endingAt,
    bucket_width: "1d",
    "group_by[]": "model",
  });

  const usageRes = await fetch(
    `${ANTHROPIC_API_BASE}/v1/organizations/usage_report/messages?${usageParams}`,
    {
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": ADMIN_API_KEY,
      },
    },
  );

  if (!usageRes.ok) {
    const errText = await usageRes.text().catch(() => "Unknown error");
    throw new Error(`Anthropic Usage API error (${usageRes.status}): ${errText}`);
  }

  const usageData = await usageRes.json();

  // Fetch cost data
  const costParams = new URLSearchParams({
    starting_at: startingAt,
    ending_at: endingAt,
    bucket_width: "1d",
  });

  const costRes = await fetch(
    `${ANTHROPIC_API_BASE}/v1/organizations/cost_report?${costParams}`,
    {
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": ADMIN_API_KEY,
      },
    },
  );

  if (!costRes.ok) {
    const errText = await costRes.text().catch(() => "Unknown error");
    throw new Error(`Anthropic Cost API error (${costRes.status}): ${errText}`);
  }

  const costData = await costRes.json();

  // Aggregate usage by model
  const costByModel: Record<string, { input: number; output: number; cost: number }> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  if (usageData?.data) {
    for (const bucket of usageData.data) {
      const model = bucket.model || "unknown";
      const input = (bucket.input_tokens || 0) + (bucket.input_cached_tokens || 0);
      const output = bucket.output_tokens || 0;
      totalInputTokens += input;
      totalOutputTokens += output;

      if (!costByModel[model]) {
        costByModel[model] = { input: 0, output: 0, cost: 0 };
      }
      costByModel[model].input += input;
      costByModel[model].output += output;
    }
  }

  // Aggregate costs — Anthropic reports in cents as strings
  let totalCostUsd = 0;
  const dailyCosts: Array<{ date: string; cost: number }> = [];

  if (costData?.data) {
    for (const bucket of costData.data) {
      const costCents = parseFloat(bucket.cost_cents || bucket.cost || "0");
      const costUsd = costCents / 100;
      totalCostUsd += costUsd;

      if (bucket.bucket_start_time) {
        const date = bucket.bucket_start_time.split("T")[0];
        const existing = dailyCosts.find((d) => d.date === date);
        if (existing) {
          existing.cost += costUsd;
        } else {
          dailyCosts.push({ date, cost: costUsd });
        }
      }

      // Also attribute costs to models if model info is available
      if (bucket.model && costByModel[bucket.model]) {
        costByModel[bucket.model].cost += costUsd;
      }
    }
  }

  return {
    source: "anthropic",
    period: `${startingAt.split("T")[0]} to ${endingAt.split("T")[0]}`,
    totalCostUsd,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    costByModel,
    dailyCosts: dailyCosts.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ─────────────────────────────────────────────
// Local fallback from AIAgentRun table
// ─────────────────────────────────────────────

async function fetchLocalUsage(): Promise<AnthropicUsageResponse> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const aggregation = await prisma.aIAgentRun.aggregate({
    where: { startedAt: { gte: thirtyDaysAgo } },
    _sum: { totalTokens: true, totalCost: true },
  });

  // Group by agent name for a rough "model" breakdown
  const byAgent = await prisma.aIAgentRun.groupBy({
    by: ["agentName"],
    where: { startedAt: { gte: thirtyDaysAgo } },
    _sum: { totalTokens: true, totalCost: true },
  });

  const costByModel: Record<string, { input: number; output: number; cost: number }> = {};
  for (const group of byAgent) {
    costByModel[group.agentName] = {
      input: 0,
      output: 0,
      cost: group._sum.totalCost ?? 0,
    };
  }

  return {
    source: "local",
    period: "Last 30 days (estimated from agent runs)",
    totalCostUsd: aggregation._sum.totalCost ?? 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: aggregation._sum.totalTokens ?? 0,
    costByModel,
    dailyCosts: [],
  };
}

// ─────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────

/**
 * GET /api/ai/usage
 *
 * Returns Anthropic API usage and cost data for the last 30 days.
 * Uses the Anthropic Admin API if ANTHROPIC_ADMIN_API_KEY is set,
 * otherwise falls back to local AIAgentRun aggregation.
 */
export async function GET() {
  try {
    // Check cache first
    if (cachedResult && Date.now() < cachedResult.expiresAt) {
      return NextResponse.json(cachedResult.data);
    }

    let result: AnthropicUsageResponse;

    if (ADMIN_API_KEY) {
      try {
        result = await fetchAnthropicUsage();
      } catch (err) {
        console.warn("[AI Usage] Anthropic Admin API failed, falling back to local:", err);
        result = await fetchLocalUsage();
      }
    } else {
      result = await fetchLocalUsage();
    }

    // Cache the result
    cachedResult = {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching AI usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 },
    );
  }
}
