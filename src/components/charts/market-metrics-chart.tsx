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
  totalMwOperating: number;
  totalMwUnderConstruction: number;
  totalMwPlanned: number;
  weightedPipelineValue: number;
}

interface MarketMetricsChartProps {
  data: MetricPoint[];
}

export function MarketMetricsChart({ data }: MarketMetricsChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    operating: d.totalMwOperating,
    construction: d.totalMwUnderConstruction,
    planned: d.totalMwPlanned,
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
        <YAxis yAxisId="mw" tick={{ fontSize: 11 }} label={{ value: "MW", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <YAxis yAxisId="pipeline" orientation="right" tick={{ fontSize: 11 }} label={{ value: "$M", angle: 90, position: "insideRight", fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Area yAxisId="mw" type="monotone" dataKey="operating" stackId="1" fill="#22c55e" stroke="#22c55e" fillOpacity={0.4} name="Operating MW" />
        <Area yAxisId="mw" type="monotone" dataKey="construction" stackId="1" fill="#f97316" stroke="#f97316" fillOpacity={0.4} name="Under Construction MW" />
        <Area yAxisId="mw" type="monotone" dataKey="planned" stackId="1" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.3} name="Planned MW" />
        <Line yAxisId="pipeline" type="monotone" dataKey="pipeline" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Pipeline ($M)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
