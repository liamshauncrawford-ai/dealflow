"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  OUTREACH_STATUSES,
  CONTACT_SENTIMENTS,
  type PipelineStageKey,
} from "@/lib/constants";
import type { ContactFilters } from "@/types/contact";

interface ContactFiltersProps {
  filters: ContactFilters;
  onFiltersChange: (filters: ContactFilters) => void;
}

const INTEREST_LEVELS = {
  UNKNOWN: "Unknown",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  VERY_HIGH: "Very High",
} as const;

export function ContactFiltersPanel({ filters, onFiltersChange }: ContactFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFilterCount = Object.entries(filters).filter(
    ([, value]) => value !== undefined && value !== "" && value !== false
  ).length;

  const updateFilter = (key: keyof ContactFilters, value: unknown) => {
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
                placeholder="Name, email, company..."
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Interest Level */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Interest Level</label>
              <select
                value={filters.interestLevel || ""}
                onChange={(e) => updateFilter("interestLevel", e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All levels</option>
                {Object.entries(INTEREST_LEVELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Outreach Status */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Outreach Status</label>
              <select
                value={filters.outreachStatus || ""}
                onChange={(e) => updateFilter("outreachStatus", e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All statuses</option>
                {Object.entries(OUTREACH_STATUSES).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Sentiment */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Sentiment</label>
              <select
                value={filters.sentiment || ""}
                onChange={(e) => updateFilter("sentiment", e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All sentiments</option>
                {Object.entries(CONTACT_SENTIMENTS).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Deal Stage */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Deal Stage</label>
              <select
                value={filters.dealStage || ""}
                onChange={(e) => updateFilter("dealStage", e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All stages</option>
                {Object.entries(PIPELINE_STAGES).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Overdue Only */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={!!filters.overdueOnly}
                  onChange={(e) => updateFilter("overdueOnly", e.target.checked || undefined)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">Overdue follow-ups only</span>
              </label>
            </div>
          </div>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                <X className="h-3 w-3" />
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
