"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface MetricPoint {
  recordedAt: string;
  targetsTracked: number;
  actionableTargets: number;
  newListingsThisPeriod: number;
  listingsForSaleVolume: number;
  weightedPipelineValue: number;
}

interface MarketMetricsChartProps {
  data: MetricPoint[];
}

export function MarketMetricsChart({ data }: MarketMetricsChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    tracked: d.targetsTracked,
    actionable: d.actionableTargets,
    newListings: d.newListingsThisPeriod,
    forSale: d.listingsForSaleVolume,
    pipeline: d.weightedPipelineValue / 1_000_000,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No metrics data yet. Run the market-metrics cron to start tracking.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="count" tick={{ fontSize: 11 }} label={{ value: "Count", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <YAxis yAxisId="pipeline" orientation="right" tick={{ fontSize: 11 }} label={{ value: "$M", angle: 90, position: "insideRight", fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Area yAxisId="count" type="monotone" dataKey="tracked" stackId="1" fill="#22c55e" stroke="#22c55e" fillOpacity={0.4} name="Targets Tracked" />
        <Area yAxisId="count" type="monotone" dataKey="actionable" stackId="2" fill="#f97316" stroke="#f97316" fillOpacity={0.4} name="Actionable Targets" />
        <Area yAxisId="count" type="monotone" dataKey="newListings" stackId="3" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.3} name="New Listings" />
        <Line yAxisId="pipeline" type="monotone" dataKey="pipeline" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Pipeline ($M)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
