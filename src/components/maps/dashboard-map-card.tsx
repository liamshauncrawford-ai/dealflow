"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMapData } from "@/hooks/use-market-intel";
import { GoogleMapsProvider, isMapsConfigured } from "@/components/maps/google-maps-provider";
import { MapView } from "@/components/maps/map-view";

export function DashboardMapCard() {
  const { data, isLoading } = useMapData({ showFacilities: "true" });
  const facilities = data?.facilities ?? [];

  if (!isMapsConfigured()) return null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="font-medium">Facility Map</h2>
        <Link
          href="/market-intel/map"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Full map <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <GoogleMapsProvider>
        <MapView
          facilities={facilities}
          height="280px"
        />
      </GoogleMapsProvider>
    </div>
  );
}
