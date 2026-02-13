"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { GitBranch } from "lucide-react";
import { PIPELINE_STAGES, type PipelineStageKey } from "@/lib/constants";
import { STAGE_COLORS, getThemeColors } from "@/lib/chart-colors";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { ChartCard } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

interface PipelineFunnelChartProps {
  pipelineByStage: Array<{ stage: string; count: number }> | undefined;
  isLoading: boolean;
}

export function PipelineFunnelChart({
  pipelineByStage,
  isLoading,
}: PipelineFunnelChartProps) {
  const isDark = useDarkMode();
  const theme = getThemeColors(isDark);

  // Build data for all stages (including zeros for visual funnel)
  const data = Object.entries(PIPELINE_STAGES)
    .filter(([key]) => key !== "ON_HOLD")
    .map(([key, stage]) => {
      const found = pipelineByStage?.find((s) => s.stage === key);
      return {
        stage: key,
        label: stage.label,
        count: found?.count ?? 0,
        color: STAGE_COLORS[key] ?? "#6b7280",
      };
    });

  return (
    <ChartCard
      title="Pipeline Funnel"
      icon={GitBranch}
      isLoading={isLoading}
      isEmpty={!pipelineByStage || pipelineByStage.length === 0}
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
          allowDecimals={false}
          tick={{ fontSize: 11, fill: theme.axis }}
          axisLine={false}
          tickLine={false}
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
              formatter={(value) =>
                `${value} deal${value !== 1 ? "s" : ""}`
              }
            />
          }
          cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
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
