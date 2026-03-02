"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";

// Types for map data
export interface MapListing {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  askingPrice: number | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  primaryTrade: string | null;
  tier: string | null;
}

export interface MapPipelineDeal {
  id: string;
  title: string;
  stage: string;
  dealValue: number | null;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  primaryTrade: string | null;
  revenue: number | null;
}

export interface MapData {
  listings: MapListing[];
  pipelineDeals: MapPipelineDeal[];
}

// Dynamically import the inner map component to avoid SSR issues with Leaflet
const DealMapInner = dynamic(
  () => import("@/components/market-intel/deal-map-inner"),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);

function MapSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  );
}

export default function DealMap() {
  const { data, isLoading, error } = useQuery<MapData>({
    queryKey: ["market-map"],
    queryFn: async () => {
      const res = await fetch("/api/market-intel/map");
      if (!res.ok) throw new Error("Failed to fetch map data");
      return res.json();
    },
  });

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium text-destructive">
            Failed to load map data
          </p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return <DealMapInner data={data ?? null} isLoading={isLoading} />;
}
