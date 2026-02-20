"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ListingsResponse, ListingFilters, ListingSortConfig } from "@/types/listing";

interface UseListingsParams extends ListingFilters, ListingSortConfig {
  page?: number;
  pageSize?: number;
}

export function useListings(params: UseListingsParams = { sortBy: "lastSeenAt", sortDir: "desc" }) {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params.source) searchParams.set("source", params.source);
  if (params.search) searchParams.set("search", params.search);
  if (params.industry) searchParams.set("industry", params.industry);
  if (params.city) searchParams.set("city", params.city);
  if (params.state) searchParams.set("state", params.state);
  if (params.metroArea) searchParams.set("metroArea", params.metroArea);
  if (params.platform) searchParams.set("platform", params.platform);
  if (params.minPrice !== undefined) searchParams.set("minPrice", String(params.minPrice));
  if (params.maxPrice !== undefined) searchParams.set("maxPrice", String(params.maxPrice));
  if (params.minEbitda !== undefined) searchParams.set("minEbitda", String(params.minEbitda));
  if (params.maxEbitda !== undefined) searchParams.set("maxEbitda", String(params.maxEbitda));
  if (params.minSde !== undefined) searchParams.set("minSde", String(params.minSde));
  if (params.maxSde !== undefined) searchParams.set("maxSde", String(params.maxSde));
  if (params.minRevenue !== undefined) searchParams.set("minRevenue", String(params.minRevenue));
  if (params.maxRevenue !== undefined) searchParams.set("maxRevenue", String(params.maxRevenue));
  if (params.showHidden) searchParams.set("showHidden", "true");
  if (params.showInactive) searchParams.set("showInactive", "true");
  if (params.meetsThreshold !== undefined) searchParams.set("meetsThreshold", String(params.meetsThreshold));

  return useQuery<ListingsResponse>({
    queryKey: ["listings", params],
    queryFn: async () => {
      const res = await fetch(`/api/listings?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch listings");
      return res.json();
    },
  });
}

export function useListing(id: string | null) {
  return useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/listings/${id}`);
      if (!res.ok) throw new Error("Failed to fetch listing");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create listing");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Listing created");
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Failed to create listing");
    },
  });
}

export function useUpdateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update listing");
      return res.json();
    },
    onSuccess: (data, variables) => {
      toast.success("Listing updated");
      // Immediately update the cache with the server response
      queryClient.setQueryData(["listing", variables.id], data);
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Failed to update listing");
    },
  });
}

export function useToggleHidden() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/listings/${id}/hide`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle hidden");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Listing visibility updated");
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Failed to update visibility");
    },
  });
}

export function useUpdateListingSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listingId, sourceId, sourceUrl }: { listingId: string; sourceId: string; sourceUrl: string }) => {
      const res = await fetch(`/api/listings/${listingId}/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update source URL");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast.success("Source URL updated");
      queryClient.invalidateQueries({ queryKey: ["listing", variables.listingId] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      // Also invalidate opportunity queries since listing is nested
      queryClient.invalidateQueries({ queryKey: ["opportunity"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update source URL");
    },
  });
}

export function usePromoteToPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data?: Record<string, unknown> }) => {
      const res = await fetch(`/api/listings/${id}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create opportunity");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Added to pipeline");
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Failed to add to pipeline");
    },
  });
}
