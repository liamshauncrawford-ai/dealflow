"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useOpportunity } from "@/hooks/use-pipeline";
import { ErrorBoundary } from "@/components/error-boundary";
import { DealHeader, StagePriorityBar } from "@/components/pipeline";
import { DealTabBar, type DealTab } from "@/components/pipeline/deal-tab-bar";
import { OverviewTabContent } from "@/components/pipeline/overview-tab-content";
import { FinancialsTabContent } from "@/components/pipeline/financials-tab-content";
import { HistoricFinancialsTabContent } from "@/components/pipeline/historic-financials-tab-content";
import { ValuationTabContent } from "@/components/pipeline/valuation-tab-content";

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<DealTab>("overview");
  const { data: opportunity, isLoading, error } = useOpportunity(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label="Loading deal details">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">Failed to load opportunity</p>
        <Link href="/pipeline" className="mt-2 text-sm text-primary hover:underline">
          Back to pipeline
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Persistent header — always visible above tabs */}
      <ErrorBoundary>
        <DealHeader opportunity={opportunity} />
      </ErrorBoundary>

      <ErrorBoundary>
        <StagePriorityBar opportunity={opportunity} />
      </ErrorBoundary>

      {/* Tab Navigation */}
      <DealTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTabContent opportunity={opportunity} />
      )}
      {activeTab === "financials" && (
        <FinancialsTabContent
          opportunityId={id}
          opportunity={opportunity}
        />
      )}
      {activeTab === "historic-financials" && (
        <HistoricFinancialsTabContent opportunityId={id} />
      )}
      {activeTab === "valuation" && (
        <ValuationTabContent
          opportunityId={id}
          opportunity={opportunity}
        />
      )}
    </div>
  );
}
