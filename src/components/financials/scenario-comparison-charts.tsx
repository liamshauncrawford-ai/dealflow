"use client";

import type { ValuationInputs, ValuationOutputs } from "@/lib/financial/valuation-engine";

export interface ChartScenario {
  id: string;
  name: string;
  color: string;
  inputs: ValuationInputs;
  outputs: ValuationOutputs;
}

interface ScenarioComparisonChartsProps {
  scenarios: ChartScenario[];
}

export function ScenarioComparisonCharts({ scenarios }: ScenarioComparisonChartsProps) {
  if (scenarios.length < 2) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">Charts placeholder ({scenarios.length} scenarios)</p>
    </div>
  );
}
