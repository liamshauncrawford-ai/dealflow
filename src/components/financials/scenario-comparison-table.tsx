"use client";

import { AlertTriangle } from "lucide-react";
import type { ValuationInputs, ValuationOutputs } from "@/lib/financial/valuation-engine";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ComparisonScenario {
  id: string;
  name: string;
  color: string;
  inputs: ValuationInputs;
  outputs: ValuationOutputs;
}

interface MetricRow {
  key: string;
  label: string;
  category: string;
  format: "currency" | "multiple" | "percent" | "ratio" | "year";
  getValue: (outputs: ValuationOutputs, inputs: ValuationInputs) => number | null;
  higherIsBetter: boolean;
  warningThreshold?: { value: number; below: boolean; label: string };
}

interface ScenarioComparisonTableProps {
  scenarios: ComparisonScenario[];
}

// ─────────────────────────────────────────────
// Format helpers
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

function formatValue(value: number | null, format: MetricRow["format"]): string {
  if (value === null || value === undefined) return "N/A";
  switch (format) {
    case "currency":
      return fmtK(value);
    case "multiple":
      return fmtX(value);
    case "percent":
      return fmtPct(value);
    case "ratio":
      return `${value.toFixed(2)}x`;
    case "year":
      return `Year ${Math.round(value)}`;
    default:
      return String(value);
  }
}

// ─────────────────────────────────────────────
// Metric row definitions
// ─────────────────────────────────────────────

