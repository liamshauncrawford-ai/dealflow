"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Building2, Search, ExternalLink } from "lucide-react";
import { useOperators } from "@/hooks/use-market-intel";
import {
  OPERATOR_TIERS,
  OPERATOR_RELATIONSHIP_STATUS,
  type OperatorTierKey,
} from "@/lib/market-intel-constants";
import { cn } from "@/lib/utils";

export default function OperatorsPage() {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), pageSize: "25" };
  if (search) params.search = search;
  if (tier) params.tier = tier;

  const { data, isLoading } = useOperators(params);
  const operators = data?.operators ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DC Operators</h1>
          <p className="text-sm text-muted-foreground">
            Track data center operators, their facilities, and cabling opportunities
          </p>
        </div>
        <Link
          href="/market-intel/operators/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Operator
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search operators..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={tier}
          onChange={(e) => { setTier(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">All Tiers</option>
          {Object.entries(OPERATOR_TIERS).map(([key, val]) => (
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
                <th className="px-4 py-3 text-left font-medium">Operator</th>
                <th className="px-4 py-3 text-left font-medium">Tier</th>
                <th className="px-4 py-3 text-left font-medium">Relationship</th>
                <th className="px-4 py-3 text-center font-medium">Facilities</th>
                <th className="px-4 py-3 text-center font-medium">Opportunities</th>
                <th className="px-4 py-3 text-right font-medium">Cabling Score</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3" colSpan={6}>
                      <div className="h-5 w-full animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : operators.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                    <Building2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No operators found
                  </td>
                </tr>
              ) : (
                operators.map((op: Record<string, unknown>) => {
                  const tierConfig = op.tier ? OPERATOR_TIERS[op.tier as OperatorTierKey] : null;
                  const relStatus = op.relationshipStatus
                    ? OPERATOR_RELATIONSHIP_STATUS[op.relationshipStatus as keyof typeof OPERATOR_RELATIONSHIP_STATUS]
                    : null;
                  const counts = op._count as { facilities: number; cablingOpportunities: number };

                  return (
                    <tr key={op.id as string} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/market-intel/operators/${op.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {op.name as string}
                        </Link>
                        {(op.parentCompany as string) ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({op.parentCompany as string})
                          </span>
                        ) : null}
                        {(op.hqState as string) ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            • {op.hqState as string}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {tierConfig && (
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", tierConfig.badge)}>
                            {tierConfig.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {relStatus?.label ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums">
                        {counts?.facilities ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums">
                        {counts?.cablingOpportunities ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {op.cablingOpportunityScore ? (
                          <span className="font-mono text-sm font-semibold">
                            {op.cablingOpportunityScore as number}/10
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({data?.total ?? 0} operators)
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
