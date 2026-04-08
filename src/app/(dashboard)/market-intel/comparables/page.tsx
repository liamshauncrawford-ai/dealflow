"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  ReferenceLine,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/ui/page-header";

/* ─── Types ─── */

interface PercentileStats {
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  mean: number;
}

interface DashboardData {
  summary: {
    transactionCount: number;
    medianEbitdaMultiple: number | null;
    medianRevenueMultiple: number | null;
    dateRange: { earliest: string; latest: string } | null;
  };
  ebitdaHistogram: Array<{ bucket: string; count: number }>;
  revenueMultipleHistogram: Array<{ bucket: string; count: number }>;
  sdeMultipleHistogram: Array<{ bucket: string; count: number }>;
  ebitdaStats: PercentileStats | null;
  revenueStats: PercentileStats | null;
  sdeStats: PercentileStats | null;
  trendByYear: Array<{ year: string; avgEbitdaMultiple: number; count: number }>;
  dealStructure: {
    avgPctCashAtClose: number | null;
    avgSellerNotePct: number | null;
    pctWithEarnout: number | null;
    avgSellerNoteTermYears: number | null;
  };
  revenueDistribution: Array<{ bucket: string; count: number }>;
}

/* ─── Constants ─── */

const RANKS = [
  { rank: 1, label: "MSP", color: "bg-blue-600", text: "text-blue-600", active: "bg-blue-600 text-white" },
  { rank: 2, label: "UCaaS", color: "bg-purple-600", text: "text-purple-600", active: "bg-purple-600 text-white" },
  { rank: 3, label: "Security", color: "bg-amber-600", text: "text-amber-600", active: "bg-amber-600 text-white" },
  { rank: 4, label: "Cabling", color: "bg-emerald-600", text: "text-emerald-600", active: "bg-emerald-600 text-white" },
] as const;

const DATE_RANGES = [
  { value: "1yr", label: "1yr" },
  { value: "3yr", label: "3yr" },
  { value: "5yr", label: "5yr" },
  { value: "all", label: "All" },
] as const;

/* ─── Formatters ─── */

function fmtMultiple(v: number | null): string {
  if (v == null) return "N/A";
  return `${v.toFixed(1)}x`;
}

function fmtDateRange(dr: { earliest: string; latest: string } | null): string {
  if (!dr) return "N/A";
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };
  return `${fmt(dr.earliest)} \u2013 ${fmt(dr.latest)}`;
}

function fmtPct(v: number | null): string {
  if (v == null) return "N/A";
  return `${v.toFixed(1)}%`;
}

function fmtYears(v: number | null): string {
  if (v == null) return "N/A";
  return `${v.toFixed(1)} yrs`;
}

/* ─── Page ─── */

export default function ComparablesPage() {
  const [activeRank, setActiveRank] = useState(1);
  const [dateRange, setDateRange] = useState("3yr");

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["bvr-dashboard", activeRank, dateRange],
    queryFn: async () => {
      const res = await fetch(
        `/api/market-intel/bvr-dashboard?rank=${activeRank}&dateRange=${dateRange}`,
      );
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
  });

  const activeRankInfo = RANKS.find((r) => r.rank === activeRank)!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market Comparables"
        description="BVR comparable transaction analysis by acquisition thesis"
      />

      {/* Rank Tabs */}
      <div className="flex items-center gap-2">
        {RANKS.map((r) => (
          <button
            key={r.rank}
            onClick={() => setActiveRank(r.rank)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeRank === r.rank
                ? r.active
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        {DATE_RANGES.map((dr) => (
          <button
            key={dr.value}
            onClick={() => setDateRange(dr.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              dateRange === dr.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {dr.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center text-destructive">
          Failed to load dashboard data. Please try again.
        </div>
      )}

      {/* Empty State */}
      {data && data.summary.transactionCount === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No BVR data imported for {activeRankInfo.label}.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Import comparable transactions in Settings &rarr; Thesis &rarr; Market
            Data.
          </p>
        </div>
      )}

      {/* Dashboard Content */}
      {data && data.summary.transactionCount > 0 && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Transactions"
              value={data.summary.transactionCount.toLocaleString()}
            />
            <SummaryCard
              label="Median EBITDA Multiple"
              value={fmtMultiple(data.summary.medianEbitdaMultiple)}
            />
            <SummaryCard
              label="Median Revenue Multiple"
              value={fmtMultiple(data.summary.medianRevenueMultiple)}
            />
            <SummaryCard
              label="Date Range"
              value={fmtDateRange(data.summary.dateRange)}
            />
          </div>

          {/* Multiples Histograms */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <HistogramCard
              title="EBITDA Multiple Distribution"
              data={data.ebitdaHistogram}
              stats={data.ebitdaStats}
              color="#3b82f6"
            />
            <HistogramCard
              title="Revenue Multiple Distribution"
              data={data.revenueMultipleHistogram}
              stats={data.revenueStats}
              color="#22c55e"
            />
            <HistogramCard
              title="SDE Multiple Distribution"
              data={data.sdeMultipleHistogram}
              stats={data.sdeStats}
              color="#a855f7"
            />
          </div>

          {/* Trend + Deal Structure */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Trend Chart */}
            <div className="rounded-xl border bg-card p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                EBITDA Multiple Trend
              </h3>
              {data.trendByYear.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={data.trendByYear}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Avg Multiple",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 11 },
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Deals",
                        angle: 90,
                        position: "insideRight",
                        style: { fontSize: 11 },
                      }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      yAxisId="right"
                      dataKey="count"
                      fill="#e2e8f0"
                      name="Deal Count"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="avgEbitdaMultiple"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Avg EBITDA Multiple"
                      dot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                  No trend data available
                </div>
              )}
            </div>

            {/* Deal Structure */}
            <div className="rounded-xl border bg-card p-6">
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Deal Structure
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <DealStatCard
                  label="Avg % Cash at Close"
                  value={fmtPct(data.dealStructure.avgPctCashAtClose)}
                />
                <DealStatCard
                  label="Avg Seller Note %"
                  value={fmtPct(data.dealStructure.avgSellerNotePct)}
                />
                <DealStatCard
                  label="% with Earnout"
                  value={fmtPct(data.dealStructure.pctWithEarnout)}
                />
                <DealStatCard
                  label="Avg Seller Note Term"
                  value={fmtYears(data.dealStructure.avgSellerNoteTermYears)}
                />
              </div>
            </div>
          </div>

          {/* Revenue Distribution */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Revenue Distribution
            </h3>
            {data.revenueDistribution.some((b) => b.count > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={data.revenueDistribution}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="bucket"
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                No revenue data available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function HistogramCard({
  title,
  data,
  stats,
  color,
}: {
  title: string;
  data: Array<{ bucket: string; count: number }>;
  stats: PercentileStats | null;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      {data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
              {stats && (
                <ReferenceLine
                  y={0}
                  stroke="transparent"
                  label=""
                />
              )}
            </BarChart>
          </ResponsiveContainer>
          {stats && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
              <span>Min: {stats.min.toFixed(1)}x</span>
              <span>P25: {stats.p25.toFixed(1)}x</span>
              <span className="font-semibold text-foreground">
                Med: {stats.median.toFixed(1)}x
              </span>
              <span>P75: {stats.p75.toFixed(1)}x</span>
              <span>Max: {stats.max.toFixed(1)}x</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      )}
    </div>
  );
}

function DealStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
