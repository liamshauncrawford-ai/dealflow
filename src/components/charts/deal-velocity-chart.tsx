"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { Timer } from "lucide-react";
import { STAGE_COLORS, getThemeColors } from "@/lib/chart-colors";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { ChartCard } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

interface VelocityItem {
  stage: string;
  label: string;
  avgDays: number;
  dealCount: number;
}

interface DealVelocityChartProps {
  velocity: VelocityItem[] | undefined;
  isLoading: boolean;
}

export function DealVelocityChart({
  velocity,
  isLoading,
}: DealVelocityChartProps) {
  const isDark = useDarkMode();
  const theme = getThemeColors(isDark);

  const data = (velocity ?? []).map((v) => ({
    ...v,
    color: STAGE_COLORS[v.stage] ?? "#6b7280",
  }));

  const hasData = data.some((d) => d.avgDays > 0);

  return (
    <ChartCard
      title="Deal Velocity"
      icon={Timer}
      isLoading={isLoading}
      isEmpty={!hasData}
      minHeight={300}
    >
      <BarChart
        key={isDark ? "dark" : "light"}
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 30, left: 0, bottom: 4 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: theme.axis }}
          axisLine={false}
          tickLine={false}
          unit=" d"
        />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fontSize: 11, fill: theme.text }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={
            <ChartTooltip
              formatter={(value, name) => {
                if (name === "avgDays") {
                  return `${value} days avg`;
                }
                return String(value);
              }}
              labelFormatter={(label) => {
                const item = data.find((d) => d.label === label);
                return item
                  ? `${label} (${item.dealCount} deal${item.dealCount !== 1 ? "s" : ""})`
                  : label;
              }}
            />
          }
          cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
        />
        <Bar dataKey="avgDays" name="Avg Days" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((entry) => (
            <Cell
              key={entry.stage}
              fill={entry.color}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  );
}
