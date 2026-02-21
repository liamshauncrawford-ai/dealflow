"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ValuationScenario {
  id: string;
  opportunityId: string | null;
  listingId: string | null;
  modelName: string | null;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  aiCommentary: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// Query: Fetch all valuation scenarios for an opportunity
// ─────────────────────────────────────────────

export function useValuationScenarios(opportunityId: string | null) {
  return useQuery<ValuationScenario[]>({
    queryKey: ["valuation-scenarios", opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];
      const res = await fetch(`/api/pipeline/${opportunityId}/valuation`);
      if (!res.ok) throw new Error("Failed to fetch valuation scenarios");
      const data = await res.json();
      return data.scenarios ?? [];
    },
    enabled: !!opportunityId,
  });
}

// ─────────────────────────────────────────────
// Mutation: Create scenario
// ─────────────────────────────────────────────

export function useCreateValuationScenario(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      modelName?: string;
      inputs: Record<string, unknown>;
      outputs: Record<string, unknown>;
      aiCommentary?: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/valuation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create scenario");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Valuation scenario saved");
      queryClient.invalidateQueries({ queryKey: ["valuation-scenarios", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Update scenario
// ─────────────────────────────────────────────

export function useUpdateValuationScenario(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      scenarioId: string;
      modelName?: string;
      inputs?: Record<string, unknown>;
      outputs?: Record<string, unknown>;
      aiCommentary?: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/valuation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update scenario");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["valuation-scenarios", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Delete scenario
// ─────────────────────────────────────────────

export function useDeleteValuationScenario(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scenarioId: string) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/valuation?scenarioId=${scenarioId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete scenario");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Scenario deleted");
      queryClient.invalidateQueries({ queryKey: ["valuation-scenarios", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
