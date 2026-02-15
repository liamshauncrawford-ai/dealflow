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

async function updateThesisSettings(
  updates: Partial<ThesisConfig>
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

  return useMutation({
    mutationFn: updateThesisSettings,
    onSuccess: () => {
      // Invalidate thesis settings and stats (dashboard recalculates)
      queryClient.invalidateQueries({ queryKey: ["thesis-settings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// ─────────────────────────────────────────────
// Fetch listings for platform company selector
// ─────────────────────────────────────────────

interface ListingOption {
  id: string;
  title: string;
  tier: string | null;
  ebitda: number | null;
  revenue: number | null;
}

async function fetchListingsForPlatformSelector(): Promise<ListingOption[]> {
  const res = await fetch("/api/listings?limit=200&sort=title&order=asc");
  if (!res.ok) {
    throw new Error("Failed to fetch listings");
  }
  const data = await res.json();
  return (data.listings ?? []).map(
    (l: { id: string; title: string; tier: string | null; ebitda: number | null; revenue: number | null }) => ({
      id: l.id,
      title: l.title,
      tier: l.tier,
      ebitda: l.ebitda ? Number(l.ebitda) : null,
      revenue: l.revenue ? Number(l.revenue) : null,
    })
  );
}

export function useListingsForPlatform() {
  return useQuery({
    queryKey: ["listings-for-platform"],
    queryFn: fetchListingsForPlatformSelector,
    staleTime: 60_000, // 1 minute
  });
}
