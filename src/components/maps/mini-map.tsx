"use client";

import { Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import { GoogleMapsProvider, getMapId, isMapsConfigured } from "@/components/maps/google-maps-provider";
import {
  TIER_PIN_COLORS,
  LISTING_PIN_COLOR,
  getMarkerScale,
  ZOOM_LEVELS,
  type OperatorTier,
} from "@/lib/map-constants";
import { MapPin } from "lucide-react";

interface MiniMapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  tier?: string;
  capacityMW?: number | null;
  type: "facility" | "listing";
}

interface MiniMapProps {
  markers: MiniMapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  className?: string;
}

/**
 * Small embeddable map for detail pages.
 * Wraps itself in GoogleMapsProvider so it can be used standalone.
 * No clustering, no filters — just pin markers.
 */
export function MiniMap({
  markers,
  center,
  zoom,
  height = "200px",
  className,
}: MiniMapProps) {
  if (!isMapsConfigured() || markers.length === 0) {
    return null; // Gracefully hide if not configured or no data
  }

  // Auto-center on first marker if not specified
  const mapCenter = center ?? (markers.length > 0
    ? { lat: markers[0].lat, lng: markers[0].lng }
    : { lat: 39.6, lng: -104.85 });

  const mapZoom = zoom ?? (markers.length === 1 ? ZOOM_LEVELS.facility : ZOOM_LEVELS.metro);

  return (
    <GoogleMapsProvider>
      <div className={`rounded-lg overflow-hidden border ${className ?? ""}`} style={{ height }}>
        <Map
          defaultCenter={mapCenter}
          defaultZoom={mapZoom}
          mapId={getMapId()}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          style={{ width: "100%", height: "100%" }}
        >
          {markers.map((m) => {
            if (m.type === "facility") {
              const tier = m.tier as OperatorTier | undefined;
              const colors = tier
                ? TIER_PIN_COLORS[tier]
                : TIER_PIN_COLORS.TIER_3_EXISTING_MAINTENANCE;
              return (
                <AdvancedMarker
                  key={m.id}
                  position={{ lat: m.lat, lng: m.lng }}
                  title={m.label}
                >
                  <Pin
                    background={colors.background}
                    borderColor={colors.border}
                    glyphColor={colors.glyph}
                    scale={getMarkerScale(m.capacityMW ?? null)}
                  />
                </AdvancedMarker>
              );
            }

            // Listing marker
            return (
              <AdvancedMarker
                key={m.id}
                position={{ lat: m.lat, lng: m.lng }}
                title={m.label}
              >
                <Pin
                  background={LISTING_PIN_COLOR.background}
                  borderColor={LISTING_PIN_COLOR.border}
                  glyphColor={LISTING_PIN_COLOR.glyph}
                  scale={0.9}
                />
              </AdvancedMarker>
            );
          })}
        </Map>
      </div>
    </GoogleMapsProvider>
  );
}
