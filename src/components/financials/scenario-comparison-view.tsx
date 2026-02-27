"use client";

import { useState, useMemo, useEffect } from "react";
import { BarChart3, Sparkles, Loader2, AlertTriangle, Shield, TrendingDown, Handshake } from "lucide-react";
import type { ValuationScenario } from "@/hooks/use-valuation-scenarios";
import { useCompareScenarios } from "@/hooks/use-valuation-scenarios";
import type { ValuationInputs, ValuationOutputs } from "@/lib/financial/valuation-engine";
import { ScenarioComparisonTable, type ComparisonScenario } from "./scenario-comparison-table";
import { ScenarioComparisonCharts } from "./scenario-comparison-charts";

// ─────────────────────────────────────────────
// Scenario colors for chart legends
// ─────────────────────────────────────────────

const SCENARIO_COLORS = ["#8b5cf6", "#f59e0b", "#06b6d4"]; // purple, amber, cyan

// ─────────────────────────────────────────────
// AI Comparison result type
// ─────────────────────────────────────────────

export interface ScenarioComparisonResult {
  verdict: string;
  risk_adjusted_assessment: string;
  value_creation_bridge: Array<{
    scenario_name: string;
    ebitda_growth_pct: number;
    multiple_expansion_pct: number;
    debt_paydown_pct: number;
  }>;
  covenant_check: string;
  downside_resilience: string;
  negotiation_strategy: string;
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface ScenarioComparisonViewProps {
  opportunityId: string;
  scenarios: ValuationScenario[];
  isLoading: boolean;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function ScenarioComparisonView({
  opportunityId,
  scenarios,
  isLoading,
}: ScenarioComparisonViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiComparison, setAiComparison] = useState<ScenarioComparisonResult | null>(null);

  const compareMutation = useCompareScenarios(opportunityId);

  // Auto-select first 2 scenarios on initial load
  useEffect(() => {
    if (scenarios.length >= 2 && selectedIds.size === 0) {
      setSelectedIds(new Set(scenarios.slice(0, 2).map((s) => s.id)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios]);

  // Build ComparisonScenario objects from selected scenarios
  const selectedScenarios: ComparisonScenario[] = useMemo(() => {
    // Maintain order from the scenarios array to keep color assignment stable
    return scenarios
      .filter((s) => selectedIds.has(s.id))
      .map((s, i) => ({
        id: s.id,
        name: s.modelName || "Untitled",
        color: SCENARIO_COLORS[i % SCENARIO_COLORS.length],
        inputs: s.inputs as unknown as ValuationInputs,
        outputs: s.outputs as unknown as ValuationOutputs,
      }));
  }, [scenarios, selectedIds]);

  const toggleScenario = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  };

  const handleAICompare = () => {
    if (selectedScenarios.length < 2) return;
    compareMutation.mutate(
      selectedScenarios.map((s) => s.id),
      {
        onSuccess: (data) => {
          setAiComparison(data.comparison);
        },
      },
    );
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        <p className="ml-3 text-sm text-muted-foreground">Loading scenarios...</p>
      </div>
    );
  }

  // ── Empty state (< 2 scenarios) ──
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
    <div className="space-y-6">
      {/* ── Scenario Selector ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Compare:</span>
        {scenarios.map((s, i) => (
          <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.has(s.id)}
              onChange={() => toggleScenario(s.id)}
              disabled={!selectedIds.has(s.id) && selectedIds.size >= 3}
              className="rounded"
            />
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }}
            />
            {s.modelName || "Untitled"}
          </label>
        ))}
      </div>

      {/* ── Content (only if 2+ selected) ── */}
      {selectedScenarios.length >= 2 ? (
        <>
          {/* KPI Comparison Table */}
          <ScenarioComparisonTable scenarios={selectedScenarios} />

          {/* Charts */}
          <ScenarioComparisonCharts scenarios={selectedScenarios} />

          {/* AI Comparison Section */}
          <div className="space-y-4">
            <button
              onClick={handleAICompare}
              disabled={compareMutation.isPending || selectedScenarios.length < 2}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {compareMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Compare with AI
            </button>

            {/* AI Loading State */}
            {compareMutation.isPending && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Generating AI comparison analysis...</p>
                </div>
              </div>
            )}

            {/* AI Result Panel */}
            {aiComparison && !compareMutation.isPending && (
              <AIComparisonPanel comparison={aiComparison} />
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Select at least 2 scenarios above to compare.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AI Comparison Panel (follows financial-analysis-panel.tsx pattern)
// ─────────────────────────────────────────────

function AIComparisonPanel({ comparison }: { comparison: ScenarioComparisonResult }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">AI Scenario Comparison</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Verdict */}
        <div className="rounded-md bg-muted/30 p-3">
          <p className="text-sm leading-relaxed">{comparison.verdict}</p>
        </div>

        {/* Risk-Adjusted Assessment + Downside Resilience side by side */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Risk-Adjusted Assessment
              </h4>
            </div>
            <p className="text-sm leading-relaxed">{comparison.risk_adjusted_assessment}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Downside Resilience
              </h4>
            </div>
            <p className="text-sm leading-relaxed">{comparison.downside_resilience}</p>
          </div>
        </div>

        {/* Value Creation Bridge */}
        {comparison.value_creation_bridge.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Value Creation Bridge
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-3">Scenario</th>
                    <th className="text-right py-2 px-2">EBITDA Growth</th>
                    <th className="text-right py-2 px-2">Multiple Expansion</th>
                    <th className="text-right py-2 pl-2">Debt Paydown</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.value_creation_bridge.map((row) => (
                    <tr key={row.scenario_name} className="border-b border-border/50">
                      <td className="py-1.5 pr-3 font-medium">{row.scenario_name}</td>
                      <td className="text-right py-1.5 px-2">{row.ebitda_growth_pct.toFixed(0)}%</td>
                      <td className="text-right py-1.5 px-2">{row.multiple_expansion_pct.toFixed(0)}%</td>
                      <td className="text-right py-1.5 pl-2">{row.debt_paydown_pct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Covenant & Underwriting Check */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="h-3.5 w-3.5 text-blue-500" />
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Covenant & Underwriting Check
            </h4>
          </div>
          <p className="text-sm leading-relaxed">{comparison.covenant_check}</p>
        </div>

        {/* Negotiation Strategy */}
        <div className="rounded-md border bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Handshake className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-xs font-medium text-primary uppercase tracking-wide">
              Negotiation Strategy
            </h4>
          </div>
          <p className="text-sm leading-relaxed">{comparison.negotiation_strategy}</p>
        </div>
      </div>
    </div>
  );
}
