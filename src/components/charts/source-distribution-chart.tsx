"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { Globe } from "lucide-react";
import { PLATFORMS, type PlatformKey } from "@/lib/constants";
import { PLATFORM_COLORS, getThemeColors } from "@/lib/chart-colors";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { ChartCard } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

interface SourceDistributionChartProps {
  platformCounts: Array<{ platform: string; count: number }> | undefined;
  isLoading: boolean;
}

export function SourceDistributionChart({
  platformCounts,
  isLoading,
}: SourceDistributionChartProps) {
  const isDark = useDarkMode();
  const theme = getThemeColors(isDark);

  const data = (platformCounts ?? [])
    .filter((p) => p.count > 0)
    .map((p) => ({
      name: PLATFORMS[p.platform as PlatformKey]?.label ?? p.platform,
      value: p.count,
      color: PLATFORM_COLORS[p.platform] ?? "#6b7280",
    }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartCard
      title="Listings by Source"
      icon={Globe}
      isLoading={isLoading}
      isEmpty={data.length === 0}
      minHeight={280}
    >
      <PieChart key={isDark ? "dark" : "light"}>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          content={
            <ChartTooltip
              formatter={(value) =>
                `${value} listing${value !== 1 ? "s" : ""}`
              }
            />
          }
        />

        {/* Center label */}
        <text
          x="50%"
          y="42%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-2xl font-semibold"
          style={{ fill: theme.text }}
        >
          {total}
        </text>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-xs"
          style={{ fill: theme.muted, fontSize: 11 }}
        >
          total
        </text>
      </PieChart>
    </ChartCard>
  );
}
