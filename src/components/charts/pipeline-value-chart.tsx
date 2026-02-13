"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { DollarSign } from "lucide-react";
import { PIPELINE_STAGES, type PipelineStageKey } from "@/lib/constants";
import { STAGE_COLORS, getThemeColors } from "@/lib/chart-colors";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { formatCurrency } from "@/lib/utils";
import { ChartCard } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

interface PipelineValueChartProps {
  pipelineValueByStage:
    | Array<{ stage: string; valueLow: number; valueHigh: number }>
    | undefined;
  isLoading: boolean;
}

export function PipelineValueChart({
  pipelineValueByStage,
  isLoading,
}: PipelineValueChartProps) {
  const isDark = useDarkMode();
  const theme = getThemeColors(isDark);

  // Only show stages with value
  const data = (pipelineValueByStage ?? [])
    .filter((s) => s.valueLow > 0 || s.valueHigh > 0)
    .map((s) => {
      const stageInfo = PIPELINE_STAGES[s.stage as PipelineStageKey];
      return {
        stage: s.stage,
        label: stageInfo?.label ?? s.stage,
        valueLow: Math.round(s.valueLow),
        valueHigh: Math.round(s.valueHigh),
        color: STAGE_COLORS[s.stage] ?? "#6b7280",
      };
    });

  const showRange = data.some((d) => d.valueLow !== d.valueHigh);

  return (
    <ChartCard
      title="Pipeline Value by Stage"
      icon={DollarSign}
      isLoading={isLoading}
      isEmpty={data.length === 0}
      minHeight={300}
    >
      <BarChart
        key={isDark ? "dark" : "light"}
        data={data}
        margin={{ top: 4, right: 10, left: 10, bottom: 4 }}
      >
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: theme.axis }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis
          tick={{ fontSize: 11, fill: theme.axis }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => {
            if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
            if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
            return `$${v}`;
          }}
          width={70}
        />
        <Tooltip
          content={
            <ChartTooltip
              formatter={(value) => formatCurrency(value)}
            />
          }
          cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
        />
        {showRange && (
          <Legend
            wrapperStyle={{ fontSize: 11, color: theme.muted }}
          />
        )}
        {showRange ? (
          <>
            <Bar dataKey="valueLow" name="Low Est." radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((entry) => (
                <Cell
                  key={`low-${entry.stage}`}
                  fill={entry.color}
                  fillOpacity={0.45}
                />
              ))}
            </Bar>
            <Bar dataKey="valueHigh" name="High Est." radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((entry) => (
                <Cell
                  key={`high-${entry.stage}`}
                  fill={entry.color}
                />
              ))}
            </Bar>
          </>
        ) : (
          <Bar dataKey="valueHigh" name="Value" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry) => (
              <Cell
                key={entry.stage}
                fill={entry.color}
              />
            ))}
          </Bar>
        )}
      </BarChart>
    </ChartCard>
  );
}
