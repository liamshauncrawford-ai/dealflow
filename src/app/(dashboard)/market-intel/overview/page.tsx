"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Target,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Activity,
  Clock,
  Zap,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PRIMARY_TRADES, type PrimaryTradeKey } from "@/lib/constants";
import { TRADE_COLORS } from "@/lib/chart-colors";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";
import { MarketMetricsChart } from "@/components/charts/market-metrics-chart";

/* ─── Types ─── */

interface MarketOverview {
  brief: {
    id: string;
    weekStart: string;
    weekEnd: string;
    thesisHealth: string | null;
    marketMomentum: string | null;
    keyDevelopments: string[] | null;
    recommendedActions: string[] | null;
    pipelineMetrics: Record<string, unknown> | null;
    marketMetrics: Record<string, unknown> | null;
    createdAt: string;
  } | null;
  metricSeries: Array<{
    recordedAt: string;
    targetsTracked: number;
    actionableTargets: number;
    newListingsThisPeriod: number;
    listingsForSaleVolume: number;
    weightedPipelineValue: number;
  }>;
  tradeDistribution: Array<{ trade: string; count: number }>;
  summary: {
    totalActive: number;
    avgFitScore: number | null;
  };
  topTargets: Array<{
    id: string;
    name: string;
    primaryTrade: string | null;
    score: number | null;
    thesisAlignment: string | null;
    tier: string | null;
    location: string;
    revenue: number | null;
  }>;
  recentListings: Array<{
    id: string;
    name: string;
    primaryTrade: string | null;
    location: string;
    createdAt: string;
  }>;
}

/* ─── Hook ─── */

function useMarketOverview() {
  return useQuery<MarketOverview>({
    queryKey: ["market-overview"],
    queryFn: async () => {
      const res = await fetch("/api/market-intel/overview");
      if (!res.ok) throw new Error("Failed to fetch overview");
      return res.json();
    },
  });
}

/* ─── Page ─── */

