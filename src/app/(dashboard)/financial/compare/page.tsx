"use client";

import { useState, useMemo } from "react";
import {
  GitCompare,
  Loader2,
  X,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  calculateValuation,
  DEFAULT_INPUTS,
  type ValuationInputs,
  type ValuationOutputs,
} from "@/lib/financial/valuation-engine";
import {
  buildComparisonInputsFromOpportunity,
  formatOpportunityOption,
} from "@/lib/financial/listing-mapper";
import { usePipelineCompanies, type PipelineCompany } from "@/hooks/use-pipeline-companies";

interface ComparisonTarget {
  company: PipelineCompany;
  inputs: ValuationInputs;
  outputs: ValuationOutputs;
}

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

function fmtX(value: number): string {
  return `${value.toFixed(1)}x`;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function scoreBadge(score: number | null): { text: string; color: string } {
  if (score == null) return { text: "N/A", color: "text-muted-foreground" };
  if (score >= 80) return { text: `${score}`, color: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 60) return { text: `${score}`, color: "text-amber-600 dark:text-amber-400" };
  return { text: `${score}`, color: "text-red-600 dark:text-red-400" };
}

function buildInputs(company: PipelineCompany): ValuationInputs {
  return buildComparisonInputsFromOpportunity(company, DEFAULT_INPUTS);
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function DealComparisonPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: pipelineCompanies, isLoading } = usePipelineCompanies();

  const targets = useMemo<ComparisonTarget[]>(() => {
    if (!pipelineCompanies) return [];
    return selectedIds
      .map((id) => pipelineCompanies.find((c) => c.opportunityId === id))
      .filter(Boolean)
      .map((company) => {
        const inputs = buildInputs(company!);
        return {
          company: company!,
          inputs,
          outputs: calculateValuation(inputs),
        };
      });
  }, [selectedIds, pipelineCompanies]);

  const addTarget = (id: string) => {
    if (selectedIds.length >= 4 || selectedIds.includes(id)) return;
    setSelectedIds((prev) => [...prev, id]);
  };

  const removeTarget = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const availableCompanies = pipelineCompanies?.filter((c) => !selectedIds.includes(c.opportunityId)) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deal Comparison Matrix"
        icon={GitCompare}
        description="Compare 2-4 targets side-by-side across all dimensions"
      />

      {/* Target Selector */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium whitespace-nowrap">
              Targets ({selectedIds.length}/4):
            </label>
            {targets.map((t) => (
              <span
                key={t.company.opportunityId}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
              >
                {t.company.title}
                <button
                  onClick={() => removeTarget(t.company.opportunityId)}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {selectedIds.length < 4 && (
              <select
                onChange={(e) => {
                  if (e.target.value) addTarget(e.target.value);
                  e.target.value = "";
                }}
                className="rounded-md border bg-transparent px-3 py-1.5 text-sm"
                value=""
              >
                <option value="">+ Add target...</option>
                {availableCompanies.map((c) => (
                  <option key={c.opportunityId} value={c.opportunityId}>
                    {formatOpportunityOption(c)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && targets.length < 2 && (
        <Card>
          <CardContent className="py-12 text-center">
            <GitCompare className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Select at least 2 targets from your pipeline to compare
            </p>
          </CardContent>
        </Card>
      )}

      {/* Comparison Matrix */}
      {targets.length >= 2 && (
        <Card>
          <CardContent className="py-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 pr-4 min-w-[180px] text-muted-foreground font-medium">
                      Dimension
                    </th>
                    {targets.map((t) => (
                      <th
                        key={t.company.opportunityId}
                        className="text-center py-3 px-4 min-w-[160px] font-medium"
                      >
                        {t.company.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Pipeline Stage"
                    values={targets.map((t) => {
                      const stage = t.company.stage.replace(/_/g, " ");
                      return <span className="capitalize">{stage.toLowerCase()}</span>;
                    })}
                  />
                  <CompareRow
                    label="Composite Score"
                    values={targets.map((t) => {
                      const b = scoreBadge(t.company.listing?.compositeScore ?? null);
                      return <span className={`font-bold ${b.color}`}>{b.text}</span>;
                    })}
                  />
                  <CompareRow
                    label="Revenue"
                    values={targets.map((t) =>
                      t.inputs.target_revenue > 0 ? fmtK(t.inputs.target_revenue) : "N/A",
                    )}
                    highlight={highlightMax(targets.map((t) => t.inputs.target_revenue))}
                  />
                  <CompareRow
                    label="Est. EBITDA"
                    values={targets.map((t) =>
                      t.inputs.target_ebitda > 0 ? fmtK(t.inputs.target_ebitda) : "N/A",
                    )}
                  />
                  <CompareRow
                    label="Est. EV @ 4x"
                    values={targets.map((t) => fmtK(t.outputs.deal.enterprise_value))}
                  />
                  <CompareRow
                    label="Equity Required"
                    values={targets.map((t) => fmtK(t.outputs.deal.equity_check))}
                    highlight={highlightMin(targets.map((t) => t.outputs.deal.equity_check))}
                  />
                  <CompareRow
                    label="Location"
                    values={targets.map(
                      (t) =>
                        [t.company.listing?.city, t.company.listing?.state]
                          .filter(Boolean)
                          .join(", ") || "N/A",
                    )}
                  />
                  <CompareRow
                    label="DSCR @ 4x"
                    values={targets.map((t) => {
                      const dscr = t.outputs.cashFlow.dscr;
                      if (dscr === Infinity) return "N/A";
                      return (
                        <span className="inline-flex items-center gap-1">
                          {fmtX(dscr)}
                          {dscr >= 1.25 ? (
                            <CheckCircle className="h-3 w-3 text-emerald-500" />
                          ) : dscr >= 1.0 ? (
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          )}
                        </span>
                      );
                    })}
                  />
                  <CompareRow
                    label="Est. MOIC @ 7yr"
                    values={targets.map((t) => fmtX(t.outputs.exit.moic))}
                    highlight={highlightMax(targets.map((t) => t.outputs.exit.moic))}
                  />
                  <CompareRow
                    label="Est. IRR"
                    values={targets.map((t) =>
                      t.outputs.exit.irr != null ? fmtPct(t.outputs.exit.irr) : "N/A",
                    )}
                    highlight={highlightMax(
                      targets.map((t) => t.outputs.exit.irr ?? 0),
                    )}
                  />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Comparison Row
// ─────────────────────────────────────────────

function CompareRow({
  label,
  values,
  highlight,
}: {
  label: string;
  values: (string | React.ReactNode)[];
  highlight?: number[];
}) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2.5 pr-4 text-muted-foreground font-medium">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`text-center py-2.5 px-4 tabular-nums ${
            highlight?.includes(i)
              ? "font-bold text-emerald-600 dark:text-emerald-400"
              : ""
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}

/** Returns indices of the max value(s). */
function highlightMax(values: number[]): number[] {
  const max = Math.max(...values);
  if (max <= 0) return [];
  return values.reduce<number[]>((acc, v, i) => (v === max ? [...acc, i] : acc), []);
}

/** Returns indices of the min positive value(s). */
function highlightMin(values: number[]): number[] {
  const positives = values.filter((v) => v > 0);
  if (positives.length === 0) return [];
  const min = Math.min(...positives);
  return values.reduce<number[]>((acc, v, i) => (v === min ? [...acc, i] : acc), []);
}
