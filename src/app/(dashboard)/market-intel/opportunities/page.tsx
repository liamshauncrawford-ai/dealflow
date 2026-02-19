"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Cable, Search, DollarSign } from "lucide-react";
import { useCablingOpportunities, useMarketIntelStats } from "@/hooks/use-market-intel";
import { CABLING_STATUSES, type CablingStatusKey } from "@/lib/market-intel-constants";
import { cn } from "@/lib/utils";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export default function CablingPipelinePage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), pageSize: "25" };
  if (search) params.search = search;
  if (status) params.status = status;

  const { data, isLoading } = useCablingOpportunities(params);
  const { data: stats } = useMarketIntelStats();
  const opportunities = data?.opportunities ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cabling Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Track cabling opportunities from identification through completion
          </p>
        </div>
        <Link
          href="/market-intel/opportunities/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Opportunity
        </Link>
      </div>

      {/* Pipeline Summary Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Active Opportunities"
            value={String(stats.activeCablingOpps ?? 0)}
            icon={<Cable className="h-5 w-5" />}
          />
          <SummaryCard
            label="Total Pipeline Value"
            value={formatCurrency(stats.totalPipelineValue ?? 0)}
            icon={<DollarSign className="h-5 w-5" />}
          />
          <SummaryCard
            label="Awarded Value"
            value={formatCurrency(stats.awardedValue ?? 0)}
            icon={<DollarSign className="h-5 w-5" />}
            accent
          />
          <SummaryCard
            label="Under Construction"
            value={String(stats.facilitiesUnderConstruction ?? 0)}
            subtitle="DC facilities"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">All Statuses</option>
          {Object.entries(CABLING_STATUSES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Opportunity</th>
                <th className="px-4 py-3 text-left font-medium">Operator</th>
                <th className="px-4 py-3 text-left font-medium">GC</th>
                <th className="px-4 py-3 text-left font-medium">Facility</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Est. Value</th>
                <th className="px-4 py-3 text-right font-medium">Awarded</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3" colSpan={7}>
                      <div className="h-5 w-full animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : opportunities.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                    <Cable className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No cabling opportunities found
                  </td>
                </tr>
              ) : (
                opportunities.map((opp: Record<string, unknown>) => {
                  const statusConfig = opp.status ? CABLING_STATUSES[opp.status as CablingStatusKey] : null;
                  const operator = opp.operator as Record<string, unknown> | null;
                  const gc = opp.gc as Record<string, unknown> | null;
                  const facility = opp.facility as Record<string, unknown> | null;

                  return (
                    <tr key={opp.id as string} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/market-intel/opportunities/${opp.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {opp.name as string}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {operator ? (
                          <Link href={`/market-intel/operators/${operator.id}`} className="hover:text-primary hover:underline">
                            {operator.name as string}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {gc ? (
                          <Link href={`/market-intel/gcs/${gc.id}`} className="hover:text-primary hover:underline">
                            {gc.name as string}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {(facility?.facilityName as string) ?? "—"}
                        {(facility?.capacityMW as number) ? ` (${facility!.capacityMW} MW)` : ""}
                      </td>
                      <td className="px-4 py-3">
                        {statusConfig && (
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusConfig.badge)}>
                            {statusConfig.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {opp.estimatedValue ? formatCurrency(opp.estimatedValue as number) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {opp.awardedValue ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatCurrency(opp.awardedValue as number)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({data?.total ?? 0} opportunities)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
  icon,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", accent && "text-emerald-600 dark:text-emerald-400")}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
