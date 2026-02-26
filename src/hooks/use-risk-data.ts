"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface RiskFlag {
  severity: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  description: string;
}

export interface RiskAssessmentData {
  overallRisk: "HIGH" | "MEDIUM" | "LOW";
  thesisFitScore: number;
  riskFlags: RiskFlag[];
  strengths: string[];
  concerns: string[];
  recommendation: string;
  keyQuestions: string[];
}

interface RiskDataResponse {
  analysisId: string;
  result: RiskAssessmentData;
  modelUsed: string;
  createdAt: string;
}

/**
 * Fetches the latest persisted AI risk assessment for an opportunity.
 */
export function useRiskData(opportunityId: string) {
  return useQuery({
    queryKey: ["risk-data", opportunityId],
    queryFn: async (): Promise<RiskDataResponse | null> => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/risk-assessment`,
      );
      if (!res.ok) throw new Error("Failed to fetch risk assessment");
      const data = await res.json();
      if (!data.result) return null;
      return data as RiskDataResponse;
    },
  });
}

/**
 * Updates the persisted risk assessment's resultData (for editing).
 */
export function useUpdateRiskData(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      analysisId,
      resultData,
    }: {
      analysisId: string;
      resultData: RiskAssessmentData;
    }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/risk-assessment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisId, resultData }),
        },
      );
      if (!res.ok) throw new Error("Failed to update risk assessment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["risk-data", opportunityId],
      });
      toast.success("Risk assessment updated");
    },
    onError: () => {
      toast.error("Failed to update risk assessment");
    },
  });
}

/**
 * Deletes a risk assessment by analysisId.
 */
export function useDeleteRiskAssessment(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/risk-assessment`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisId }),
        },
      );
      if (!res.ok) throw new Error("Failed to delete risk assessment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["risk-data", opportunityId],
      });
      toast.success("Risk assessment deleted");
    },
    onError: () => {
      toast.error("Failed to delete risk assessment");
    },
  });
}
