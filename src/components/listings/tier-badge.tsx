"use client";

import { TIERS, type TierKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier: string | null;
  size?: "sm" | "md";
}

export function TierBadge({ tier, size = "md" }: TierBadgeProps) {
  if (!tier) return null;

  const config = TIERS[tier as TierKey];
  if (!config) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        config.bgColor,
        config.textColor,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full",
          config.dotColor,
        )}
        style={{
          width: size === "sm" ? 6 : 8,
          height: size === "sm" ? 6 : 8,
        }}
      />
      {config.label}
    </span>
  );
}
