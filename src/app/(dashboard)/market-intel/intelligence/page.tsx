"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Zap, Target, TrendingUp, HardHat, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarketMetrics, useWeightedPipeline } from "@/hooks/use-market-intel";
import { MarketMetricsChart } from "@/components/charts/market-metrics-chart";
import { PipelineValueTrendChart } from "@/components/charts/pipeline-value-trend-chart";

const PERIODS = [
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "6m", value: "6m" },
  { label: "1y", value: "1y" },
] as const;

export default function IntelligencePage() {
  const [period, setPeriod] = useState("90d");
  const { data: metricsData, isLoading } = useMarketMetrics(period);
  const { data: pipelineData } = useWeightedPipeline();

  const latest = metricsData?.latest;
  const change = metricsData?.change;
  const series = metricsData?.series ?? [];

  const totalMW = (latest?.totalMwOperating ?? 0) +
    (latest?.totalMwUnderConstruction ?? 0) +
    (latest?.totalMwPlanned ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">Market Intelligence</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Colorado Front Range data center market trends and cabling pipeline
          </p>
        </div>

        {/* Period selector */}
        <div className="flex rounded-lg border">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              } ${p.value === PERIODS[0].value ? "rounded-l-lg" : ""} ${
                p.value === PERIODS[PERIODS.length - 1].value ? "rounded-r-lg" : ""
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          label="Total MW Tracked"
          value={`${totalMW.toLocaleString()} MW`}
          change={change ? (change.totalMwOperating + change.totalMwUnderConstruction) : null}
          suffix=" MW"
          icon={Zap}
          color="text-amber-500"
        />
        <KpiCard
          label="Active Projects"
          value={latest?.activeConstructionProjects ?? 0}
          icon={HardHat}
          color="text-orange-500"
        />
        <KpiCard
          label="Weighted Pipeline"
          value={`$${((latest?.weightedPipelineValue ?? 0) / 1_000_000).toFixed(1)}M`}
          change={change ? change.weightedPipelineValue / 1_000_000 : null}
          suffix="M"
          prefix="$"
          icon={TrendingUp}
          color="text-violet-500"
        />
        <KpiCard
          label="TAM Coverage"
          value={`${(latest?.gcCoveragePct ?? 0).toFixed(0)}%`}
          change={change?.gcCoveragePct ?? null}
          suffix="%"
          icon={Target}
          color="text-emerald-500"
        />
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Market Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <MarketMetricsChart data={series} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pipeline Value Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <PipelineValueTrendChart data={series} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Opportunities */}
      {pipelineData?.topOpportunities && pipelineData.topOpportunities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Cabling Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 text-left font-medium">Opportunity</th>
                    <th className="pb-2 text-left font-medium">GC</th>
                    <th className="pb-2 text-left font-medium">Operator</th>
                    <th className="pb-2 text-right font-medium">Estimated</th>
                    <th className="pb-2 text-right font-medium">Weighted</th>
                    <th className="pb-2 text-right font-medium">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineData.topOpportunities.slice(0, 10).map((opp: {
                    id: string;
                    name: string;
                    gcName: string | null;
                    operatorName: string | null;
                    estimatedValue: number | null;
                    weightedValue: number | null;
                    winProbabilityPct: number | null;
                  }) => (
                    <tr key={opp.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{opp.name}</td>
                      <td className="py-2 text-muted-foreground">{opp.gcName ?? "—"}</td>
                      <td className="py-2 text-muted-foreground">{opp.operatorName ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">
                        {opp.estimatedValue ? `$${(opp.estimatedValue / 1_000_000).toFixed(2)}M` : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {opp.weightedValue ? `$${(opp.weightedValue / 1_000_000).toFixed(2)}M` : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {opp.winProbabilityPct ? `${opp.winProbabilityPct.toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actionable Targets */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Actionable Targets</CardTitle>
            <Link
              href="/listings?minScore=60"
              className="text-xs text-blue-600 hover:underline"
            >
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <p className="text-2xl font-bold tabular-nums">{latest?.actionableTargets ?? 0}</p>
              <p className="text-xs text-muted-foreground">Score ≥ 60</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <p className="text-2xl font-bold tabular-nums">{latest?.targetsTracked ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total tracked</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-component ──

function KpiCard({
  label,
  value,
  change,
  prefix,
  suffix,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  change?: number | null;
  prefix?: string;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-lg bg-muted p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          {change != null && change !== 0 && (
            <p className={`flex items-center gap-0.5 text-xs ${change > 0 ? "text-emerald-600" : "text-red-600"}`}>
              {change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {prefix}{Math.abs(change).toFixed(1)}{suffix}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
