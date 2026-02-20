"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Map as MapIcon, ArrowRight, X, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMapData } from "@/hooks/use-market-intel";
import { GoogleMapsProvider } from "@/components/maps/google-maps-provider";
import { MapView, type FacilityMarker } from "@/components/maps/map-view";
import { MapFilterPanel } from "@/components/maps/map-filter-panel";
import { MapLegend } from "@/components/maps/map-legend";

interface NearbyListing {
  id: string;
  title: string;
  businessName: string | null;
  compositeScore: number | null;
  primaryTrade: string | null;
  distanceMi: number;
  askingPrice: number | null;
  city: string | null;
  state: string | null;
}

interface ProximityResult {
  facility: {
    id: string;
    facilityName: string;
    latitude: number;
    longitude: number;
    capacityMW: number | null;
    operatorName: string | null;
    estimatedCablingValue: number | null;
  };
  nearbyListings: NearbyListing[];
  count: number;
}

export default function MarketMapPage() {
  const [filters, setFilters] = useState({
    showFacilities: true,
    showListings: false,
    operatorTier: "",
    facilityStatus: "",
    proximityRadius: 25,
  });

  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [selectedFacilityCoords, setSelectedFacilityCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

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

  // Proximity query
  const { data: proximityData, isLoading: proximityLoading } = useQuery<ProximityResult>({
    queryKey: ["proximity", selectedFacilityId, filters.proximityRadius],
    queryFn: async () => {
      const res = await fetch(
        `/api/market-intel/proximity?facilityId=${selectedFacilityId}&radiusMiles=${filters.proximityRadius}`
      );
      if (!res.ok) throw new Error("Failed to fetch proximity data");
      return res.json();
    },
    enabled: !!selectedFacilityId,
  });

  const handleFacilityClick = (facility: FacilityMarker) => {
    setSelectedFacilityId(facility.id);
    setSelectedFacilityCoords({ lat: facility.latitude, lng: facility.longitude });
    setFilters((f) => ({ ...f, showListings: true }));
  };

  const clearProximity = () => {
    setSelectedFacilityId(null);
    setSelectedFacilityCoords(null);
  };

  const proximityCircle = selectedFacilityCoords
    ? { center: selectedFacilityCoords, radiusMiles: filters.proximityRadius }
    : null;

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
        showProximity={!!selectedFacilityId}
        onClearProximity={clearProximity}
      />

      {/* Map + Sidebar */}
      <div className="flex gap-4">
        {/* Map */}
        <div className="relative flex-1">
          <GoogleMapsProvider>
            <MapView
              facilities={facilities}
              listings={listings}
              height="calc(100vh - 280px)"
              proximityCircle={proximityCircle}
              onFacilityClick={handleFacilityClick}
            />
          </GoogleMapsProvider>

          {/* Legend overlay */}
          <div className="absolute bottom-4 left-4 z-10">
            <MapLegend mode="tier" showListings={filters.showListings} />
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

        {/* Proximity sidebar */}
        {selectedFacilityId && (
          <div className="w-80 shrink-0 overflow-y-auto rounded-lg border bg-card" style={{ maxHeight: "calc(100vh - 280px)" }}>
            <div className="sticky top-0 z-10 border-b bg-card px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold">Nearby Targets</h3>
                </div>
                <button onClick={clearProximity} className="rounded p-1 hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {proximityData?.facility && (
                <div className="mt-1">
                  <p className="text-xs font-medium">{proximityData.facility.facilityName}</p>
                  <p className="text-xs text-muted-foreground">
                    {proximityData.facility.operatorName}
                    {proximityData.facility.capacityMW && ` · ${proximityData.facility.capacityMW} MW`}
                  </p>
                  {proximityData.facility.estimatedCablingValue && (
                    <p className="text-xs text-blue-600">
                      Est. cabling: ${(proximityData.facility.estimatedCablingValue / 1_000_000).toFixed(1)}M
                    </p>
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {proximityData?.count ?? 0} targets within {filters.proximityRadius} mi
              </p>
            </div>

            {proximityLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
              </div>
            ) : (
              <div className="divide-y">
                {proximityData?.nearbyListings.map((l) => (
                  <Link
                    key={l.id}
                    href={`/listings/${l.id}`}
                    className="block px-4 py-3 hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {l.businessName ?? l.title}
                        </p>
                        {l.primaryTrade && (
                          <p className="text-xs text-muted-foreground">
                            {l.primaryTrade.replace(/_/g, " ")}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {l.city}, {l.state} · {l.distanceMi} mi
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {l.compositeScore != null && (
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {l.compositeScore}
                          </span>
                        )}
                        {l.askingPrice && (
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            ${(l.askingPrice / 1_000_000).toFixed(2)}M
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
                {(!proximityData?.nearbyListings || proximityData.nearbyListings.length === 0) && (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No targets found within {filters.proximityRadius} mi
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
