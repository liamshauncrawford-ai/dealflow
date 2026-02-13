"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { Target } from "lucide-react";
import { TIERS, type TierKey } from "@/lib/constants";
import { TIER_COLORS, getThemeColors } from "@/lib/chart-colors";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { ChartCard } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

interface TierDistributionChartProps {
  tierBreakdown: Array<{ tier: string; count: number }> | undefined;
  avgFitScore: number | null | undefined;
  isLoading: boolean;
}

export function TierDistributionChart({
  tierBreakdown,
  avgFitScore,
  isLoading,
}: TierDistributionChartProps) {
  const isDark = useDarkMode();
  const theme = getThemeColors(isDark);

  const data = (tierBreakdown ?? [])
    .filter((t) => t.count > 0)
    .map((t) => ({
      name: TIERS[t.tier as TierKey]?.shortLabel ?? t.tier,
      value: t.count,
      color: TIER_COLORS[t.tier] ?? "#6b7280",
    }));

  const centerLabel =
    avgFitScore !== null && avgFitScore !== undefined
      ? String(avgFitScore)
      : "—";
  const centerSub = avgFitScore !== null ? "avg fit" : "";

  return (
    <ChartCard
      title="Target Tier Breakdown"
      icon={Target}
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

        {/* Center: avg fit score */}
        <text
          x="50%"
          y="42%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-2xl font-semibold"
          style={{ fill: theme.text }}
        >
          {centerLabel}
        </text>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-xs"
          style={{ fill: theme.muted, fontSize: 11 }}
        >
          {centerSub}
        </text>
      </PieChart>
    </ChartCard>
  );
}
