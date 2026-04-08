"use client";

const TIER_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", ring: "ring-yellow-500/30" },
  B: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", ring: "ring-green-500/30" },
  C: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-300", ring: "ring-orange-500/30" },
  Inactive: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400", ring: "ring-gray-500/30" },
};

interface AcquisitionTierBadgeProps {
  tier: string | null;
  score?: number | null;
  size?: "sm" | "md" | "lg";
}

export function AcquisitionTierBadge({ tier, score, size = "sm" }: AcquisitionTierBadgeProps) {
  if (!tier) return null;
  const style = TIER_STYLES[tier] ?? TIER_STYLES.Inactive;
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-sm",
    lg: "px-3 py-1.5 text-base font-bold",
  }[size];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold ring-1 ring-inset ${style.bg} ${style.text} ${style.ring} ${sizeClasses}`}>
      <span>{tier === "Inactive" ? "—" : tier}</span>
      {score !== null && score !== undefined && (
        <span className="font-normal opacity-75">{score}</span>
      )}
    </span>
  );
}
