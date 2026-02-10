"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CookieStatus {
  platform: string;
  isValid: boolean;
  capturedAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

interface ScrapeRun {
  id: string;
  platform: string;
  triggeredBy: string;
  status: string;
  listingsFound: number;
  listingsNew: number;
  listingsUpdated: number;
  errors: number;
  startedAt: string | null;
  completedAt: string | null;
  errorLog: string | null;
  createdAt: string;
}

interface ScrapeSchedule {
  id: string;
  platform: string;
  cronExpression: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

interface ScrapingStatus {
  recentRuns: ScrapeRun[];
  runningRuns: ScrapeRun[];
  schedules: ScrapeSchedule[];
}

export function useScrapingStatus() {
  return useQuery<ScrapingStatus>({
    queryKey: ["scraping-status"],
    queryFn: async () => {
      const res = await fetch("/api/scraping/status");
      if (!res.ok) throw new Error("Failed to fetch scraping status");
      return res.json();
    },
    refetchInterval: 5_000, // Poll every 5s to show live updates during scrapes
  });
}

export function useCookieStatus(platform: string) {
  return useQuery<CookieStatus>({
    queryKey: ["cookie-status", platform],
    queryFn: async () => {
      const res = await fetch(`/api/scraping/cookies/${platform}`);
      if (!res.ok) throw new Error("Failed to fetch cookie status");
      return res.json();
    },
  });
}

export function useSaveCookies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      platform,
      cookies,
    }: {
      platform: string;
      cookies: Array<{ name: string; value: string; domain: string; path: string; expires?: number }>;
    }) => {
      const res = await fetch(`/api/scraping/cookies/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies }),
      });
      if (!res.ok) throw new Error("Failed to save cookies");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cookie-status", variables.platform] });
      queryClient.invalidateQueries({ queryKey: ["scraping-status"] });
    },
  });
}

export function useDeleteCookies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (platform: string) => {
      const res = await fetch(`/api/scraping/cookies/${platform}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete cookies");
      return res.json();
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ["cookie-status", platform] });
      queryClient.invalidateQueries({ queryKey: ["scraping-status"] });
    },
  });
}

export function useTriggerScrape() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (platform?: string) => {
      const res = await fetch("/api/scraping/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(platform ? { platform } : {}),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to trigger scrape");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scraping-status"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      platform: string;
      cronExpression?: string;
      isEnabled?: boolean;
    }) => {
      const res = await fetch("/api/scraping/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update schedule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scraping-status"] });
    },
  });
}
