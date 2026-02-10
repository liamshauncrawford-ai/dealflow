"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PLATFORMS, type PlatformKey } from "@/lib/constants";
import type { ListingFilters } from "@/types/listing";

interface ListingFiltersProps {
  filters: ListingFilters;
  onFiltersChange: (filters: ListingFilters) => void;
}

export function ListingFiltersPanel({ filters, onFiltersChange }: ListingFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) =>
      value !== undefined &&
      value !== "" &&
      key !== "meetsThreshold" &&
      key !== "showHidden" &&
      key !== "showInactive"
  ).length;

  const updateFilter = (key: keyof ListingFilters, value: unknown) => {
    onFiltersChange({
      ...filters,
      [key]: value === "" ? undefined : value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="rounded-lg border bg-card">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t px-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
              <input
                type="text"
                value={filters.search || ""}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder="Business name, industry..."
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Location */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">City</label>
              <input
                type="text"
                value={filters.city || ""}
                onChange={(e) => updateFilter("city", e.target.value)}
                placeholder="Denver, Boulder..."
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Industry */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Industry</label>
              <input
                type="text"
                value={filters.industry || ""}
                onChange={(e) => updateFilter("industry", e.target.value)}
                placeholder="Construction, HVAC..."
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Platform */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Platform</label>
              <select
                value={filters.platform || ""}
                onChange={(e) => updateFilter("platform", e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Platforms</option>
                {Object.entries(PLATFORMS).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Min Price</label>
              <input
                type="number"
                value={filters.minPrice ?? ""}
                onChange={(e) => updateFilter("minPrice", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="$0"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Price</label>
              <input
                type="number"
                value={filters.maxPrice ?? ""}
                onChange={(e) => updateFilter("maxPrice", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="No max"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* EBITDA Range */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Min EBITDA</label>
              <input
                type="number"
                value={filters.minEbitda ?? ""}
                onChange={(e) => updateFilter("minEbitda", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="$600,000"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Max EBITDA</label>
              <input
                type="number"
                value={filters.maxEbitda ?? ""}
                onChange={(e) => updateFilter("maxEbitda", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="No max"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Revenue Range */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Min Revenue</label>
              <input
                type="number"
                value={filters.minRevenue ?? ""}
                onChange={(e) => updateFilter("minRevenue", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="$0"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Revenue</label>
              <input
                type="number"
                value={filters.maxRevenue ?? ""}
                onChange={(e) => updateFilter("maxRevenue", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="No max"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Toggles row */}
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.showHidden || false}
                onChange={(e) => updateFilter("showHidden", e.target.checked || undefined)}
                className="rounded"
              />
              Show hidden
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.showInactive || false}
                onChange={(e) => updateFilter("showInactive", e.target.checked || undefined)}
                className="rounded"
              />
              Show removed listings
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.meetsThreshold !== false}
                onChange={(e) => updateFilter("meetsThreshold", e.target.checked)}
                className="rounded"
              />
              EBITDA/SDE &gt;= $600K only
            </label>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-sm text-destructive hover:underline"
              >
                <X className="h-3 w-3" />
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
