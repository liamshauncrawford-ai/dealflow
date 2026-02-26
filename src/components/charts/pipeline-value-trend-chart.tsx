"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface MetricPoint {
  recordedAt: string;
  weightedPipelineValue: number;
}

interface PipelineValueTrendChartProps {
  data: MetricPoint[];
}

export function PipelineValueTrendChart({ data }: PipelineValueTrendChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    pipeline: d.weightedPipelineValue / 1_000_000,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No pipeline data yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} label={{ value: "$M", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="pipeline" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Weighted Pipeline ($M)" />
      </LineChart>
    </ResponsiveContainer>
  );
}
