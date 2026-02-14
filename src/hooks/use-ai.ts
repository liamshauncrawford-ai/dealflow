"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CIMAnalysisResponse {
  analysisId: string;
  result: Record<string, unknown>;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}

export interface ApplyCIMResponse {
  updated: boolean;
  fieldsApplied: string[];
  contactCreated?: boolean;
}

export interface RiskAssessmentResponse {
  analysisId: string;
  result: Record<string, unknown>;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
}

// ─────────────────────────────────────────────
// Analyze CIM with AI
// ─────────────────────────────────────────────

export function useAnalyzeCIM(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation<CIMAnalysisResponse, Error, string>({
    mutationFn: async (documentId: string) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/analyze-cim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to analyze CIM");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("CIM analysis complete");
      queryClient.invalidateQueries({
        queryKey: ["opportunity", opportunityId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "CIM analysis failed");
    },
  });
}

// ─────────────────────────────────────────────
// Apply CIM extraction results to opportunity
// ─────────────────────────────────────────────

export function useApplyCIMResults(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation<ApplyCIMResponse, Error, { analysisId: string; selectedFields: string[] }>({
    mutationFn: async ({ analysisId, selectedFields }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/apply-cim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisId, selectedFields }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to apply CIM results");
      }

      return res.json();
    },
    onSuccess: (data) => {
      const count = data.fieldsApplied.length;
      toast.success(
        `Applied ${count} field${count !== 1 ? "s" : ""} from CIM analysis` +
          (data.contactCreated ? " + created contact" : ""),
      );
      queryClient.invalidateQueries({
        queryKey: ["opportunity", opportunityId],
      });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to apply CIM results");
    },
  });
}

// ─────────────────────────────────────────────
// AI Risk Assessment
// ─────────────────────────────────────────────

export function useRiskAssessment(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation<RiskAssessmentResponse, Error, void>({
    mutationFn: async () => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/risk-assessment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate risk assessment");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Risk assessment generated");
      queryClient.invalidateQueries({
        queryKey: ["opportunity", opportunityId],
      });
      queryClient.invalidateQueries({
        queryKey: ["risk-data", opportunityId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Risk assessment failed");
    },
  });
}