const METRIC_ROWS: MetricRow[] = [
  // Deal Structure
  {
    key: "ev", label: "Enterprise Value", category: "Deal Structure",
    format: "currency", getValue: (o) => o.deal.enterprise_value, higherIsBetter: false,
  },
  {
    key: "equity", label: "Equity Check", category: "Deal Structure",
    format: "currency", getValue: (o) => o.deal.equity_check, higherIsBetter: false,
  },
  {
    key: "bank_debt", label: "Bank Debt", category: "Deal Structure",
    format: "currency", getValue: (o) => o.deal.bank_debt, higherIsBetter: false,
  },
  {
    key: "seller_note", label: "Seller Note", category: "Deal Structure",
    format: "currency", getValue: (o) => o.deal.seller_note, higherIsBetter: false,
  },
  {
    key: "entry_multiple", label: "Entry Multiple", category: "Deal Structure",
    format: "multiple", getValue: (_o, i) => i.entry_multiple, higherIsBetter: false,
  },

  // Returns
  {
    key: "moic", label: "MOIC", category: "Returns",
    format: "multiple", getValue: (o) => o.exit.moic, higherIsBetter: true,
  },
  {
    key: "irr", label: "IRR", category: "Returns",
    format: "percent", getValue: (o) => o.exit.irr, higherIsBetter: true,
    warningThreshold: { value: 0.15, below: true, label: "Below 15% PE hurdle" },
  },
  {
    key: "coc", label: "Cash-on-Cash Return", category: "Returns",
    format: "percent",
    getValue: (o) => o.deal.equity_check > 0 ? o.cashFlow.after_tax_cash_flow / o.deal.equity_check : 0,
    higherIsBetter: true,
  },

  // Debt Capacity
  {
    key: "dscr", label: "DSCR", category: "Debt Capacity",
    format: "ratio", getValue: (o) => o.cashFlow.dscr === Infinity ? null : o.cashFlow.dscr, higherIsBetter: true,
    warningThreshold: { value: 1.25, below: true, label: "Below SBA 1.25x" },
  },
  {
    key: "debt_service", label: "Total Annual Debt Service", category: "Debt Capacity",
    format: "currency", getValue: (o) => o.debt.total_annual_debt_service, higherIsBetter: false,
  },

  // Cash Flow
  {
    key: "adj_ebitda", label: "Y1 Adjusted EBITDA", category: "Cash Flow",
    format: "currency", getValue: (o) => o.cashFlow.adjusted_ebitda, higherIsBetter: true,
  },
  {
    key: "pretax_cf", label: "Y1 Pre-Tax Cash Flow", category: "Cash Flow",
    format: "currency", getValue: (o) => o.cashFlow.pre_tax_cash_flow, higherIsBetter: true,
  },
  {
    key: "aftertax_cf", label: "Y1 After-Tax Cash Flow", category: "Cash Flow",
    format: "currency", getValue: (o) => o.cashFlow.after_tax_cash_flow, higherIsBetter: true,
  },

  // Exit Analysis
  {
    key: "exit_year", label: "Exit Year", category: "Exit Analysis",
    format: "year", getValue: (_o, i) => i.exit_year, higherIsBetter: false,
  },
  {
    key: "exit_ev", label: "Exit EV", category: "Exit Analysis",
    format: "currency", getValue: (o) => o.exit.exit_ev, higherIsBetter: true,
  },
  {
    key: "remaining_debt", label: "Remaining Debt at Exit", category: "Exit Analysis",
    format: "currency", getValue: (o) => o.exit.remaining_debt_at_exit, higherIsBetter: false,
  },
  {
    key: "equity_to_buyer", label: "Equity to Buyer", category: "Exit Analysis",
    format: "currency", getValue: (o) => o.exit.equity_to_buyer, higherIsBetter: true,
  },
  {
    key: "total_return", label: "Total Return", category: "Exit Analysis",
    format: "currency", getValue: (o) => o.exit.total_return, higherIsBetter: true,
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getBestWorstIndices(values: (number | null)[], higherIsBetter: boolean) {
  const validIndices = values
    .map((v, i) => (v !== null ? i : -1))
    .filter((i) => i !== -1);

  if (validIndices.length < 2) return { bestIdx: -1, worstIdx: -1 };

  let bestIdx = validIndices[0];
  let worstIdx = validIndices[0];

  for (const idx of validIndices) {
    const val = values[idx]!;
    if (higherIsBetter) {
      if (val > values[bestIdx]!) bestIdx = idx;
      if (val < values[worstIdx]!) worstIdx = idx;
    } else {
      if (val < values[bestIdx]!) bestIdx = idx;
      if (val > values[worstIdx]!) worstIdx = idx;
    }
  }

  // Don't highlight if all values are the same
  if (values[bestIdx] === values[worstIdx]) return { bestIdx: -1, worstIdx: -1 };

  return { bestIdx, worstIdx };
}

function formatDelta(a: number | null, b: number | null, format: MetricRow["format"]): string {
  if (a === null || b === null) return "";
  const diff = a - b;
  if (diff === 0) return "--";

  const sign = diff > 0 ? "+" : "";
  switch (format) {
    case "currency":
      return `${sign}${fmtK(diff)}`;
    case "multiple":
      return `${sign}${diff.toFixed(1)}x`;
    case "percent":
      return `${sign}${(diff * 100).toFixed(1)}pp`;
    case "ratio":
      return `${sign}${diff.toFixed(2)}x`;
    case "year":
      return `${sign}${Math.round(diff)}yr`;
    default:
      return `${sign}${diff}`;
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function ScenarioComparisonTable({ scenarios }: ScenarioComparisonTableProps) {
  if (scenarios.length < 2) return null;

  // Group metrics by category
  const categories = METRIC_ROWS.reduce<Record<string, MetricRow[]>>((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row);
    return acc;
  }, {});

  const showDelta = scenarios.length === 2;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Metric</th>
              {scenarios.map((s) => (
                <th key={s.id} className="text-right py-2.5 px-4 font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </div>
                </th>
              ))}
              {showDelta && (
                <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Delta</th>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(categories).map(([category, rows]) => (
              <CategorySection
                key={category}
                category={category}
                rows={rows}
                scenarios={scenarios}
                showDelta={showDelta}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Category section sub-component
// ─────────────────────────────────────────────

function CategorySection({
  category,
  rows,
  scenarios,
  showDelta,
}: {
  category: string;
  rows: MetricRow[];
  scenarios: ComparisonScenario[];
  showDelta: boolean;
}) {
  return (
    <>
      {/* Category header */}
      <tr className="border-t">
        <td
          colSpan={scenarios.length + 1 + (showDelta ? 1 : 0)}
          className="bg-muted/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {category}
        </td>
      </tr>

      {/* Metric rows */}
      {rows.map((metric) => {
        const values = scenarios.map((s) => metric.getValue(s.outputs, s.inputs));
        const { bestIdx, worstIdx } = getBestWorstIndices(values, metric.higherIsBetter);

        return (
          <tr key={metric.key} className="border-b border-border/50">
            <td className="py-2 px-4 text-muted-foreground">{metric.label}</td>
            {values.map((val, i) => {
              const isBest = i === bestIdx;
              const isWorst = i === worstIdx;
              const hasWarning =
                metric.warningThreshold &&
                val !== null &&
                (metric.warningThreshold.below
                  ? val < metric.warningThreshold.value
                  : val > metric.warningThreshold.value);

              return (
                <td
                  key={scenarios[i].id}
                  className={`text-right py-2 px-4 font-medium ${
                    isBest
                      ? "bg-emerald-50 dark:bg-emerald-950/20"
                      : isWorst
                        ? "bg-red-50 dark:bg-red-950/20"
                        : ""
                  }`}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    {hasWarning && (
                      <span title={metric.warningThreshold!.label}>
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      </span>
                    )}
                    {formatValue(val, metric.format)}
                  </div>
                </td>
              );
            })}
            {showDelta && (
              <td className="text-right py-2 px-4 text-muted-foreground text-xs">
                {formatDelta(values[0], values[1], metric.format)}
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}
