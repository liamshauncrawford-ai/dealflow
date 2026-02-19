"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, HardHat, Search } from "lucide-react";
import { useGCs } from "@/hooks/use-market-intel";
import {
  GC_PRIORITIES,
  SUB_QUALIFICATION_STATUS,
  GC_DC_EXPERIENCE,
  type GCPriorityKey,
} from "@/lib/market-intel-constants";
import { cn } from "@/lib/utils";

export default function GCsPage() {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [subStatus, setSubStatus] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), pageSize: "25" };
  if (search) params.search = search;
  if (priority) params.priority = priority;
  if (subStatus) params.subQualificationStatus = subStatus;

  const { data, isLoading } = useGCs(params);
  const gcs = data?.gcs ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GC Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Track general contractors, sub-qualification status, and relationship progress
          </p>
        </div>
        <Link
          href="/market-intel/gcs/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add GC
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search GCs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">All Priorities</option>
          {Object.entries(GC_PRIORITIES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <select
          value={subStatus}
          onChange={(e) => { setSubStatus(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">All Qualification</option>
          {Object.entries(SUB_QUALIFICATION_STATUS).map(([key, val]) => (
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
                <th className="px-4 py-3 text-left font-medium">GC Name</th>
                <th className="px-4 py-3 text-left font-medium">Priority</th>
                <th className="px-4 py-3 text-left font-medium">DC Experience</th>
                <th className="px-4 py-3 text-left font-medium">Sub Status</th>
                <th className="px-4 py-3 text-left font-medium">Relationship</th>
                <th className="px-4 py-3 text-center font-medium">Facilities</th>
                <th className="px-4 py-3 text-right font-medium">Est. Annual Opp</th>
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
              ) : gcs.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                    <HardHat className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No general contractors found
                  </td>
                </tr>
              ) : (
                gcs.map((gc: Record<string, unknown>) => {
                  const prioConfig = gc.priority ? GC_PRIORITIES[gc.priority as GCPriorityKey] : null;
                  const subConfig = gc.subQualificationStatus
                    ? SUB_QUALIFICATION_STATUS[gc.subQualificationStatus as keyof typeof SUB_QUALIFICATION_STATUS]
                    : null;
                  const expConfig = gc.dcExperienceLevel
                    ? GC_DC_EXPERIENCE[gc.dcExperienceLevel as keyof typeof GC_DC_EXPERIENCE]
                    : null;
                  const relConfig = gc.relationshipStatus
                    ? { label: (gc.relationshipStatus as string).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }
                    : null;
                  const counts = gc._count as { facilities: number; cablingOpportunities: number };

                  return (
                    <tr key={gc.id as string} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/market-intel/gcs/${gc.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {gc.name as string}
                        </Link>
                        {(gc.coloradoOffice as boolean) && (
                          <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">CO Office</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {prioConfig && (
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", prioConfig.badge)}>
                            {prioConfig.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {expConfig?.label ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {subConfig && (
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", subConfig.badge)}>
                            {subConfig.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {relConfig?.label ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {counts?.facilities ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {gc.estimatedAnnualOpportunity
                          ? `$${((gc.estimatedAnnualOpportunity as number) / 1_000_000).toFixed(1)}M`
                          : "—"}
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
              Page {page} of {totalPages} ({data?.total ?? 0} GCs)
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
