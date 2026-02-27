import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ThesisConfig } from "@/lib/thesis-defaults";

// ─────────────────────────────────────────────
// Fetch thesis settings
// ─────────────────────────────────────────────

async function fetchThesisSettings(): Promise<ThesisConfig> {
  const res = await fetch("/api/settings/thesis");
  if (!res.ok) {
    throw new Error("Failed to fetch thesis settings");
  }
  return res.json();
}

export function useThesisSettings() {
  return useQuery({
    queryKey: ["thesis-settings"],
    queryFn: fetchThesisSettings,
    staleTime: 30_000, // 30 seconds
  });
}

// ─────────────────────────────────────────────
// Update thesis settings
// ─────────────────────────────────────────────

/** Extends ThesisConfig with transient fields the API accepts but aren't stored directly */
type ThesisUpdate = Partial<ThesisConfig> & {
  /** Resolves to platformListingId server-side (auto-creates listing if needed) */
  platformOpportunityId?: string | null;
};

async function updateThesisSettings(
  updates: ThesisUpdate
): Promise<ThesisConfig> {
  const res = await fetch("/api/settings/thesis", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to update thesis settings");
  }

  return res.json();
}

export function useUpdateThesisSettings() {
  const queryClient = useQueryClient();

  return useMutation<ThesisConfig, Error, ThesisUpdate>({
    mutationFn: updateThesisSettings,
    onSuccess: () => {
      // Invalidate thesis settings and stats (dashboard recalculates)
      queryClient.invalidateQueries({ queryKey: ["thesis-settings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// ─────────────────────────────────────────────
// Fetch pipeline opportunities for platform company selector
// ─────────────────────────────────────────────

export interface PlatformOption {
  opportunityId: string;
  listingId: string | null;
  title: string;
  tier: string | null;
  ebitda: number | null;
  revenue: number | null;
}

async function fetchPlatformOptions(): Promise<PlatformOption[]> {
  const res = await fetch("/api/settings/thesis/platform-options");
  if (!res.ok) {
    throw new Error("Failed to fetch platform options");
  }
  const data = await res.json();
  return data.options ?? [];
}

export function useListingsForPlatform() {
  return useQuery<PlatformOption[]>({
    queryKey: ["platform-options"],
    queryFn: fetchPlatformOptions,
    staleTime: 60_000, // 1 minute
  });
}
