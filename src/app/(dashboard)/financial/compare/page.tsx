"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GitCompare,
  Loader2,
  Plus,
  X,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateValuation,
  DEFAULT_INPUTS,
  type ValuationInputs,
  type ValuationOutputs,
} from "@/lib/financial/valuation-engine";
import {
  type ListingSummary,
  buildComparisonInputs,
  formatListingOption,
  ebitdaSourceLabel,
  resolveEbitda,
} from "@/lib/financial/listing-mapper";

interface ComparisonTarget {
  listing: ListingSummary;
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

function buildInputs(listing: ListingSummary): ValuationInputs {
  return buildComparisonInputs(listing, DEFAULT_INPUTS);
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function DealComparisonPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["listings-for-compare"],
    queryFn: async () => {
      const res = await fetch("/api/listings?pageSize=100&sortBy=compositeScore&sortDir=desc&meetsThreshold=false");
      if (!res.ok) return { listings: [] };
      return res.json() as Promise<{ listings: ListingSummary[] }>;
    },
  });

  const targets = useMemo<ComparisonTarget[]>(() => {
    if (!data?.listings) return [];
    return selectedIds
      .map((id) => data.listings.find((l) => l.id === id))
      .filter(Boolean)
      .map((listing) => ({
        listing: listing!,
        outputs: calculateValuation(buildInputs(listing!)),
      }));
  }, [selectedIds, data]);

  const addTarget = (id: string) => {
    if (selectedIds.length >= 4 || selectedIds.includes(id)) return;
    setSelectedIds((prev) => [...prev, id]);
  };

  const removeTarget = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const availableListings = data?.listings.filter((l) => !selectedIds.includes(l.id)) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitCompare className="h-6 w-6" />
          Deal Comparison Matrix
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare 2-4 targets side-by-side across all dimensions
        </p>
      </div>

      {/* Target Selector */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium whitespace-nowrap">
              Targets ({selectedIds.length}/4):
            </label>
            {targets.map((t) => (
              <span
                key={t.listing.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
              >
                {t.listing.businessName || t.listing.title || "Unnamed"}
                <button
                  onClick={() => removeTarget(t.listing.id)}
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
                {availableListings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {formatListingOption(l)}
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
                        key={t.listing.id}
                        className="text-center py-3 px-4 min-w-[160px] font-medium"
                      >
                        {t.listing.businessName || t.listing.title || "Unnamed"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Composite Score"
                    values={targets.map((t) => {
                      const b = scoreBadge(t.listing.compositeScore);
                      return <span className={`font-bold ${b.color}`}>{b.text}</span>;
                    })}
                  />
                  <CompareRow
                    label="Revenue"
                    values={targets.map((t) =>
                      t.listing.revenue ? fmtK(Number(t.listing.revenue)) : "N/A",
                    )}
                    highlight={highlightMax(targets.map((t) => Number(t.listing.revenue) || 0))}
                  />
                  <CompareRow
                    label="Est. EBITDA"
                    values={targets.map((t) => {
                      const ebitda = resolveEbitda(t.listing);
                      return ebitda > 0 ? (
                        <span title={ebitdaSourceLabel(t.listing)}>{fmtK(ebitda)}</span>
                      ) : "N/A";
                    })}
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
                        [t.listing.city, t.listing.state].filter(Boolean).join(", ") || "N/A",
                    )}
                  />
                  <CompareRow
                    label="Established"
                    values={targets.map((t) =>
                      t.listing.established ? `${t.listing.established}` : "N/A",
                    )}
                  />
                  <CompareRow
                    label="Primary Trade"
                    values={targets.map((t) => t.listing.primaryTrade || "N/A")}
                  />
                  <CompareRow
                    label="Certifications"
                    values={targets.map((t) =>
                      t.listing.certifications?.length
                        ? t.listing.certifications.join(", ")
                        : "None",
                    )}
                  />
                  <CompareRow
                    label="Tier"
                    values={targets.map((t) => t.listing.tier || "N/A")}
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
                  <CompareRow
                    label="Thesis Alignment"
                    values={targets.map((t) => {
                      const a = t.listing.thesisAlignment;
                      if (a === "strong")
                        return <span className="text-emerald-600 dark:text-emerald-400 font-medium">Strong</span>;
                      if (a === "moderate")
                        return <span className="text-amber-600 dark:text-amber-400">Moderate</span>;
                      if (a === "weak") return <span className="text-red-500">Weak</span>;
                      return <span className="text-muted-foreground">N/A</span>;
                    })}
                  />
                  <CompareRow
                    label="Enrichment"
                    values={targets.map((t) => {
                      const s = t.listing.enrichmentStatus;
                      if (s === "complete")
                        return <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />;
                      if (s === "in_progress")
                        return <Loader2 className="h-4 w-4 animate-spin text-blue-500 mx-auto" />;
                      return <HelpCircle className="h-4 w-4 text-muted-foreground mx-auto" />;
                    })}
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
          className={`text-center py-2.5 px-4 ${
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
