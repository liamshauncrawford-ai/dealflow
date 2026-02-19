"use client";

import { useCallback, useState } from "react";
import {
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import Link from "next/link";
import {
  COLORADO_CENTER,
  DEFAULT_ZOOM,
  TIER_PIN_COLORS,
  STATUS_PIN_COLORS,
  LISTING_PIN_COLOR,
  getMarkerScale,
  type OperatorTier,
  type FacilityStatus,
} from "@/lib/map-constants";
import { getMapId, isMapsConfigured } from "@/components/maps/google-maps-provider";
import { OPERATOR_TIERS, FACILITY_STATUS } from "@/lib/market-intel-constants";
import { MapPin } from "lucide-react";

export interface FacilityMarker {
  id: string;
  facilityName: string;
  latitude: number;
  longitude: number;
  capacityMW: number | null;
  status: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  operatorName: string;
  operatorTier: string | null;
}

export interface ListingMarker {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  askingPrice: number | null;
  city: string | null;
  state: string | null;
  industry: string | null;
}

interface MapViewProps {
  facilities?: FacilityMarker[];
  listings?: ListingMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  className?: string;
}

export function MapView({
  facilities = [],
  listings = [],
  center = COLORADO_CENTER,
  zoom = DEFAULT_ZOOM,
  height = "600px",
  className,
}: MapViewProps) {
  const [selectedFacility, setSelectedFacility] = useState<FacilityMarker | null>(null);
  const [selectedListing, setSelectedListing] = useState<ListingMarker | null>(null);

  if (!isMapsConfigured()) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed bg-muted/20 ${className ?? ""}`}
        style={{ height }}
      >
        <div className="text-center">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            Google Maps API key not configured
          </p>
          <p className="text-xs text-muted-foreground/60">
            Set NEXT_PUBLIC_GOOGLE_MAPS_KEY in .env
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border ${className ?? ""}`} style={{ height }}>
      <Map
        defaultCenter={center}
        defaultZoom={zoom}
        mapId={getMapId()}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Facility markers */}
        {facilities.map((f) => (
          <FacilityPin
            key={f.id}
            facility={f}
            onClick={() => {
              setSelectedFacility(f);
              setSelectedListing(null);
            }}
          />
        ))}

        {/* Listing markers */}
        {listings.map((l) => (
          <ListingPin
            key={l.id}
            listing={l}
            onClick={() => {
              setSelectedListing(l);
              setSelectedFacility(null);
            }}
          />
        ))}

        {/* Info windows */}
        {selectedFacility && (
          <InfoWindow
            position={{
              lat: selectedFacility.latitude,
              lng: selectedFacility.longitude,
            }}
            onCloseClick={() => setSelectedFacility(null)}
          >
            <FacilityInfoContent facility={selectedFacility} />
          </InfoWindow>
        )}

        {selectedListing && (
          <InfoWindow
            position={{
              lat: selectedListing.latitude,
              lng: selectedListing.longitude,
            }}
            onCloseClick={() => setSelectedListing(null)}
          >
            <ListingInfoContent listing={selectedListing} />
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}

// ── Pin Sub-Components ──

function FacilityPin({
  facility,
  onClick,
}: {
  facility: FacilityMarker;
  onClick: () => void;
}) {
  const tier = facility.operatorTier as OperatorTier | null;
  const pinColors = tier ? TIER_PIN_COLORS[tier] : TIER_PIN_COLORS.TIER_3_EXISTING_MAINTENANCE;
  const scale = getMarkerScale(facility.capacityMW);

  return (
    <AdvancedMarker
      position={{ lat: facility.latitude, lng: facility.longitude }}
      onClick={onClick}
      title={`${facility.facilityName} (${facility.operatorName})`}
    >
      <Pin
        background={pinColors.background}
        borderColor={pinColors.border}
        glyphColor={pinColors.glyph}
        scale={scale}
      />
    </AdvancedMarker>
  );
}

function ListingPin({
  listing,
  onClick,
}: {
  listing: ListingMarker;
  onClick: () => void;
}) {
  return (
    <AdvancedMarker
      position={{ lat: listing.latitude, lng: listing.longitude }}
      onClick={onClick}
      title={listing.title}
    >
      <Pin
        background={LISTING_PIN_COLOR.background}
        borderColor={LISTING_PIN_COLOR.border}
        glyphColor={LISTING_PIN_COLOR.glyph}
        scale={0.9}
      />
    </AdvancedMarker>
  );
}

// ── InfoWindow Content ──

function FacilityInfoContent({ facility }: { facility: FacilityMarker }) {
  const tierKey = facility.operatorTier as keyof typeof OPERATOR_TIERS | null;
  const tierConfig = tierKey ? OPERATOR_TIERS[tierKey] : null;
  const statusKey = facility.status as keyof typeof FACILITY_STATUS | null;
  const statusConfig = statusKey ? FACILITY_STATUS[statusKey] : null;

  return (
    <div className="min-w-[200px] max-w-[280px]">
      <p className="text-sm font-semibold text-gray-900">{facility.facilityName}</p>
      <p className="text-xs text-gray-600">{facility.operatorName}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {tierConfig && (
          <span className="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
            {tierConfig.label}
          </span>
        )}
        {statusConfig && (
          <span className="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
            {statusConfig.label}
          </span>
        )}
      </div>
      {facility.capacityMW && (
        <p className="mt-1 text-xs text-gray-500">{facility.capacityMW} MW</p>
      )}
      {(facility.city || facility.address) && (
        <p className="text-xs text-gray-500">
          {facility.address ?? facility.city}, {facility.state}
        </p>
      )}
      <Link
        href={`/market-intel/operators`}
        className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
      >
        View operator →
      </Link>
    </div>
  );
}

function ListingInfoContent({ listing }: { listing: ListingMarker }) {
  return (
    <div className="min-w-[180px] max-w-[260px]">
      <p className="text-sm font-semibold text-gray-900 line-clamp-2">{listing.title}</p>
      {listing.industry && (
        <p className="text-xs text-gray-500">{listing.industry}</p>
      )}
      {listing.askingPrice && (
        <p className="mt-1 text-xs font-medium text-gray-700">
          ${(listing.askingPrice / 1_000_000).toFixed(2)}M
        </p>
      )}
      {listing.city && (
        <p className="text-xs text-gray-500">
          {listing.city}, {listing.state}
        </p>
      )}
      <Link
        href={`/listings/${listing.id}`}
        className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
      >
        View listing →
      </Link>
    </div>
  );
}
