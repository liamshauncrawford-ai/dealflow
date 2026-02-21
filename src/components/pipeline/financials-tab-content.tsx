"use client";

import { useState } from "react";
import { useFinancialPeriods } from "@/hooks/use-financials";
import { ErrorBoundary } from "@/components/error-boundary";
import { FinancialsSummaryBar } from "@/components/financials/financials-summary-bar";
import { DataEntryToolbar } from "@/components/financials/data-entry-toolbar";
import { FinancialPeriodsTable } from "@/components/financials/financial-periods-table";
import { FinancialPeriodForm } from "@/components/financials/financial-period-form";
import { AddBacksPanel } from "@/components/financials/add-backs-panel";
import { QualityChecksPanel } from "@/components/financials/quality-checks-panel";
import { DSCRPanel } from "@/components/financials/dscr-panel";
import { AIExtractionModal } from "@/components/financials/ai-extraction-modal";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface FinancialsTabContentProps {
  opportunityId: string;
  opportunity: any;
}

export function FinancialsTabContent({
  opportunityId,
  opportunity,
}: FinancialsTabContentProps) {
  const { data: periods = [], isLoading } = useFinancialPeriods(opportunityId);

  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [showExtraction, setShowExtraction] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"ebitda" | "sde">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("financials-view-mode") as "ebitda" | "sde") ||
        "ebitda"
      );
    }
    return "ebitda";
  });

  const handleViewModeChange = (mode: "ebitda" | "sde") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("financials-view-mode", mode);
    }
  };

  const selectedPeriod =
    periods.find((p: any) => p.id === selectedPeriodId) ?? periods[0] ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      {periods.length > 0 && (
        <ErrorBoundary>
          <FinancialsSummaryBar periods={periods} viewMode={viewMode} />
        </ErrorBoundary>
      )}

      {/* Toolbar */}
      <ErrorBoundary>
        <DataEntryToolbar
          onAddPeriod={() => setShowAddPeriod(true)}
          onExtractFromDocument={() => setShowExtraction(true)}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          hasPeriods={periods.length > 0}
          hasDocuments={(opportunity.documents ?? []).length > 0}
        />
      </ErrorBoundary>

      {/* Add Period Form */}
      {showAddPeriod && (
        <ErrorBoundary>
          <FinancialPeriodForm
            opportunityId={opportunityId}
            onClose={() => setShowAddPeriod(false)}
          />
        </ErrorBoundary>
      )}

      {/* Periods Table */}
      {periods.length > 0 ? (
        <ErrorBoundary>
          <FinancialPeriodsTable
            periods={periods}
            viewMode={viewMode}
            opportunityId={opportunityId}
            selectedPeriodId={selectedPeriod?.id}
            onSelectPeriod={setSelectedPeriodId}
          />
        </ErrorBoundary>
      ) : !showAddPeriod ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No financial periods yet.</p>
          <button
            onClick={() => setShowAddPeriod(true)}
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            Add your first financial period
          </button>
        </div>
      ) : null}

      {/* Two-column detail panels */}
      {selectedPeriod && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <ErrorBoundary>
              <AddBacksPanel
                opportunityId={opportunityId}
                period={selectedPeriod}
                viewMode={viewMode}
              />
            </ErrorBoundary>

            <ErrorBoundary>
              <QualityChecksPanel periods={periods} />
            </ErrorBoundary>
          </div>

          <div className="space-y-6">
            <ErrorBoundary>
              <DSCRPanel
                opportunityId={opportunityId}
                period={selectedPeriod}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* AI Extraction Modal */}
      {showExtraction && (
        <AIExtractionModal
          opportunityId={opportunityId}
          documents={opportunity.documents ?? []}
          onClose={() => setShowExtraction(false)}
          onApplied={() => setShowExtraction(false)}
        />
      )}
    </div>
  );
}
