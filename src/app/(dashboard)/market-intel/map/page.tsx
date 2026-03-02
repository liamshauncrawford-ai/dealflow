"use client";

import DealMap from "@/components/market-intel/deal-map";

export default function MarketMapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Market Map</h1>
        <p className="text-sm text-muted-foreground">
          Interactive map view of pipeline deals and acquisition targets
        </p>
      </div>
      <div
        className="rounded-lg border bg-card"
        style={{ height: "calc(100vh - 200px)" }}
      >
        <DealMap />
      </div>
    </div>
  );
}
