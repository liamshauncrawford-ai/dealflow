"use client";

import { useQuery } from "@tanstack/react-query";

export interface AnthropicUsageData {
  source: "anthropic" | "local";
  period: string;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  costByModel: Record<string, { input: number; output: number; cost: number }>;
  dailyCosts: Array<{ date: string; cost: number }>;
}

/**
 * Fetches real-time API usage and cost data.
 * Uses Anthropic Admin API when configured, otherwise local estimates.
 * Refreshes every 5 minutes.
 */
export function useAnthropicUsage() {
  return useQuery<AnthropicUsageData>({
    queryKey: ["anthropic-usage"],
    queryFn: async () => {
      const res = await fetch("/api/ai/usage");
      if (!res.ok) throw new Error("Failed to fetch usage data");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 4 * 60 * 1000, // 4 minutes
  });
}
