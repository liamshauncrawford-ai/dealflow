"use client";

import { OPERATOR_TIERS, FACILITY_STATUS } from "@/lib/market-intel-constants";

interface MapFilters {
  showFacilities: boolean;
  showListings: boolean;
  operatorTier: string;
  facilityStatus: string;
}

interface MapFilterPanelProps {
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
  facilityCount: number;
  listingCount: number;
}

export function MapFilterPanel({
  filters,
  onChange,
  facilityCount,
  listingCount,
}: MapFilterPanelProps) {
  const update = (partial: Partial<MapFilters>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Layer toggles */}
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filters.showFacilities}
          onChange={(e) => update({ showFacilities: e.target.checked })}
          className="rounded border-gray-300"
        />
        <span>
          Facilities{" "}
          <span className="text-muted-foreground">({facilityCount})</span>
        </span>
      </label>
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filters.showListings}
          onChange={(e) => update({ showListings: e.target.checked })}
          className="rounded border-gray-300"
        />
        <span>
          Listings{" "}
          <span className="text-muted-foreground">({listingCount})</span>
        </span>
      </label>

      {/* Separator */}
      <div className="h-5 w-px bg-border" />

      {/* Operator tier filter */}
      <select
        value={filters.operatorTier}
        onChange={(e) => update({ operatorTier: e.target.value })}
        className="h-8 rounded-md border bg-background px-2 text-sm"
        disabled={!filters.showFacilities}
      >
        <option value="">All Tiers</option>
        {Object.entries(OPERATOR_TIERS).map(([key, val]) => (
          <option key={key} value={key}>
            {val.label}
          </option>
        ))}
      </select>

      {/* Facility status filter */}
      <select
        value={filters.facilityStatus}
        onChange={(e) => update({ facilityStatus: e.target.value })}
        className="h-8 rounded-md border bg-background px-2 text-sm"
        disabled={!filters.showFacilities}
      >
        <option value="">All Statuses</option>
        {Object.entries(FACILITY_STATUS).map(([key, val]) => (
          <option key={key} value={key}>
            {val.label}
          </option>
        ))}
      </select>
    </div>
  );
}
