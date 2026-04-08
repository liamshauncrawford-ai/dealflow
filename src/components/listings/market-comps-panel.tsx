"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PercentileStats {
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  mean: number;
}

interface CompsResponse {
  stats: {
    count: number;
    confidence: "low" | "moderate" | "high";
    ebitdaMultiple: PercentileStats | null;
    revenueMultiple: PercentileStats | null;
    sdeMultiple: PercentileStats | null;
    dealStructure: {
      avgPctCashAtClose: number | null;
      avgSellerNoteTermYears: number | null;
      pctWithEarnout: number | null;
    };
    volumeByYear: Record<string, number>;
  } | null;
  count: number;
}

interface MarketCompsPanelProps {
  listingId: string;
  targetRank: number | null;
  targetRankLabel: string | null;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const fmtMultiple = (v: number) => `${v.toFixed(1)}x`;
const fmtPct = (v: number) => `${(v * 100).toFixed(0)}%`;

const SIC_CODES_BY_RANK: Record<number, string> = {
  1: "7376, 7379, 7374",
  2: "4813, 7372, 7379",
  3: "7382, 7381, 1731",
  4: "1731, 1799, 1711",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  moderate: "bg-yellow-100 text-yellow-800",
  low: "bg-red-100 text-red-800",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MultipleCard({
  label,
  stats,
}: {
  label: string;
  stats: PercentileStats | null;
}) {
  if (!stats) {
    return (
      <div className="rounded-lg border p-4 text-center">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          {label}
        </div>
        <div className="text-2xl font-bold text-muted-foreground">&mdash;</div>
        <div className="text-xs text-muted-foreground mt-1">No data</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 text-center">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
        {label}
      </div>
      <div className="text-2xl font-bold text-foreground">
        {fmtMultiple(stats.median)}
      </div>
      <div className="text-sm text-muted-foreground mt-1">
        {fmtMultiple(stats.p25)} &ndash; {fmtMultiple(stats.p75)}
      </div>
      <div className="text-xs text-muted-foreground">
        Range: {fmtMultiple(stats.min)} &ndash; {fmtMultiple(stats.max)}
      </div>
    </div>
  );
}

function DealStructureItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

function VolumeByYearBars({
  volumeByYear,
}: {
  volumeByYear: Record<string, number>;
}) {
  const years = Object.keys(volumeByYear)
    .sort()
    .slice(-5);

  if (years.length === 0) return null;

  const maxCount = Math.max(...years.map((y) => volumeByYear[y]));

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Volume by Year
      </div>
      {years.map((year) => {
        const count = volumeByYear[year];
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        return (
          <div key={year} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-10 shrink-0">
              {year}
            </span>
            <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
              <div
                className="h-full rounded bg-gray-400"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums w-8 text-right">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="h-3 w-20 mx-auto bg-muted rounded mb-3" />
            <div className="h-7 w-14 mx-auto bg-muted rounded mb-2" />
            <div className="h-3 w-24 mx-auto bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-4 w-48 bg-muted rounded" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-5 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MarketCompsPanel({
  listingId,
  targetRank,
  targetRankLabel,
}: MarketCompsPanelProps) {
  const { data, isLoading } = useQuery<CompsResponse>({
    queryKey: ["bvr-comps", listingId],
    queryFn: async () => {
      const res = await fetch(`/api/bvr/comps?listingId=${listingId}`);
      if (!res.ok) throw new Error("Failed to fetch comps");
      return res.json();
    },
    enabled: !!targetRank,
  });

  const stats = data?.stats ?? null;

  // Empty state: no rank or no data
  if (!targetRank || (!isLoading && !stats)) {
    const sicCodes = targetRank ? SIC_CODES_BY_RANK[targetRank] : null;
    return (
      <div className="rounded-lg border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">Market Comparables</h3>
        <p className="text-sm text-muted-foreground">
          Import BVR market data to see comparable transactions for this target
          type.
        </p>
        {sicCodes && (
          <p className="text-xs text-muted-foreground mt-2">
            Relevant SIC codes: {sicCodes}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Market Comparables</h3>
        {stats && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                CONFIDENCE_COLORS[stats.confidence] ?? "bg-gray-100 text-gray-800",
              )}
            >
              {stats.confidence}
            </span>
            <span className="text-xs text-muted-foreground">
              {stats.count} txns
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : stats ? (
        <div className="space-y-5">
          {/* Multiples Grid */}
          <div className="grid grid-cols-3 gap-3">
            <MultipleCard label="EBITDA Multiple" stats={stats.ebitdaMultiple} />
            <MultipleCard label="Revenue Multiple" stats={stats.revenueMultiple} />
            <MultipleCard label="SDE Multiple" stats={stats.sdeMultiple} />
          </div>

          {/* Deal Structure Row */}
          <div className="grid grid-cols-3 gap-3 border-t pt-4">
            <DealStructureItem
              label="Avg % Cash at Close"
              value={
                stats.dealStructure.avgPctCashAtClose != null
                  ? fmtPct(stats.dealStructure.avgPctCashAtClose)
                  : null
              }
            />
            <DealStructureItem
              label="Avg Seller Note Term"
              value={
                stats.dealStructure.avgSellerNoteTermYears != null
                  ? `${stats.dealStructure.avgSellerNoteTermYears.toFixed(1)} years`
                  : null
              }
            />
            <DealStructureItem
              label="% Deals with Earnout"
              value={
                stats.dealStructure.pctWithEarnout != null
                  ? fmtPct(stats.dealStructure.pctWithEarnout)
                  : null
              }
            />
          </div>

          {/* Volume by Year */}
          {Object.keys(stats.volumeByYear).length > 0 && (
            <div className="border-t pt-4">
              <VolumeByYearBars volumeByYear={stats.volumeByYear} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
