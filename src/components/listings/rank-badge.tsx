"use client";

const RANK_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", label: "MSP" },
  2: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300", label: "UCaaS" },
  3: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", label: "Security" },
  4: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", label: "Cabling" },
};

interface RankBadgeProps {
  rank: number | null;
  label?: string | null;
  size?: "sm" | "md";
}

export function RankBadge({ rank, label, size = "sm" }: RankBadgeProps) {
  if (!rank) return null;
  const config = RANK_COLORS[rank];
  if (!config) return null;
  const displayLabel = label ?? config.label;
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm";
  return (
    <span className={`inline-flex items-center rounded-md font-medium ${config.bg} ${config.text} ${sizeClasses}`}>
      {displayLabel}
    </span>
  );
}
