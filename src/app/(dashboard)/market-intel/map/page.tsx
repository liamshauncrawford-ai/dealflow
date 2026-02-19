"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Map as MapIcon, ArrowRight } from "lucide-react";
import { useMapData } from "@/hooks/use-market-intel";
import { GoogleMapsProvider } from "@/components/maps/google-maps-provider";
import { MapView } from "@/components/maps/map-view";
import { MapFilterPanel } from "@/components/maps/map-filter-panel";
import { MapLegend } from "@/components/maps/map-legend";

export default function MarketMapPage() {
  const [filters, setFilters] = useState({
    showFacilities: true,
    showListings: false,
    operatorTier: "",
    facilityStatus: "",
  });

  // Build query params from filters
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      showFacilities: String(filters.showFacilities),
      showListings: String(filters.showListings),
    };
    if (filters.operatorTier) params.operatorTier = filters.operatorTier;
    if (filters.facilityStatus) params.facilityStatus = filters.facilityStatus;
    return params;
  }, [filters]);

  const { data, isLoading } = useMapData(queryParams);
  const facilities = data?.facilities ?? [];
  const listings = data?.listings ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Map</h1>
          <p className="text-sm text-muted-foreground">
            Colorado Front Range data center facilities and acquisition targets
          </p>
        </div>
        <Link
          href="/market-intel/operators"
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
        >
          DC Operators <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Filters */}
      <MapFilterPanel
        filters={filters}
        onChange={setFilters}
        facilityCount={facilities.length}
        listingCount={listings.length}
      />

      {/* Map + Legend */}
      <div className="relative">
        <GoogleMapsProvider>
          <MapView
            facilities={facilities}
            listings={listings}
            height="calc(100vh - 280px)"
          />
        </GoogleMapsProvider>

        {/* Legend overlay — bottom-left */}
        <div className="absolute bottom-4 left-4 z-10">
          <MapLegend
            mode="tier"
            showListings={filters.showListings}
          />
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapIcon className="h-5 w-5 animate-pulse" />
              Loading map data...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
