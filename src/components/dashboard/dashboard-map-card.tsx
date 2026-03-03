"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";

const DealMap = dynamic(
  () => import("@/components/market-intel/deal-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export function DashboardMapCard() {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Market Map</h3>
        </div>
        <Link
          href="/market-intel/map"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View Full Map
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="h-[400px]">
        <DealMap compact />
      </div>
    </div>
  );
}
