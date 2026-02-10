"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PipelineResponse } from "@/types/pipeline";

export function usePipeline(stage?: string) {
  const searchParams = new URLSearchParams();
  if (stage) searchParams.set("stage", stage);

  return useQuery<PipelineResponse>({
    queryKey: ["pipeline", stage],
    queryFn: async () => {
      const res = await fetch(`/api/pipeline?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch pipeline");
      return res.json();
    },
  });
}

export function useOpportunity(id: string | null) {
  return useQuery({
    queryKey: ["opportunity", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/pipeline/${id}`);
      if (!res.ok) throw new Error("Failed to fetch opportunity");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdateOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/pipeline/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update opportunity");
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Deal updated");
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Failed to update deal");
    },
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create opportunity");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Deal created");
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Failed to create deal");
    },
  });
}

export function useDeleteOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pipeline/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete opportunity");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Deal deleted");
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Failed to delete deal");
    },
  });
}

export function useAddNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ opportunityId, content }: { opportunityId: string; content: string }) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Note added");
      queryClient.invalidateQueries({ queryKey: ["opportunity", variables.opportunityId] });
    },
    onError: () => {
      toast.error("Failed to add note");
    },
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 60_000, // Refresh every minute
  });
}

// ── Email linking hooks ──

export function useLinkEmail(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emailId: string) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      });
      if (!res.ok) throw new Error("Failed to link email");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Email linked");
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["email-messages"] });
    },
    onError: () => {
      toast.error("Failed to link email");
    },
  });
}

export function useUnlinkEmail(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emailId: string) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/emails`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      });
      if (!res.ok) throw new Error("Failed to unlink email");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Email unlinked");
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["email-messages"] });
    },
    onError: () => {
      toast.error("Failed to unlink email");
    },
  });
}

// ── Stage history hooks ──

export function useAddStageHistory(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      fromStage: string;
      toStage: string;
      note?: string;
      createdAt?: string;
    }) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/stage-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add stage history entry");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Stage history added");
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: () => {
      toast.error("Failed to add stage history");
    },
  });
}

export function useUpdateStageHistory(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      data,
    }: {
      entryId: string;
      data: { note?: string; createdAt?: string };
    }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/stage-history?entryId=${entryId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error("Failed to update stage history entry");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Stage history updated");
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: () => {
      toast.error("Failed to update stage history");
    },
  });
}

export function useDeleteStageHistory(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/stage-history?entryId=${entryId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete stage history entry");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Stage history entry deleted");
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: () => {
      toast.error("Failed to delete stage history");
    },
  });
}
