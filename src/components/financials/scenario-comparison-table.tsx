"use client";

import type { ValuationInputs, ValuationOutputs } from "@/lib/financial/valuation-engine";

export interface ComparisonScenario {
  id: string;
  name: string;
  color: string;
  inputs: ValuationInputs;
  outputs: ValuationOutputs;
}

interface ScenarioComparisonTableProps {
  scenarios: ComparisonScenario[];
}

export function ScenarioComparisonTable({ scenarios }: ScenarioComparisonTableProps) {
  if (scenarios.length < 2) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">KPI comparison table placeholder ({scenarios.length} scenarios)</p>
    </div>
  );
}
