"use client";

import { getThemeColors } from "@/lib/chart-colors";
import { useDarkMode } from "@/hooks/use-dark-mode";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: ChartTooltipProps) {
  const isDark = useDarkMode();
  const colors = getThemeColors(isDark);

  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-md"
      style={{
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        color: colors.tooltipText,
      }}
    >
      {label !== undefined && (
        <p className="mb-1 font-medium">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span style={{ color: colors.muted }}>
            {entry.name ?? entry.dataKey}:
          </span>
          <span className="font-medium">
            {formatter
              ? formatter(entry.value ?? 0, entry.name ?? "")
              : String(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
