"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Calculator,
  TrendingUp,
  DollarSign,
  BarChart3,
  Loader2,
  Sparkles,
  RotateCcw,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  calculateValuation,
  DEFAULT_INPUTS,
  generateSensitivityTable,
  type ValuationInputs,
  type ValuationOutputs,
} from "@/lib/financial/valuation-engine";
import type { ValuationCommentary } from "@/lib/ai/valuation-commentary";
import { useFinancialPeriods } from "@/hooks/use-financials";
import {
  useValuationScenarios,
  useCreateValuationScenario,
  useUpdateValuationScenario,
  useDeleteValuationScenario,
  type ValuationScenario,
} from "@/hooks/use-valuation-scenarios";
import {
  mapFinancialPeriodToValuationInputs,
  mapWeightedPeriodsToValuationInputs,
  mapAveragePeriods,
  sortPeriodsNewestFirst,
  getMostRecentAnnual,
  type PeriodSummary,
} from "@/lib/financial/period-to-valuation-mapper";
import { ScenarioComparisonView } from "@/components/financials/scenario-comparison-view";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function fmt(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function fmtK(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return fmt(value);
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtX(value: number): string {
  return `${value.toFixed(1)}x`;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type YearSelection = "most_recent" | "weighted" | "average" | string; // string = specific year like "2024"

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ValuationTabContentProps {
  opportunityId: string;
  opportunity: any;
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export function ValuationTabContent({
  opportunityId,
  opportunity,
}: ValuationTabContentProps) {
  const [subTab, setSubTab] = useState<"model" | "compare">("model");
  const [inputs, setInputs] = useState<ValuationInputs>(DEFAULT_INPUTS);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showProjection, setShowProjection] = useState(true);
  const [commentary, setCommentary] = useState<ValuationCommentary | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [yearSelection, setYearSelection] = useState<YearSelection>("most_recent");
  const [isEditingName, setIsEditingName] = useState(false);
  const [scenarioName, setScenarioName] = useState("Base Case");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFingerprintRef = useRef<string | null>(null);
  const [financialsUpdatedBanner, setFinancialsUpdatedBanner] = useState(false);

  // Data hooks
  const { data: periods = [] } = useFinancialPeriods(opportunityId);
  const { data: scenarios = [], isLoading: scenariosLoading } = useValuationScenarios(opportunityId);
  const createScenario = useCreateValuationScenario(opportunityId);
  const updateScenario = useUpdateValuationScenario(opportunityId);
  const deleteScenario = useDeleteValuationScenario(opportunityId);

  // Sort periods for year selector
  const sortedPeriods = useMemo(
    () => sortPeriodsNewestFirst(periods as PeriodSummary[]),
    [periods],
  );
  const annualPeriods = useMemo(
    () => sortedPeriods.filter((p) => p.periodType === "ANNUAL"),
    [sortedPeriods],
  );

  // Fingerprint of financial data — changes when periods are created/updated
  const periodsFingerprint = useMemo(() => {
    if (!annualPeriods.length) return "empty";
    return annualPeriods
      .map((p) => `${p.year}:${p.totalRevenue}:${p.adjustedEbitda}`)
      .join("|");
  }, [annualPeriods]);

  // ── Initialize from saved scenario or financial data ──
  // Uses fingerprint instead of one-time flag so it reacts to new extraction data
  useEffect(() => {
    if (scenariosLoading) return;
    if (periodsFingerprint === lastFingerprintRef.current) return;

    const isFirstLoad = lastFingerprintRef.current === null;
    lastFingerprintRef.current = periodsFingerprint;

    if (scenarios.length > 0) {
      if (isFirstLoad && !activeScenarioId) {
        // First mount: load most recent saved scenario
        const latest = scenarios[0];
        setInputs(latest.inputs as unknown as ValuationInputs);
        setActiveScenarioId(latest.id);
        setScenarioName(latest.modelName || "Untitled Scenario");
      } else if (!isFirstLoad) {
        // Financial data changed while a scenario is active — show notification
        // Don't overwrite their active work
        setFinancialsUpdatedBanner(true);
      }
    } else if (annualPeriods.length > 0) {
      // No saved scenarios — auto-populate from most recent financial year
      const recent = getMostRecentAnnual(annualPeriods as PeriodSummary[]);
      if (recent) {
        setInputs(
          mapFinancialPeriodToValuationInputs(recent, DEFAULT_INPUTS, annualPeriods as PeriodSummary[]),
        );
      }
    }
  }, [periodsFingerprint, scenariosLoading, scenarios, annualPeriods, activeScenarioId]);

  // Handler to refresh valuation inputs from latest financials (dismisses banner)
  const handleRefreshFromFinancials = useCallback(() => {
    const periodsData = annualPeriods as PeriodSummary[];
    const recent = getMostRecentAnnual(periodsData);
    if (recent) {
      setInputs((prev) =>
        mapFinancialPeriodToValuationInputs(recent, prev, periodsData),
      );
    }
    setFinancialsUpdatedBanner(false);
  }, [annualPeriods]);

  // ── Input update with auto-margin calculation ──
  const update = useCallback(
    <K extends keyof ValuationInputs>(field: K, value: ValuationInputs[K]) => {
      setInputs((prev) => {
        const next = { ...prev, [field]: value };
        if (
          (field === "target_revenue" || field === "target_ebitda") &&
          next.target_revenue > 0
        ) {
          next.target_ebitda_margin = next.target_ebitda / next.target_revenue;
        }
        // Reset multiples to sensible defaults when valuation method changes
        if (field === "valuation_method") {
          next.entry_multiple = value === "revenue" ? 1.0 : 4.0;
        }
        if (field === "exit_valuation_method") {
          next.exit_multiple = value === "revenue" ? 1.5 : 7.0;
        }
        return next;
      });
    },
    [],
  );

  // ── Year selector handler ──
  const handleYearChange = useCallback(
    (selection: YearSelection) => {
      setYearSelection(selection);
      const periodsData = annualPeriods as PeriodSummary[];

      if (selection === "most_recent") {
        const recent = getMostRecentAnnual(periodsData);
        if (recent) {
          setInputs((prev) =>
            mapFinancialPeriodToValuationInputs(recent, prev, periodsData),
          );
        }
      } else if (selection === "weighted") {
        setInputs((prev) => mapWeightedPeriodsToValuationInputs(periodsData, undefined, prev));
      } else if (selection === "average") {
        setInputs((prev) => mapAveragePeriods(periodsData, prev));
      } else {
        // Specific year
        const year = parseInt(selection);
        const period = periodsData.find((p) => p.year === year);
        if (period) {
          setInputs((prev) =>
            mapFinancialPeriodToValuationInputs(period, prev, periodsData),
          );
        }
      }
    },
    [annualPeriods],
  );

  // ── Auto-save on input change (debounced) ──
  useEffect(() => {
    if (!activeScenarioId) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const outputsData = calculateValuation(inputs);
      updateScenario.mutate({
        scenarioId: activeScenarioId,
        inputs: inputs as unknown as Record<string, unknown>,
        outputs: outputsData as unknown as Record<string, unknown>,
      });
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, activeScenarioId]);

  // ── Computed outputs ──
  const outputs = useMemo(() => calculateValuation(inputs), [inputs]);

  // ── Scenario CRUD handlers ──
  const handleCreateScenario = useCallback(() => {
    const outputsData = calculateValuation(inputs);
    createScenario.mutate(
      {
        modelName: `Scenario ${scenarios.length + 1}`,
        inputs: inputs as unknown as Record<string, unknown>,
        outputs: outputsData as unknown as Record<string, unknown>,
      },
      {
        onSuccess: (data: any) => {
          setActiveScenarioId(data.id);
          setScenarioName(data.modelName || "New Scenario");
        },
      },
    );
  }, [inputs, scenarios.length, createScenario]);

  const handleLoadScenario = useCallback(
    (scenarioId: string) => {
      const scenario = scenarios.find((s) => s.id === scenarioId);
      if (!scenario) return;
      setActiveScenarioId(scenario.id);
      setInputs(scenario.inputs as unknown as ValuationInputs);
      setScenarioName(scenario.modelName || "Untitled");
      setCommentary(null);
    },
    [scenarios],
  );

  const handleDeleteScenario = useCallback(() => {
    if (!activeScenarioId) return;
    deleteScenario.mutate(activeScenarioId, {
      onSuccess: () => {
        setActiveScenarioId(null);
        setInputs(DEFAULT_INPUTS);
        setScenarioName("Base Case");
      },
    });
  }, [activeScenarioId, deleteScenario]);

  const handleSaveAsNew = useCallback(() => {
    const outputsData = calculateValuation(inputs);
    createScenario.mutate(
      {
        modelName: scenarioName + " (copy)",
        inputs: inputs as unknown as Record<string, unknown>,
        outputs: outputsData as unknown as Record<string, unknown>,
      },
      {
        onSuccess: (data: any) => {
          setActiveScenarioId(data.id);
          setScenarioName(data.modelName || "Copy");
        },
      },
    );
  }, [inputs, scenarioName, createScenario]);

  const handleRenameScenario = useCallback(() => {
    if (!activeScenarioId) return;
    updateScenario.mutate({
      scenarioId: activeScenarioId,
      modelName: scenarioName,
    });
    setIsEditingName(false);
  }, [activeScenarioId, scenarioName, updateScenario]);

  // Reset handler
  const resetInputs = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
    setCommentary(null);
    setActiveScenarioId(null);
    setScenarioName("Base Case");
  }, []);

  // AI Commentary
  const companyName = opportunity.title || "Target Company";
  const aiCommentary = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/valuation-commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          modelOutputs: {
            enterprise_value: outputs.deal.enterprise_value,
            equity_check: outputs.deal.equity_check,
            bank_debt: outputs.deal.bank_debt,
            seller_note: outputs.deal.seller_note,
            entry_multiple: inputs.entry_multiple,
            exit_multiple: inputs.exit_multiple,
            exit_year: inputs.exit_year,
            adjusted_ebitda: outputs.cashFlow.adjusted_ebitda,
            dscr: outputs.cashFlow.dscr === Infinity ? 0 : outputs.cashFlow.dscr,
            after_tax_cash_flow: outputs.cashFlow.after_tax_cash_flow,
            moic: outputs.exit.moic,
            irr: outputs.exit.irr,
            revenue: inputs.target_revenue,
            revenue_growth_rate: inputs.revenue_growth_rate,
            ebitda_margin: inputs.target_ebitda_margin,
            valuation_method: inputs.valuation_method ?? "ebitda",
            exit_valuation_method: inputs.exit_valuation_method ?? "ebitda",
            implied_ebitda_multiple: (inputs.valuation_method ?? "ebitda") === "revenue" && inputs.target_ebitda > 0
              ? outputs.deal.enterprise_value / inputs.target_ebitda : undefined,
            implied_revenue_multiple: (inputs.valuation_method ?? "ebitda") === "ebitda" && inputs.target_revenue > 0
              ? outputs.deal.enterprise_value / inputs.target_revenue : undefined,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to get AI commentary");
      const data = await res.json();
      return data.commentary as ValuationCommentary;
    },
    onSuccess: (data) => setCommentary(data),
  });

  // Capital structure validation
  const capStructureTotal = inputs.equity_pct + inputs.bank_debt_pct + inputs.seller_note_pct;
  const capStructureValid = Math.abs(capStructureTotal - 1.0) < 0.01;

  return (
    <div className="space-y-6">
      {/* Sub-tab toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setSubTab("model")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            subTab === "model"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Model
        </button>
        <button
          onClick={() => setSubTab("compare")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            subTab === "compare"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Compare
        </button>
      </div>

      {subTab === "compare" && (
        <ScenarioComparisonView
          opportunityId={opportunityId}
          scenarios={scenarios}
          isLoading={scenariosLoading}
        />
      )}

      {subTab === "model" && (<>
      {/* ── Scenario + Year Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Scenario Selector */}
        <div className="flex items-center gap-2">
          <select
            value={activeScenarioId || ""}
            onChange={(e) => e.target.value ? handleLoadScenario(e.target.value) : resetInputs()}
            className="rounded-md border bg-transparent px-3 py-1.5 text-sm"
          >
            <option value="">New scenario...</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.modelName || "Untitled"}
              </option>
            ))}
          </select>

          {/* Scenario name (editable) */}
          {activeScenarioId && (
            isEditingName ? (
              <div className="flex items-center gap-1">
                <Input
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  onBlur={handleRenameScenario}
                  onKeyDown={(e) => e.key === "Enter" && handleRenameScenario()}
                  className="h-7 w-40 text-sm"
                  autoFocus
                />
              </div>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                title="Click to rename"
              >
                {scenarioName}
              </button>
            )
          )}
        </div>

        {/* Scenario Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Year Selector (only if financial periods exist) */}
          {annualPeriods.length > 0 && (
            <select
              value={yearSelection}
              onChange={(e) => handleYearChange(e.target.value as YearSelection)}
              className="rounded-md border bg-transparent px-2 py-1.5 text-xs"
              title="Pre-fill from financial data"
            >
              <option value="most_recent">Most Recent Year</option>
              <option value="weighted">Weighted Average</option>
              <option value="average">Simple Average</option>
              <optgroup label="Specific Years">
                {annualPeriods.map((p) => (
                  <option key={p.id} value={String((p as PeriodSummary).year)}>
                    {(p as PeriodSummary).year}
                  </option>
                ))}
              </optgroup>
            </select>
          )}

          <button
            onClick={handleCreateScenario}
            disabled={createScenario.isPending}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-50"
            title="Save as new scenario"
          >
            <Plus className="h-3 w-3" />
            New
          </button>

          {activeScenarioId && (
            <button
              onClick={handleSaveAsNew}
              disabled={createScenario.isPending}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-50"
              title="Duplicate this scenario"
            >
              <Save className="h-3 w-3" />
              Duplicate
            </button>
          )}

          {activeScenarioId && (
            <button
              onClick={handleDeleteScenario}
              disabled={deleteScenario.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              title="Delete this scenario"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}

          <button
            onClick={() => aiCommentary.mutate()}
            disabled={aiCommentary.isPending || ((inputs.valuation_method ?? "ebitda") === "revenue" ? inputs.target_revenue === 0 : inputs.target_ebitda === 0)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {aiCommentary.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            AI
          </button>

          <button
            onClick={resetInputs}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ── Financial data updated banner ── */}
      {financialsUpdatedBanner && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Financial data has been updated.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshFromFinancials}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Refresh from latest financials
            </button>
            <button
              onClick={() => setFinancialsUpdatedBanner(false)}
              className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
            >
              <span className="sr-only">Dismiss</span>
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Auto-save indicator ── */}
      {activeScenarioId && updateScenario.isPending && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </div>
      )}

      {/* ── Main Grid: Inputs (left) + Outputs (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Inputs */}
        <div className="lg:col-span-1 space-y-4">
          {/* Target Company */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Target Company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <NumberField
                label="Revenue"
                value={inputs.target_revenue}
                onChange={(v) => update("target_revenue", v)}
                prefix="$"
              />
              <NumberField
                label="EBITDA / SDE"
                value={inputs.target_ebitda}
                onChange={(v) => update("target_ebitda", v)}
                prefix="$"
              />
              <div className="text-xs text-muted-foreground">
                Margin: {fmtPct(inputs.target_ebitda_margin)}
              </div>
              <SliderField
                label="Revenue Growth Rate"
                value={inputs.revenue_growth_rate}
                onChange={(v) => update("revenue_growth_rate", v)}
                min={0}
                max={0.3}
                step={0.01}
                format={fmtPct}
              />
            </CardContent>
          </Card>

          {/* Valuation Multiple */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Valuation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Method toggle */}
              <div className="flex rounded-md border bg-muted/30 p-0.5">
                <button
                  onClick={() => update("valuation_method", "ebitda")}
                  className={`flex-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                    (inputs.valuation_method ?? "ebitda") === "ebitda"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  EBITDA Multiple
                </button>
                <button
                  onClick={() => update("valuation_method", "revenue")}
                  className={`flex-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                    (inputs.valuation_method ?? "ebitda") === "revenue"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Revenue Multiple
                </button>
              </div>

              {/* Revenue method warning when no revenue data */}
              {(inputs.valuation_method ?? "ebitda") === "revenue" && inputs.target_revenue === 0 && (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Enter revenue above to use revenue multiples
                </div>
              )}

              <SliderField
                label={(inputs.valuation_method ?? "ebitda") === "revenue" ? "Revenue Multiple" : "Entry Multiple"}
                value={inputs.entry_multiple}
                onChange={(v) => update("entry_multiple", v)}
                min={(inputs.valuation_method ?? "ebitda") === "revenue" ? 0.3 : 2.0}
                max={(inputs.valuation_method ?? "ebitda") === "revenue" ? 3.0 : 8.0}
                step={(inputs.valuation_method ?? "ebitda") === "revenue" ? 0.1 : 0.25}
                format={fmtX}
              />
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium">
                Enterprise Value: {fmt(outputs.deal.enterprise_value)}
              </div>

              {/* Implied counter-multiple for sanity checking */}
              {(inputs.valuation_method ?? "ebitda") === "revenue" && inputs.target_ebitda > 0 && outputs.deal.enterprise_value > 0 && (
                <div className="text-xs text-muted-foreground">
                  Implied EBITDA Multiple: {fmtX(outputs.deal.enterprise_value / inputs.target_ebitda)}
                </div>
              )}
              {(inputs.valuation_method ?? "ebitda") === "ebitda" && inputs.target_revenue > 0 && outputs.deal.enterprise_value > 0 && (
                <div className="text-xs text-muted-foreground">
                  Implied Revenue Multiple: {fmtX(outputs.deal.enterprise_value / inputs.target_revenue)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Capital Structure */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                Capital Structure
                {!capStructureValid && (
                  <span className="text-xs text-amber-500 font-normal flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {fmtPct(capStructureTotal)} total
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SliderField
                label="Equity %"
                value={inputs.equity_pct}
                onChange={(v) => update("equity_pct", v)}
                min={0.10}
                max={0.50}
                step={0.05}
                format={fmtPct}
              />
              <SliderField
                label="Bank Debt %"
                value={inputs.bank_debt_pct}
                onChange={(v) => update("bank_debt_pct", v)}
                min={0}
                max={0.80}
                step={0.05}
                format={fmtPct}
              />
              <SliderField
                label="Seller Note %"
                value={inputs.seller_note_pct}
                onChange={(v) => update("seller_note_pct", v)}
                min={0}
                max={0.30}
                step={0.05}
                format={fmtPct}
              />

              {/* Stacked bar */}
              <div className="h-3 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 transition-all" style={{ width: `${inputs.equity_pct * 100}%` }} />
                <div className="bg-blue-500 transition-all" style={{ width: `${inputs.bank_debt_pct * 100}%` }} />
                <div className="bg-amber-500 transition-all" style={{ width: `${inputs.seller_note_pct * 100}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Equity</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Bank</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Seller</span>
              </div>

              <SliderField label="Bank Rate" value={inputs.bank_interest_rate} onChange={(v) => update("bank_interest_rate", v)} min={0.05} max={0.15} step={0.005} format={fmtPct} />
              <SliderField label="Bank Term (yrs)" value={inputs.bank_term_years} onChange={(v) => update("bank_term_years", v)} min={5} max={25} step={1} format={(v) => `${v}`} />
              <SliderField label="Seller Note Rate" value={inputs.seller_note_rate} onChange={(v) => update("seller_note_rate", v)} min={0} max={0.12} step={0.005} format={fmtPct} />
              <SliderField label="Seller Note Term (yrs)" value={inputs.seller_note_term} onChange={(v) => update("seller_note_term", v)} min={1} max={10} step={1} format={(v) => `${v}`} />
            </CardContent>
          </Card>

          {/* Operating Assumptions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Operating Assumptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <NumberField label="Owner Salary" value={inputs.owner_salary} onChange={(v) => update("owner_salary", v)} prefix="$" />
              <NumberField label="Owner Excess Comp (Add-back)" value={inputs.existing_owner_excess_comp} onChange={(v) => update("existing_owner_excess_comp", v)} prefix="$" />
              <NumberField label="One-time Adjustments" value={inputs.one_time_adjustments} onChange={(v) => update("one_time_adjustments", v)} prefix="$" />
              <NumberField label="Annual Capex" value={inputs.capex_annual} onChange={(v) => update("capex_annual", v)} prefix="$" />
              <SliderField label="Tax Rate" value={inputs.tax_rate} onChange={(v) => update("tax_rate", v)} min={0.10} max={0.40} step={0.01} format={fmtPct} />
            </CardContent>
          </Card>

          {/* Synergy */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Synergy / Growth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <NumberField label="Y2 Bolt-on Revenue" value={inputs.year_2_bolt_on_revenue} onChange={(v) => update("year_2_bolt_on_revenue", v)} prefix="$" />
              <NumberField label="Y2 Bolt-on Cost (EV)" value={inputs.year_2_bolt_on_cost} onChange={(v) => update("year_2_bolt_on_cost", v)} prefix="$" />
              <NumberField label="SG&A Savings" value={inputs.synergy_sg_a_savings} onChange={(v) => update("synergy_sg_a_savings", v)} prefix="$" />
              <NumberField label="Procurement Savings" value={inputs.synergy_procurement} onChange={(v) => update("synergy_procurement", v)} prefix="$" />
              <SliderField label="Cross-sell Uplift" value={inputs.synergy_cross_sell_pct} onChange={(v) => update("synergy_cross_sell_pct", v)} min={0} max={0.25} step={0.01} format={fmtPct} />
            </CardContent>
          </Card>

          {/* Exit */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Exit Assumptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SliderField label="Exit Year" value={inputs.exit_year} onChange={(v) => update("exit_year", v)} min={3} max={10} step={1} format={(v) => `Year ${v}`} />

              {/* Exit method toggle */}
              <div className="flex rounded-md border bg-muted/30 p-0.5">
                <button
                  onClick={() => update("exit_valuation_method", "ebitda")}
                  className={`flex-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                    (inputs.exit_valuation_method ?? "ebitda") === "ebitda"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  EBITDA
                </button>
                <button
                  onClick={() => update("exit_valuation_method", "revenue")}
                  className={`flex-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                    (inputs.exit_valuation_method ?? "ebitda") === "revenue"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Revenue
                </button>
              </div>

              <SliderField
                label={(inputs.exit_valuation_method ?? "ebitda") === "revenue" ? "Exit Revenue Multiple" : "Exit EBITDA Multiple"}
                value={inputs.exit_multiple}
                onChange={(v) => update("exit_multiple", v)}
                min={(inputs.exit_valuation_method ?? "ebitda") === "revenue" ? 0.5 : 4.0}
                max={(inputs.exit_valuation_method ?? "ebitda") === "revenue" ? 4.0 : 14.0}
                step={(inputs.exit_valuation_method ?? "ebitda") === "revenue" ? 0.1 : 0.5}
                format={fmtX}
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMNS: Outputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              label="MOIC"
              value={fmtX(outputs.exit.moic)}
              subtext={`at Year ${inputs.exit_year}`}
              color={outputs.exit.moic >= 3 ? "emerald" : outputs.exit.moic >= 2 ? "blue" : "amber"}
            />
            <KPICard
              label="IRR"
              value={outputs.exit.irr != null ? fmtPct(outputs.exit.irr) : "N/A"}
              subtext="annualized"
              color={
                outputs.exit.irr != null && outputs.exit.irr >= 0.25
                  ? "emerald"
                  : outputs.exit.irr != null && outputs.exit.irr >= 0.15
                    ? "blue"
                    : "amber"
              }
            />
            <KPICard
              label="DSCR"
              value={outputs.cashFlow.dscr === Infinity ? "N/A" : `${outputs.cashFlow.dscr.toFixed(2)}x`}
              subtext={outputs.cashFlow.dscr >= 1.25 ? "Healthy" : outputs.cashFlow.dscr >= 1.0 ? "Tight" : "Negative"}
              color={outputs.cashFlow.dscr >= 1.25 ? "emerald" : outputs.cashFlow.dscr >= 1.0 ? "amber" : "red"}
            />
            <KPICard
              label="Equity Check"
              value={fmtK(outputs.deal.equity_check)}
              subtext={fmtPct(inputs.equity_pct)}
              color="blue"
            />
          </div>

          {/* Deal Structure + Debt Service */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Deal Structure
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <Row label="Enterprise Value" value={fmt(outputs.deal.enterprise_value)} bold />
                  <Row label="Equity" value={fmt(outputs.deal.equity_check)} />
                  <Row label="Bank Debt" value={fmt(outputs.deal.bank_debt)} />
                  <Row label="Seller Note" value={fmt(outputs.deal.seller_note)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Annual Debt Service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <Row label="Bank Payment" value={`${fmt(outputs.debt.bank_annual_payment)}/yr (${fmt(outputs.debt.bank_monthly_payment)}/mo)`} />
                  <Row label="Seller Payment" value={`${fmt(outputs.debt.seller_annual_payment)}/yr (${fmt(outputs.debt.seller_monthly_payment)}/mo)`} />
                  <Row label="Total Debt Service" value={`${fmt(outputs.debt.total_annual_debt_service)}/yr`} bold />
                  <Row
                    label="DSCR"
                    value={outputs.cashFlow.dscr === Infinity ? "N/A" : `${outputs.cashFlow.dscr.toFixed(2)}x`}
                    badge={outputs.cashFlow.dscr >= 1.25 ? "good" : outputs.cashFlow.dscr >= 1.0 ? "warn" : "bad"}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Year 1 Cash Flow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <StatBox label="Adj. EBITDA" value={fmtK(outputs.cashFlow.adjusted_ebitda)} />
                <StatBox label="Pre-Tax CF" value={fmtK(outputs.cashFlow.pre_tax_cash_flow)} />
                <StatBox label="After-Tax CF" value={fmtK(outputs.cashFlow.after_tax_cash_flow)} />
                <StatBox
                  label="Cash-on-Cash"
                  value={outputs.deal.equity_check > 0 ? fmtPct(outputs.cashFlow.after_tax_cash_flow / outputs.deal.equity_check) : "N/A"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Exit Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowRight className="h-4 w-4" /> Exit Analysis @ Year {inputs.exit_year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <StatBox label="Exit Revenue" value={fmtK(outputs.exit.exit_revenue)} />
                <StatBox label="Exit EBITDA" value={fmtK(outputs.exit.exit_ebitda)} />
                <StatBox label={`Exit EV @ ${fmtX(inputs.exit_multiple)} ${(inputs.exit_valuation_method ?? "ebitda") === "revenue" ? "Revenue" : "EBITDA"}`} value={fmtK(outputs.exit.exit_ev)} />
                <StatBox label="Less Remaining Debt" value={`(${fmtK(outputs.exit.remaining_debt_at_exit)})`} />
                <StatBox label="Equity to Buyer" value={fmtK(outputs.exit.equity_to_buyer)} />
                <StatBox label="+ Cumulative FCF" value={fmtK(outputs.exit.cumulative_fcf)} />
              </div>
              <div className="mt-4 flex items-center gap-4 rounded-md bg-muted/50 px-4 py-3">
                <div>
                  <div className="text-xs text-muted-foreground">Total Return</div>
                  <div className="text-lg font-bold">{fmtK(outputs.exit.total_return)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">MOIC</div>
                  <div className="text-lg font-bold">{fmtX(outputs.exit.moic)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">IRR</div>
                  <div className="text-lg font-bold">{outputs.exit.irr != null ? fmtPct(outputs.exit.irr) : "N/A"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Projection Table */}
          <Card>
            <CardHeader className="pb-3">
              <button onClick={() => setShowProjection(!showProjection)} className="flex w-full items-center justify-between">
                <CardTitle className="text-sm">Projection Table</CardTitle>
                {showProjection ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
            </CardHeader>
            {showProjection && (
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-3">Year</th>
                        <th className="text-right py-2 px-2">Revenue</th>
                        <th className="text-right py-2 px-2">EBITDA</th>
                        <th className="text-right py-2 px-2">Adj. EBITDA</th>
                        <th className="text-right py-2 px-2">FCF</th>
                        <th className="text-right py-2 px-2">Cum FCF</th>
                        <th className="text-right py-2 px-2">Debt Bal</th>
                        <th className="text-right py-2 px-2">Equity Val</th>
                        <th className="text-right py-2 pl-2">MOIC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outputs.projection
                        .filter((p) => p.year <= Math.max(inputs.exit_year, 7))
                        .map((p) => (
                          <tr key={p.year} className={`border-b border-border/50 ${p.year === inputs.exit_year ? "bg-primary/5 font-medium" : ""}`}>
                            <td className="py-1.5 pr-3">{p.year}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.revenue)}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.ebitda)}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.adjusted_ebitda)}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.free_cash_flow)}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.cumulative_fcf)}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.remaining_debt)}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.equity_value)}</td>
                            <td className="text-right py-1.5 pl-2">{fmtX(p.moic)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>

          {/* AI Commentary */}
          {(commentary || aiCommentary.isPending) && (
            <AICommentaryPanel commentary={commentary} isLoading={aiCommentary.isPending} />
          )}

          {/* Sensitivity Analysis */}
          <SensitivitySection inputs={inputs} outputs={outputs} show={showSensitivity} onToggle={() => setShowSensitivity(!showSensitivity)} />
        </div>
      </div>
      </>)}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components (same as standalone page)
// ─────────────────────────────────────────────

function AICommentaryPanel({ commentary, isLoading }: { commentary: ValuationCommentary | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm">Generating AI commentary on your model...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!commentary) return null;

  const ratingColors: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    B: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    C: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    D: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    F: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Commentary
          <span className={`ml-auto rounded-full px-3 py-0.5 text-lg font-bold ${ratingColors[commentary.deal_rating] ?? ""}`}>
            {commentary.deal_rating}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Key Insight</h4>
          <p className="text-sm">{commentary.key_insight}</p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Risk Assessment</h4>
          <p className="text-sm">{commentary.risk_adjusted_assessment}</p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Market Context</h4>
          <p className="text-sm">{commentary.comparable_context}</p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Structure Optimization</h4>
          <p className="text-sm">{commentary.structure_optimization}</p>
        </div>
        {commentary.negotiation_leverage_points.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Negotiation Leverage</h4>
            <ul className="text-sm space-y-1">
              {commentary.negotiation_leverage_points.map((p, i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>{p}</span></li>
              ))}
            </ul>
          </div>
        )}
        {commentary.sensitivity_warnings.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" /> Sensitivity Warnings
            </h4>
            <ul className="text-sm space-y-1">
              {commentary.sensitivity_warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>{w}</span></li>
              ))}
            </ul>
          </div>
        )}
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Recommendation</h4>
          <p className="text-sm font-medium">{commentary.recommendation}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SensitivitySection({ inputs, outputs, show, onToggle }: { inputs: ValuationInputs; outputs: ValuationOutputs; show: boolean; onToggle: () => void }) {
  const entryMethod = inputs.valuation_method ?? "ebitda";
  const exitMethod = inputs.exit_valuation_method ?? "ebitda";

  const entryVsExit = useMemo(() => {
    if (!show) return null;
    // Select method-appropriate ranges for entry and exit multiples
    const entryRange = entryMethod === "revenue"
      ? [0.5, 0.75, 1.0, 1.25, 1.5]
      : [3.0, 3.5, 4.0, 4.5, 5.0];
    const exitRange = exitMethod === "revenue"
      ? [0.75, 1.0, 1.25, 1.5, 2.0]
      : [6.0, 7.0, 8.0, 9.0, 10.0];
    return generateSensitivityTable(inputs, "entry_multiple", entryRange, "exit_multiple", exitRange, (o) => o.exit.moic);
  }, [inputs, show, entryMethod, exitMethod]);

  const marginVsGrowth = useMemo(() => {
    if (!show) return null;
    const baseMargin = inputs.target_ebitda_margin;
    const margins = [Math.max(0.08, baseMargin - 0.06), Math.max(0.10, baseMargin - 0.03), baseMargin, baseMargin + 0.03, baseMargin + 0.06];
    return generateSensitivityTable(inputs, "target_ebitda_margin", margins, "revenue_growth_rate", [0.03, 0.05, 0.07, 0.10, 0.15], (o) => {
      const yr5 = o.projection.find((p) => p.year === 5);
      return yr5?.free_cash_flow ?? 0;
    });
  }, [inputs, show]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <button onClick={onToggle} className="flex w-full items-center justify-between">
          <CardTitle className="text-sm">Sensitivity Analysis</CardTitle>
          {show ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      {show && (
        <CardContent className="space-y-6">
          {entryVsExit && (
            <div>
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">{entryMethod === "revenue" ? "Revenue" : "EBITDA"} Entry vs {exitMethod === "revenue" ? "Revenue" : "EBITDA"} Exit Multiple (MOIC)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-3 text-left text-muted-foreground">Entry \ Exit</th>
                      {entryVsExit.cols.map((c) => (<th key={c} className="py-2 px-2 text-right text-muted-foreground">{fmtX(parseFloat(c))}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {entryVsExit.data.map((row, ri) => (
                      <tr key={ri} className="border-b border-border/50">
                        <td className="py-1.5 pr-3 font-medium">{fmtX(parseFloat(entryVsExit.rows[ri]))}</td>
                        {row.map((val, ci) => (
                          <td key={ci} className={`py-1.5 px-2 text-right ${val >= 3 ? "text-emerald-600 dark:text-emerald-400" : val >= 2 ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"} ${entryVsExit.rows[ri] === String(inputs.entry_multiple) && entryVsExit.cols[ci] === String(inputs.exit_multiple) ? "font-bold bg-primary/10 rounded" : ""}`}>
                            {fmtX(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {marginVsGrowth && (
            <div>
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">EBITDA Margin vs Revenue Growth (Year 5 FCF)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-3 text-left text-muted-foreground">Margin \ Growth</th>
                      {marginVsGrowth.cols.map((c) => (<th key={c} className="py-2 px-2 text-right text-muted-foreground">{fmtPct(parseFloat(c))}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {marginVsGrowth.data.map((row, ri) => (
                      <tr key={ri} className="border-b border-border/50">
                        <td className="py-1.5 pr-3 font-medium">{fmtPct(parseFloat(marginVsGrowth.rows[ri]))}</td>
                        {row.map((val, ci) => (<td key={ci} className="py-1.5 px-2 text-right">{fmtK(val)}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────
// Shared Field Components
// ─────────────────────────────────────────────

function NumberField({ label, value, onChange, prefix }: { label: string; value: number; onChange: (v: number) => void; prefix?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
        <Input type="number" value={value || ""} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className={`h-8 text-sm ${prefix ? "pl-6" : ""}`} />
      </div>
    </div>
  );
}

function SliderField({ label, value, onChange, min, max, step, format }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format: (v: number) => string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="text-xs font-medium">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary" />
    </div>
  );
}

function Row({ label, value, bold, badge }: { label: string; value: string; bold?: boolean; badge?: "good" | "warn" | "bad" }) {
  return (
    <div className={`flex justify-between ${bold ? "font-medium" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        {value}
        {badge === "good" && <CheckCircle className="h-3 w-3 text-emerald-500" />}
        {badge === "warn" && <AlertTriangle className="h-3 w-3 text-amber-500" />}
        {badge === "bad" && <AlertTriangle className="h-3 w-3 text-red-500" />}
      </span>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function KPICard({ label, value, subtext, color }: { label: string; value: string; subtext: string; color: "emerald" | "blue" | "amber" | "red" }) {
  const borderColor = { emerald: "border-emerald-500", blue: "border-blue-500", amber: "border-amber-500", red: "border-red-500" }[color];
  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="py-3 px-4">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
        <div className="text-[10px] text-muted-foreground">{subtext}</div>
      </CardContent>
    </Card>
  );
}
