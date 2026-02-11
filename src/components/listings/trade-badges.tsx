"use client";

import { PRIMARY_TRADES, type PrimaryTradeKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TradeBadgesProps {
  primaryTrade: string | null;
  secondaryTrades?: string[];
  size?: "sm" | "md";
}

export function TradeBadges({ primaryTrade, secondaryTrades = [], size = "md" }: TradeBadgesProps) {
  if (!primaryTrade && secondaryTrades.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {primaryTrade && (
        <TradeBadge trade={primaryTrade} isPrimary size={size} />
      )}
      {secondaryTrades.map((trade) => (
        <TradeBadge key={trade} trade={trade} size={size} />
      ))}
    </div>
  );
}

function TradeBadge({
  trade,
  isPrimary = false,
  size = "md",
}: {
  trade: string;
  isPrimary?: boolean;
  size?: "sm" | "md";
}) {
  const config = PRIMARY_TRADES[trade as PrimaryTradeKey];
  const label = config?.label || trade;
  const color = config?.color || "#6b7280";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-medium",
        isPrimary ? "ring-1 ring-inset" : "",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs"
      )}
      style={{
        backgroundColor: `${color}18`,
        color: color,
        ...(isPrimary ? { ringColor: `${color}40` } : {}),
      }}
    >
      {isPrimary && <span className="mr-1 text-[10px]">&#9679;</span>}
      {label}
    </span>
  );
}
