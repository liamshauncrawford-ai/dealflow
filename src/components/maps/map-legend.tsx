"use client";

import { TIER_PIN_COLORS, STATUS_PIN_COLORS, LISTING_PIN_COLOR } from "@/lib/map-constants";
import { OPERATOR_TIERS, FACILITY_STATUS } from "@/lib/market-intel-constants";

type LegendMode = "tier" | "status";

interface MapLegendProps {
  mode?: LegendMode;
  showListings?: boolean;
}

export function MapLegend({ mode = "tier", showListings = false }: MapLegendProps) {
  return (
    <div className="rounded-lg border bg-card/95 backdrop-blur-sm p-3 shadow-sm">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Legend
      </p>
      <div className="space-y-1.5">
        {mode === "tier" &&
          Object.entries(OPERATOR_TIERS).map(([key, config]) => {
            const colors = TIER_PIN_COLORS[key as keyof typeof TIER_PIN_COLORS];
            return (
              <LegendItem
                key={key}
                color={colors.background}
                label={config.label}
              />
            );
          })}

        {mode === "status" &&
          Object.entries(FACILITY_STATUS).map(([key, config]) => {
            const colors = STATUS_PIN_COLORS[key as keyof typeof STATUS_PIN_COLORS];
            return (
              <LegendItem
                key={key}
                color={colors.background}
                label={config.label}
              />
            );
          })}

        {showListings && (
          <>
            <div className="my-1.5 border-t" />
            <LegendItem
              color={LISTING_PIN_COLOR.background}
              label="Acquisition Target"
            />
          </>
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-foreground">{label}</span>
    </div>
  );
}
