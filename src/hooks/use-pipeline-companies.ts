import { useQuery } from "@tanstack/react-query";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Linked listing fallback data for financial fields */
export interface PipelineCompanyListing {
  id: string;
  businessName: string | null;
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  cashFlow: number | null;
  askingPrice: number | null;
  inferredEbitda: number | null;
  inferredSde: number | null;
  compositeScore: number | null;
  city: string | null;
  state: string | null;
}

/** Active pipeline opportunity with optional linked listing data */
export interface PipelineCompany {
  opportunityId: string;
  title: string;
  stage: string;
  actualRevenue: number | null;
  actualEbitda: number | null;
  offerPrice: number | null;
  listing: PipelineCompanyListing | null;
}

// ─────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────

async function fetchPipelineCompanies(): Promise<PipelineCompany[]> {
  const res = await fetch("/api/pipeline/active-companies");
  if (!res.ok) throw new Error("Failed to fetch pipeline companies");
  const data = await res.json();
  return data.companies ?? [];
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * Fetches active pipeline opportunities for financial analysis tools
 * (Roll-Up Model, Valuation, Comparison).
 *
 * Excludes CLOSED_LOST and CLOSED_WON. Includes linked listing data
 * for EBITDA/revenue fallback chains.
 */
export function usePipelineCompanies() {
  return useQuery<PipelineCompany[]>({
    queryKey: ["pipeline-companies"],
    queryFn: fetchPipelineCompanies,
    staleTime: 60_000, // 1 minute
  });
}
