"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Query: Fetch all financial periods for an opportunity
// ─────────────────────────────────────────────

export function useFinancialPeriods(opportunityId: string | null) {
  return useQuery({
    queryKey: ["financials", opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];
      const res = await fetch(`/api/pipeline/${opportunityId}/financials`);
      if (!res.ok) throw new Error("Failed to fetch financial periods");
      return res.json();
    },
    enabled: !!opportunityId,
  });
}

// ─────────────────────────────────────────────
// Mutation: Create financial period
// ─────────────────────────────────────────────

export function useCreateFinancialPeriod(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/financials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create financial period");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Financial period created");
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Update financial period
// ─────────────────────────────────────────────

export function useUpdateFinancialPeriod(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, data }: { periodId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/financials/${periodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update financial period");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Financial period updated");
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Clear ALL financial periods for an opportunity
// ─────────────────────────────────────────────

export function useClearAllFinancials(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pipeline/${opportunityId}/financials`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to clear financial periods");
      }
      return res.json();
    },
    onSuccess: (data: { deleted: number }) => {
      toast.success(`Cleared ${data.deleted} financial period${data.deleted !== 1 ? "s" : ""}`);
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["valuation-scenarios", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Delete financial period
// ─────────────────────────────────────────────

export function useDeleteFinancialPeriod(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (periodId: string) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/financials/${periodId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete financial period");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Financial period deleted");
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Add line item(s)
// ─────────────────────────────────────────────

export function useAddLineItem(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, data }: { periodId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/financials/${periodId}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add line item");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Line item added");
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Update line item
// ─────────────────────────────────────────────

export function useUpdateLineItem(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, itemId, data }: { periodId: string; itemId: string; data: Record<string, unknown> }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/financials/${periodId}/line-items?itemId=${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update line item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Delete line item
// ─────────────────────────────────────────────

export function useDeleteLineItem(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, itemId }: { periodId: string; itemId: string }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/financials/${periodId}/line-items?itemId=${itemId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete line item");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Line item removed");
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Add add-back
// ─────────────────────────────────────────────

export function useAddAddBack(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, data }: { periodId: string; data: Record<string, unknown> }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/financials/${periodId}/add-backs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add add-back");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Add-back created");
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Update add-back
// ─────────────────────────────────────────────

export function useUpdateAddBack(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, addBackId, data }: { periodId: string; addBackId: string; data: Record<string, unknown> }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/financials/${periodId}/add-backs?addBackId=${addBackId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update add-back");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Delete add-back
// ─────────────────────────────────────────────

export function useDeleteAddBack(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, addBackId }: { periodId: string; addBackId: string }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/financials/${periodId}/add-backs?addBackId=${addBackId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete add-back");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Add-back removed");
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Update total add-backs (single number)
// ─────────────────────────────────────────────

export function useUpdateTotalAddBacks(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, total }: { periodId: string; total: number }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/financials/${periodId}/total-add-backs`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ total }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update total add-backs");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: AI Analyze financials
// ─────────────────────────────────────────────

export function useAnalyzeFinancials(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/financials/analyze`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to analyze financials");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Financial analysis complete");
      queryClient.invalidateQueries({ queryKey: ["financials", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Compute DSCR (no database)
// ─────────────────────────────────────────────

export function useComputeDSCR(opportunityId: string) {
  return useMutation({
    mutationFn: async (data: {
      cashFlow: number;
      purchasePrice: number;
      equityInjectionPct: number;
      interestRate: number;
      termYears: number;
      managementSalary?: number;
      capexReserve?: number;
    }) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/financials/dscr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to compute DSCR");
      }
      return res.json();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
