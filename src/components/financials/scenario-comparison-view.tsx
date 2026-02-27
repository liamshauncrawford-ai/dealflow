"use client";

import { BarChart3 } from "lucide-react";
import type { ValuationScenario } from "@/hooks/use-valuation-scenarios";

interface ScenarioComparisonViewProps {
  opportunityId: string;
  scenarios: ValuationScenario[];
  isLoading: boolean;
}

export function ScenarioComparisonView({
  scenarios,
  isLoading,
}: ScenarioComparisonViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        <p className="ml-3 text-sm text-muted-foreground">Loading scenarios...</p>
      </div>
    );
  }

  if (scenarios.length < 2) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 font-medium">Compare Scenarios</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Save at least 2 scenarios in the Model tab to compare them here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
      <p className="mt-3 font-medium">Scenario Comparison</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {scenarios.length} scenarios available to compare.
      </p>
    </div>
  );
}
