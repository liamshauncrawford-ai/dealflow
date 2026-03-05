"use client";

import "leaflet/dist/leaflet.css";

import { useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { STAGE_COLORS, TRADE_COLORS } from "@/lib/chart-colors";
import type { MapData } from "@/components/market-intel/deal-map";
import { cn } from "@/lib/utils";

const COLORADO_CENTER: LatLngExpression = [39.55, -105.78];
const DEFAULT_ZOOM = 7;

// Human-readable stage labels
const STAGE_LABELS: Record<string, string> = {
  CONTACTING: "Contacting",
  REQUESTED_CIM: "Requested CIM",
  SIGNED_NDA: "Signed NDA",
  SCHEDULING_FIRST_MEETING: "Owner Meeting",
  OFFER_SENT: "LOI & Offer Sent",
  COUNTER_OFFER_RECEIVED: "Counter Offer",
  DUE_DILIGENCE: "Due Diligence",
  UNDER_CONTRACT: "Under Contract",
  ON_HOLD: "On Hold",
};

// Human-readable trade labels
const TRADE_LABELS: Record<string, string> = {
  ELECTRICAL: "Electrical",
  STRUCTURED_CABLING: "Structured Cabling",
  SECURITY_FIRE_ALARM: "Security / Fire Alarm",
  FRAMING_DRYWALL: "Framing / Drywall",
  HVAC_MECHANICAL: "HVAC / Mechanical",
  PLUMBING: "Plumbing",
  PAINTING_FINISHING: "Painting / Finishing",
  CONCRETE_MASONRY: "Concrete / Masonry",
  ROOFING: "Roofing",
  SITE_WORK: "Site Work",
  GENERAL_COMMERCIAL: "General Commercial",
};

function formatCurrency(value: number | null): string {
  if (value == null) return "N/A";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// Component to handle map resize when container size changes
function MapResizer() {
  const map = useMap();
  useMemo(() => {
    // Invalidate map size after a tick to account for container layout
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

interface DealMapInnerProps {
  data: MapData | null;
  isLoading: boolean;
  compact?: boolean;
}

export default function DealMapInner({ data, isLoading, compact = false }: DealMapInnerProps) {
  const [showListings, setShowListings] = useState(true);
  const [showPipeline, setShowPipeline] = useState(true);

  const listings = data?.listings ?? [];
  const pipelineDeals = data?.pipelineDeals ?? [];

  // Collect which trade colors are actually used for the legend
  const usedTrades = useMemo(() => {
    const trades = new Set<string>();
    if (showListings) {
      for (const l of listings) {
        if (l.primaryTrade) trades.add(l.primaryTrade);
      }
    }
    return trades;
  }, [listings, showListings]);

  // Collect which stage colors are actually used for the legend
  const usedStages = useMemo(() => {
    const stages = new Set<string>();
    if (showPipeline) {
      for (const d of pipelineDeals) {
        stages.add(d.stage);
      }
    }
    return stages;
  }, [pipelineDeals, showPipeline]);

  // Pipeline deal IDs to exclude from listings (avoid double markers)
  const pipelineListingIds = useMemo(() => {
    // We can't directly match since pipeline deals don't include listingId in the response,
    // but we can deduplicate by lat/lng proximity
    return new Set<string>();
  }, []);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={COLORADO_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full rounded-lg"
        scrollWheelZoom={!compact}
      >
        <MapResizer />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Listing markers (smaller, colored by trade) */}
        {showListings &&
          listings.map((listing) => (
            <CircleMarker
              key={`listing-${listing.id}`}
              center={[listing.latitude, listing.longitude]}
              radius={compact ? 4 : 5}
              pathOptions={{
                color:
                  TRADE_COLORS[listing.primaryTrade ?? ""] ?? "#6b7280",
                fillColor:
                  TRADE_COLORS[listing.primaryTrade ?? ""] ?? "#6b7280",
                fillOpacity: 0.7,
                weight: 1,
              }}
              eventHandlers={{
                click: () => {
                  window.location.href = `/listings/${listing.id}`;
                },
              }}
            >
              <Tooltip>
                <div className="space-y-0.5 text-xs">
                  <p className="font-semibold">{listing.title}</p>
                  {listing.primaryTrade && (
                    <p>
                      Trade:{" "}
                      {TRADE_LABELS[listing.primaryTrade] ??
                        listing.primaryTrade}
                    </p>
                  )}
                  {listing.city && listing.state && (
                    <p>
                      {listing.city}, {listing.state}
                    </p>
                  )}
                  {listing.askingPrice != null && (
                    <p>Asking: {formatCurrency(listing.askingPrice)}</p>
                  )}
                  {listing.tier && (
                    <p>Tier: {listing.tier.replace(/_/g, " ")}</p>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
          ))}

        {/* Pipeline deal markers (larger, colored by stage) */}
        {showPipeline &&
          pipelineDeals.map((deal) => (
            <CircleMarker
              key={`deal-${deal.id}`}
              center={[deal.latitude, deal.longitude]}
              radius={compact ? 7 : 10}
              pathOptions={{
                color: STAGE_COLORS[deal.stage] ?? "#6b7280",
                fillColor: STAGE_COLORS[deal.stage] ?? "#6b7280",
                fillOpacity: 0.8,
                weight: 2,
              }}
              eventHandlers={{
                click: () => {
                  window.location.href = `/pipeline/${deal.id}`;
                },
              }}
            >
              <Tooltip>
                <div className="space-y-0.5 text-xs">
                  <p className="font-semibold">{deal.title}</p>
                  <p>
                    Stage:{" "}
                    {STAGE_LABELS[deal.stage] ?? deal.stage}
                  </p>
                  {deal.city && deal.state && (
                    <p>
                      {deal.city}, {deal.state}
                    </p>
                  )}
                  {deal.primaryTrade && (
                    <p>
                      Trade:{" "}
                      {TRADE_LABELS[deal.primaryTrade] ?? deal.primaryTrade}
                    </p>
                  )}
                  {deal.revenue != null && (
                    <p>Revenue: {formatCurrency(deal.revenue)}</p>
                  )}
                  {deal.dealValue != null && (
                    <p>Deal Value: {formatCurrency(deal.dealValue)}</p>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
      </MapContainer>

      {/* Legend and layer toggles */}
      <div className={cn(
        "absolute right-3 top-3 z-[1000] overflow-y-auto rounded-lg border bg-card/95 shadow-lg backdrop-blur-sm",
        compact ? "max-h-[50vh] p-2" : "max-h-[70vh] p-3"
      )}>
        {/* Layer toggles */}
        <div className="mb-3 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Layers</p>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showListings}
              onChange={(e) => setShowListings(e.target.checked)}
              className="rounded"
            />
            Listings ({listings.length})
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showPipeline}
              onChange={(e) => setShowPipeline(e.target.checked)}
              className="rounded"
            />
            Pipeline ({pipelineDeals.length})
          </label>
        </div>

        {/* Pipeline stage legend */}
        {showPipeline && usedStages.size > 0 && (
          <div className="mb-3 space-y-1">
            <p className="text-xs font-semibold text-foreground">
              Pipeline Stages
            </p>
            {Array.from(usedStages).map((stage) => (
              <div key={stage} className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: STAGE_COLORS[stage] ?? "#6b7280",
                  }}
                />
                <span className="text-muted-foreground">
                  {STAGE_LABELS[stage] ?? stage}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Trade legend */}
        {showListings && usedTrades.size > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">
              Listing Trades
            </p>
            {Array.from(usedTrades).map((trade) => (
              <div key={trade} className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: TRADE_COLORS[trade] ?? "#6b7280",
                  }}
                />
                <span className="text-muted-foreground">
                  {TRADE_LABELS[trade] ?? trade}
                </span>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <p className="mt-2 text-xs text-muted-foreground">Loading data...</p>
        )}
      </div>
    </div>
  );
}
