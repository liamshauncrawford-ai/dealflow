"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface DedupListing {
  id: string;
  title: string;
  businessName: string | null;
  askingPrice: string | null;
  revenue: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  sources: Array<{
    platform: string;
    sourceUrl: string;
  }>;
}

interface EnrichedDedupCandidate {
  id: string;
  listingAId: string;
  listingBId: string;
  overallScore: number;
  nameScore: number | null;
  locationScore: number | null;
  priceScore: number | null;
  revenueScore: number | null;
  descriptionScore: number | null;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  listingA: DedupListing | null;
  listingB: DedupListing | null;
}

interface DedupCandidatesResponse {
  candidates: EnrichedDedupCandidate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DedupRunResult {
  candidatesFound: number;
  groupsCreated: number;
  errors: string[];
}

export function useDedupCandidates(params?: { status?: string; page?: number }) {
  const status = params?.status;
  const page = params?.page ?? 1;

  return useQuery<DedupCandidatesResponse>({
    queryKey: ["dedup-candidates", status, page],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (status) searchParams.set("status", status);
      searchParams.set("page", String(page));

      const response = await fetch(`/api/dedup?${searchParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch dedup candidates");
      return response.json();
    },
  });
}

export function useRunDedup() {
  const queryClient = useQueryClient();

  return useMutation<DedupRunResult>({
    mutationFn: async () => {
      const response = await fetch("/api/dedup", { method: "POST" });
      if (!response.ok) throw new Error("Failed to run deduplication");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dedup-candidates"] });
    },
  });
}

export function useResolveDedupCandidate() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; action: string },
    Error,
    { candidateId: string; action: "merge" | "reject"; primaryId?: string }
  >({
    mutationFn: async ({ candidateId, action, primaryId }) => {
      const response = await fetch(`/api/dedup/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, primaryId }),
      });
      if (!response.ok) throw new Error("Failed to resolve candidate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dedup-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
