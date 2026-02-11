"use client";

import { cn } from "@/lib/utils";

interface FitScoreGaugeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-100 dark:bg-emerald-900/30";
  if (score >= 40) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function getBarColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function FitScoreGauge({ score, size = "md", showLabel = true }: FitScoreGaugeProps) {
  if (score === null || score === undefined) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className={cn(
          "flex items-center justify-center rounded-full bg-muted",
          size === "sm" ? "h-7 w-7 text-xs" : size === "lg" ? "h-12 w-12 text-lg" : "h-9 w-9 text-sm"
        )}>
          —
        </div>
        {showLabel && <span className="text-xs">Not scored</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "flex items-center justify-center rounded-full font-semibold",
        getScoreBg(score),
        getScoreColor(score),
        size === "sm" ? "h-7 w-7 text-xs" : size === "lg" ? "h-12 w-12 text-lg" : "h-9 w-9 text-sm"
      )}>
        {score}
      </div>
      {showLabel && (
        <div className="flex flex-col">
          <span className={cn("font-medium", getScoreColor(score), size === "sm" ? "text-xs" : "text-sm")}>
            {score >= 70 ? "Strong Fit" : score >= 40 ? "Moderate" : "Weak Fit"}
          </span>
          {size !== "sm" && (
            <div className="mt-0.5 h-1.5 w-20 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getBarColor(score))}
                style={{ width: `${score}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
