"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PreviewDeal {
  folderName: string;
  folderPath: string;
  fileCount: number;
  detectedStage: string;
  hasCIM: boolean;
  hasFinancialModel: boolean;
  hasLOI: boolean;
  hasNDA: boolean;
  hasTaxReturns: boolean;
  hasFinancialStatements: boolean;
  files: {
    fileName: string;
    extension: string;
    fileSize: number;
    category: string;
  }[];
}

interface ImportPreview {
  basePath: string;
  totalDeals: number;
  totalFiles: number;
  skippedFolders: string[];
  deals: PreviewDeal[];
}

interface ImportedDealDetail {
  folderName: string;
  status: "imported" | "skipped" | "error";
  reason?: string;
  listingId?: string;
  opportunityId?: string;
  financialSource?: string;
  stage?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  details: ImportedDealDetail[];
}

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

/**
 * Fetch a preview of deal folders that can be imported.
 */
export function useImportPreview() {
  return useQuery<ImportPreview>({
    queryKey: ["import-preview"],
    queryFn: async () => {
      const res = await fetch("/api/import/deals/preview");
      if (!res.ok) throw new Error("Failed to fetch import preview");
      return res.json();
    },
    // Don't refetch automatically — this is a one-time scan
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Trigger the deal import.
 */
export function useImportDeals() {
  const queryClient = useQueryClient();

  return useMutation<
    ImportResult,
    Error,
    {
      folderNames?: string[];
      skipExisting?: boolean;
      runDedup?: boolean;
    }
  >({
    mutationFn: async (options) => {
      const res = await fetch("/api/import/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to import deals");
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all relevant queries after import
      queryClient.invalidateQueries({ queryKey: ["import-preview"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
