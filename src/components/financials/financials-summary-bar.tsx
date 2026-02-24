"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface FinancialsSummaryBarProps {
  periods: any[];
  viewMode: "ebitda" | "sde";
}

function MetricCard({
  label,
  value,
  subtext,
  color,
}: {
  label: string;
  value: string;
  subtext?: string;
  color?: "green" | "red" | "amber" | "default";
}) {
  const colorClass =
    color === "green"
      ? "text-emerald-600 dark:text-emerald-400"
      : color === "red"
        ? "text-red-600 dark:text-red-400"
        : color === "amber"
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";

  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-semibold ${colorClass}`}>{value}</span>
      {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
    </div>
  );
}

export function FinancialsSummaryBar({ periods, viewMode }: FinancialsSummaryBarProps) {
  if (periods.length === 0) return null;

  // Sort by year desc to get latest
  const sorted = [...periods].sort((a, b) => b.year - a.year || a.periodType.localeCompare(b.periodType));
  const latest = sorted[0];
  const previous = sorted[1];

  const revenue = latest.totalRevenue ? Number(latest.totalRevenue) : null;
  const primaryMetric =
    viewMode === "sde"
      ? latest.sde ? Number(latest.sde) : null
      : latest.adjustedEbitda ? Number(latest.adjustedEbitda) : null;
  const primaryMargin =
    viewMode === "sde"
      ? revenue && primaryMetric ? primaryMetric / revenue : null
      : latest.adjustedEbitdaMargin ? Number(latest.adjustedEbitdaMargin) : null;
  const addBackTotal = latest.totalAddBacks ? Number(latest.totalAddBacks) : null;
  const addBackRatio = revenue && addBackTotal ? addBackTotal / revenue : null;

  // YoY Revenue Growth — compare the two most recent ANNUAL periods
  // to avoid misleading projected-vs-actual comparisons
  const annualPeriods = sorted.filter((p) => p.periodType === "ANNUAL");
  let yoyGrowth: number | null = null;
  let yoyIcon = <Minus className="h-3 w-3" />;
  let yoyColor: "green" | "red" | "default" = "default";
  let yoyLabel = "YoY Revenue";
  if (annualPeriods.length >= 2) {
    const recentAnnual = annualPeriods[0];
    const priorAnnual = annualPeriods[1];
    const recentRev = recentAnnual.totalRevenue ? Number(recentAnnual.totalRevenue) : 0;
    const priorRev = priorAnnual.totalRevenue ? Number(priorAnnual.totalRevenue) : 0;
    if (priorRev > 0 && recentRev > 0) {
      yoyGrowth = (recentRev - priorRev) / priorRev;
      yoyLabel = `YoY Revenue (${recentAnnual.year} vs ${priorAnnual.year})`;
      if (yoyGrowth > 0.01) {
        yoyIcon = <TrendingUp className="h-3 w-3" />;
        yoyColor = "green";
      } else if (yoyGrowth < -0.01) {
        yoyIcon = <TrendingDown className="h-3 w-3" />;
        yoyColor = "red";
      }
    }
  } else if (previous) {
    // Fallback: compare the two most recent periods of any type
    const prevRev = previous.totalRevenue ? Number(previous.totalRevenue) : 0;
    if (prevRev > 0 && revenue) {
      yoyGrowth = (revenue - prevRev) / prevRev;
      if (yoyGrowth > 0.01) {
        yoyIcon = <TrendingUp className="h-3 w-3" />;
        yoyColor = "green";
      } else if (yoyGrowth < -0.01) {
        yoyIcon = <TrendingDown className="h-3 w-3" />;
        yoyColor = "red";
      }
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start gap-6 md:gap-8">
        <MetricCard
          label="Revenue"
          value={formatCurrency(revenue)}
          subtext={`${latest.periodType} ${latest.year}`}
        />
        <MetricCard
          label={viewMode === "sde" ? "SDE" : "Adj. EBITDA"}
          value={formatCurrency(primaryMetric)}
          color={primaryMetric && primaryMetric > 0 ? "green" : primaryMetric && primaryMetric < 0 ? "red" : "default"}
        />
        <MetricCard
          label={viewMode === "sde" ? "SDE Margin" : "Adj. EBITDA Margin"}
          value={formatPercent(primaryMargin)}
          color={primaryMargin && primaryMargin >= 0.15 ? "green" : primaryMargin && primaryMargin < 0.08 ? "red" : "amber"}
        />
        {yoyGrowth !== null && (
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{yoyLabel}</span>
            <span className={`flex items-center gap-1 text-lg font-semibold ${
              yoyColor === "green"
                ? "text-emerald-600 dark:text-emerald-400"
                : yoyColor === "red"
                  ? "text-red-600 dark:text-red-400"
                  : "text-foreground"
            }`}>
              {yoyIcon}
              {formatPercent(yoyGrowth)}
            </span>
          </div>
        )}
        <MetricCard
          label="Add-Back Ratio"
          value={formatPercent(addBackRatio)}
          color={addBackRatio && addBackRatio > 0.5 ? "red" : addBackRatio && addBackRatio > 0.3 ? "amber" : "green"}
        />
        <MetricCard
          label="Periods"
          value={String(periods.length)}
        />
      </div>
    </div>
  );
}
