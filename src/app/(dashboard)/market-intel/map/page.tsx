"use client";

import { Map } from "lucide-react";
import DealMap from "@/components/market-intel/deal-map";
import { PageHeader } from "@/components/ui/page-header";

export default function MarketMapPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Market Map"
        icon={Map}
        description="Interactive map view of pipeline deals and acquisition targets"
      />
      <div
        className="rounded-lg border bg-card"
        style={{ height: "calc(100vh - 200px)" }}
      >
        <DealMap />
      </div>
    </div>
  );
}
