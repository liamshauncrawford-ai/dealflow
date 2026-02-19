"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Operators ──

export function useOperators(params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return useQuery({
    queryKey: ["operators", params],
    queryFn: async () => {
      const res = await fetch(`/api/market-intel/operators?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch operators");
      return res.json();
    },
  });
}

export function useOperator(id: string | null) {
  return useQuery({
    queryKey: ["operator", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/market-intel/operators/${id}`);
      if (!res.ok) throw new Error("Failed to fetch operator");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/market-intel/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create operator");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Operator created");
      queryClient.invalidateQueries({ queryKey: ["operators"] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to create operator"),
  });
}

export function useUpdateOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/market-intel/operators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update operator");
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Operator updated");
      queryClient.invalidateQueries({ queryKey: ["operators"] });
      queryClient.invalidateQueries({ queryKey: ["operator", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to update operator"),
  });
}

export function useDeleteOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/market-intel/operators/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete operator");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Operator deleted");
      queryClient.invalidateQueries({ queryKey: ["operators"] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to delete operator"),
  });
}

// ── General Contractors ──

export function useGCs(params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return useQuery({
    queryKey: ["gcs", params],
    queryFn: async () => {
      const res = await fetch(`/api/market-intel/gcs?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch GCs");
      return res.json();
    },
  });
}

export function useGC(id: string | null) {
  return useQuery({
    queryKey: ["gc", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/market-intel/gcs/${id}`);
      if (!res.ok) throw new Error("Failed to fetch GC");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateGC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/market-intel/gcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create GC");
      return res.json();
    },
    onSuccess: () => {
      toast.success("GC created");
      queryClient.invalidateQueries({ queryKey: ["gcs"] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to create GC"),
  });
}

export function useUpdateGC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/market-intel/gcs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update GC");
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success("GC updated");
      queryClient.invalidateQueries({ queryKey: ["gcs"] });
      queryClient.invalidateQueries({ queryKey: ["gc", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to update GC"),
  });
}

export function useDeleteGC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/market-intel/gcs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete GC");
      return res.json();
    },
    onSuccess: () => {
      toast.success("GC deleted");
      queryClient.invalidateQueries({ queryKey: ["gcs"] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to delete GC"),
  });
}

// ── Cabling Opportunities ──

export function useCablingOpportunities(params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return useQuery({
    queryKey: ["cabling-opportunities", params],
    queryFn: async () => {
      const res = await fetch(`/api/market-intel/opportunities?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch cabling opportunities");
      return res.json();
    },
  });
}

export function useCablingOpportunity(id: string | null) {
  return useQuery({
    queryKey: ["cabling-opportunity", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/market-intel/opportunities/${id}`);
      if (!res.ok) throw new Error("Failed to fetch cabling opportunity");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateCablingOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/market-intel/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create cabling opportunity");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Cabling opportunity created");
      queryClient.invalidateQueries({ queryKey: ["cabling-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to create cabling opportunity"),
  });
}

export function useUpdateCablingOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/market-intel/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update cabling opportunity");
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Cabling opportunity updated");
      queryClient.invalidateQueries({ queryKey: ["cabling-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["cabling-opportunity", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to update cabling opportunity"),
  });
}

export function useDeleteCablingOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/market-intel/opportunities/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete cabling opportunity");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Cabling opportunity deleted");
      queryClient.invalidateQueries({ queryKey: ["cabling-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to delete cabling opportunity"),
  });
}

// ── Facilities ──

export function useCreateFacility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/market-intel/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create facility");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Facility created");
      queryClient.invalidateQueries({ queryKey: ["operators"] });
      queryClient.invalidateQueries({ queryKey: ["operator"] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to create facility"),
  });
}

export function useUpdateFacility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/market-intel/facilities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update facility");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Facility updated");
      queryClient.invalidateQueries({ queryKey: ["operators"] });
      queryClient.invalidateQueries({ queryKey: ["operator"] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to update facility"),
  });
}

export function useDeleteFacility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/market-intel/facilities/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete facility");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Facility deleted");
      queryClient.invalidateQueries({ queryKey: ["operators"] });
      queryClient.invalidateQueries({ queryKey: ["operator"] });
      queryClient.invalidateQueries({ queryKey: ["market-intel-stats"] });
    },
    onError: () => toast.error("Failed to delete facility"),
  });
}

// ── Market Intel Stats ──

export function useMarketIntelStats() {
  return useQuery({
    queryKey: ["market-intel-stats"],
    queryFn: async () => {
      const res = await fetch("/api/market-intel/stats");
      if (!res.ok) throw new Error("Failed to fetch market intel stats");
      return res.json();
    },
    refetchInterval: 60_000,
  });
}
