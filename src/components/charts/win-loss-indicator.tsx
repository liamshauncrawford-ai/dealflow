"use client";

import { Trophy } from "lucide-react";
import { getThemeColors } from "@/lib/chart-colors";
import { useDarkMode } from "@/hooks/use-dark-mode";

interface WinLossIndicatorProps {
  wonCount: number;
  lostCount: number;
  winRate: number | null;
}

export function WinLossIndicator({
  wonCount,
  lostCount,
  winRate,
}: WinLossIndicatorProps) {
  const isDark = useDarkMode();
  const theme = getThemeColors(isDark);
  const total = wonCount + lostCount;

  // Arc parameters
  const size = 160;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const radius = 60;
  const strokeWidth = 12;

  // Arc from 180deg to 0deg (semicircle, top half)
  const startAngle = Math.PI; // left
  const endAngle = 0; // right
  const pct = winRate ?? 0;

  // Background arc (full semicircle)
  const bgStartX = cx + radius * Math.cos(startAngle);
  const bgStartY = cy - radius * Math.sin(startAngle);
  const bgEndX = cx + radius * Math.cos(endAngle);
  const bgEndY = cy - radius * Math.sin(endAngle);

  // Progress arc
  const progressAngle = startAngle - pct * Math.PI;
  const progressEndX = cx + radius * Math.cos(progressAngle);
  const progressEndY = cy - radius * Math.sin(progressAngle);
  const largeArc = pct > 0.5 ? 1 : 0;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Win / Loss</h2>
        </div>
      </div>
      <div className="flex flex-col items-center p-5">
        <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
          {/* Background arc */}
          <path
            d={`M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 0 1 ${bgEndX} ${bgEndY}`}
            fill="none"
            stroke={isDark ? "#27272a" : "#e4e4e7"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Progress arc */}
          {pct > 0 && (
            <path
              d={`M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 ${largeArc} 1 ${progressEndX} ${progressEndY}`}
              fill="none"
              stroke="#059669"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          )}

          {/* Center text */}
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fill: theme.text, fontSize: 28, fontWeight: 600 }}
          >
            {winRate !== null ? `${Math.round(winRate * 100)}%` : "—"}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fill: theme.muted, fontSize: 11 }}
          >
            win rate
          </text>
        </svg>

        <div className="flex items-center gap-6 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm text-muted-foreground">Won</span>
            <span className="text-sm font-semibold">{wonCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
            <span className="text-sm text-muted-foreground">Lost</span>
            <span className="text-sm font-semibold">{lostCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-sm font-semibold">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