export default function MarketOverviewPage() {
  const { data, isLoading } = useMarketOverview();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Market Overview</h1>
        <p className="text-sm text-muted-foreground">
          Intelligence snapshot of your acquisition pipeline and market landscape
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Target}
          label="Active Targets"
          value={isLoading ? "..." : String(data?.summary.totalActive ?? 0)}
          color="text-primary"
        />
        <KpiCard
          icon={BarChart3}
          label="Avg Fit Score"
          value={isLoading ? "..." : data?.summary.avgFitScore ? String(data.summary.avgFitScore) : "—"}
          color="text-amber-500"
        />
        <KpiCard
          icon={Activity}
          label="Thesis Health"
          value={isLoading ? "..." : formatThesisHealth(data?.brief?.thesisHealth)}
          color={thesisHealthColor(data?.brief?.thesisHealth)}
        />
        <KpiCard
          icon={TrendingUp}
          label="Market Momentum"
          value={isLoading ? "..." : formatMomentum(data?.brief?.marketMomentum)}
          color="text-blue-500"
        />
      </div>

      {/* Two-column: Brief + Trade Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weekly Brief */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-medium">Weekly Intelligence Brief</h2>
            </div>
            {data?.brief?.createdAt && (
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(data.brief.createdAt)}
              </span>
            )}
          </div>
          <div className="p-5">
            {isLoading ? (
              <LoadingSkeleton />
            ) : data?.brief ? (
              <div className="space-y-4">
                {/* Thesis Health Badge */}
                <div className="flex items-center gap-2">
                  <ThesisHealthBadge health={data.brief.thesisHealth} />
                  <MomentumBadge momentum={data.brief.marketMomentum} />
                </div>

                {/* Key Developments */}
                {Array.isArray(data.brief.keyDevelopments) &&
                  data.brief.keyDevelopments.length > 0 && (
                    <div>
                      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Key Developments
                      </h3>
                      <ul className="space-y-1">
                        {(data.brief.keyDevelopments as string[]).map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Recommended Actions */}
                {Array.isArray(data.brief.recommendedActions) &&
                  data.brief.recommendedActions.length > 0 && (
                    <div>
                      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Recommended Actions
                      </h3>
                      <ul className="space-y-1">
                        {(data.brief.recommendedActions as string[]).map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            ) : (
              <EmptyState
                message="No weekly brief yet"
                detail="Run the Market Pulse agent from the Agent Dashboard to generate your first intelligence brief."
              />
            )}
          </div>
        </div>

        {/* Trade Distribution */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-medium">Trade Distribution</h2>
            </div>
          </div>
          <div className="p-5">
            {isLoading ? (
              <LoadingSkeleton />
            ) : data?.tradeDistribution && data.tradeDistribution.length > 0 ? (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.tradeDistribution.map((t) => ({
                          name:
                            PRIMARY_TRADES[t.trade as PrimaryTradeKey]?.label ??
                            t.trade,
                          value: t.count,
                          color: TRADE_COLORS[t.trade] ?? "#6b7280",
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="85%"
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {data.tradeDistribution.map((t, i) => (
                          <Cell
                            key={i}
                            fill={TRADE_COLORS[t.trade] ?? "#6b7280"}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {data.tradeDistribution.map((t) => (
                    <div key={t.trade} className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: TRADE_COLORS[t.trade] ?? "#6b7280",
                        }}
                      />
                      <span className="flex-1 text-sm truncate">
                        {PRIMARY_TRADES[t.trade as PrimaryTradeKey]?.label ??
                          t.trade}
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {t.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState message="No trade data" detail="Add listings with primary trades to see distribution." />
            )}
          </div>
        </div>
      </div>

      {/* Market Metrics Chart */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Market Metrics — Last 90 Days</h2>
          </div>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="flex h-[300px] items-center justify-center">
              <LoadingSkeleton />
            </div>
          ) : (
            <MarketMetricsChart data={data?.metricSeries ?? []} />
          )}
        </div>
      </div>

      {/* Bottom two-column: Top Targets + Recent */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Targets */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-medium">Top Scoring Targets</h2>
            </div>
            <Link
              href="/listings"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y">
            {isLoading ? (
              <div className="p-5">
                <LoadingSkeleton />
              </div>
            ) : data?.topTargets && data.topTargets.length > 0 ? (
              data.topTargets.map((t) => (
                <Link
                  key={t.id}
                  href={`/listings/${t.id}`}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  {t.primaryTrade && (
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          TRADE_COLORS[t.primaryTrade] ?? "#6b7280",
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[
                        PRIMARY_TRADES[t.primaryTrade as PrimaryTradeKey]
                          ?.label,
                        t.location,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-semibold tabular-nums">
                      {t.score ?? "—"}
                    </span>
                    {t.revenue && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(t.revenue)}
                      </p>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-5">
                <EmptyState message="No scored targets" detail="Score your listings to see top targets." />
              </div>
            )}
          </div>
        </div>

        {/* Recent Listings */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-medium">Recently Added</h2>
            </div>
          </div>
          <div className="divide-y">
            {isLoading ? (
              <div className="p-5">
                <LoadingSkeleton />
              </div>
            ) : data?.recentListings && data.recentListings.length > 0 ? (
              data.recentListings.map((l) => (
                <Link
                  key={l.id}
                  href={`/listings/${l.id}`}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  {l.primaryTrade && (
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          TRADE_COLORS[l.primaryTrade] ?? "#6b7280",
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[
                        PRIMARY_TRADES[l.primaryTrade as PrimaryTradeKey]
                          ?.label,
                        l.location,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeDate(l.createdAt)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="p-5">
                <EmptyState message="No listings yet" detail="Add your first target business to get started." />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className={`rounded-md bg-muted p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ThesisHealthBadge({ health }: { health: string | null }) {
  const config: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
    strong: { label: "Strong", icon: CheckCircle2, className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
    stable: { label: "Stable", icon: Activity, className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
    caution: { label: "Caution", icon: AlertTriangle, className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
    at_risk: { label: "At Risk", icon: AlertTriangle, className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  };
  const c = config[health ?? ""] ?? config.stable;
  const BadgeIcon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${c.className}`}>
      <BadgeIcon className="h-3 w-3" />
      Thesis: {c.label}
    </span>
  );
}

function MomentumBadge({ momentum }: { momentum: string | null }) {
  const labels: Record<string, string> = {
    accelerating: "Accelerating",
    stable: "Stable",
    decelerating: "Decelerating",
    uncertain: "Uncertain",
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <TrendingUp className="h-3 w-3" />
      {labels[momentum ?? ""] ?? "Unknown"}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
    </div>
  );
}

function EmptyState({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

/* ─── Helpers ─── */

function formatThesisHealth(health: string | null | undefined): string {
  const labels: Record<string, string> = {
    strong: "Strong",
    stable: "Stable",
    caution: "Caution",
    at_risk: "At Risk",
  };
  return labels[health ?? ""] ?? "Not assessed";
}

function thesisHealthColor(health: string | null | undefined): string {
  const colors: Record<string, string> = {
    strong: "text-green-500",
    stable: "text-blue-500",
    caution: "text-amber-500",
    at_risk: "text-red-500",
  };
  return colors[health ?? ""] ?? "text-muted-foreground";
}

function formatMomentum(momentum: string | null | undefined): string {
  const labels: Record<string, string> = {
    accelerating: "Accelerating",
    stable: "Stable",
    decelerating: "Decelerating",
    uncertain: "Uncertain",
  };
  return labels[momentum ?? ""] ?? "Unknown";
}
