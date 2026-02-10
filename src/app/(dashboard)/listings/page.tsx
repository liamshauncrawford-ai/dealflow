"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Download, EyeOff, X } from "lucide-react";
import type { SortingState, RowSelectionState } from "@tanstack/react-table";
import { useListings, useToggleHidden, usePromoteToPipeline } from "@/hooks/use-listings";
import { ListingsTable } from "@/components/listings/listings-table";
import { ListingFiltersPanel } from "@/components/listings/listing-filters";
import type { ListingFilters } from "@/types/listing";
import Link from "next/link";
import { toast } from "sonner";

const FILTERS_STORAGE_KEY = "dealflow-listing-filters";

function loadSavedFilters(): ListingFilters {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export default function ListingsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [filters, setFilters] = useState<ListingFilters>(loadSavedFilters);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lastSeenAt", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Persist filters to localStorage
  useEffect(() => {
    const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "");
    if (hasFilters) {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } else {
      localStorage.removeItem(FILTERS_STORAGE_KEY);
    }
  }, [filters]);

  const sortBy = sorting[0]?.id || "lastSeenAt";
  const sortDir = sorting[0]?.desc ? "desc" : "asc";

  const { data, isLoading, error } = useListings({
    page,
    pageSize,
    sortBy,
    sortDir,
    ...filters,
  });

  const toggleHidden = useToggleHidden();
  const promoteToPipeline = usePromoteToPipeline();

  const handleHide = useCallback(
    (id: string) => {
      toggleHidden.mutate(id);
    },
    [toggleHidden]
  );

  const handlePromote = useCallback(
    (id: string) => {
      promoteToPipeline.mutate({ id });
    },
    [promoteToPipeline]
  );

  const handleSortingChange = useCallback(
    (newSorting: SortingState) => {
      setSorting(newSorting);
      setPage(1);
    },
    []
  );

  const handleFiltersChange = useCallback(
    (newFilters: ListingFilters) => {
      setFilters(newFilters);
      setPage(1);
    },
    []
  );

  const selectedCount = Object.keys(rowSelection).length;
  const selectedIds = data?.listings
    ? Object.keys(rowSelection).map((idx) => data.listings[Number(idx)]?.id).filter(Boolean)
    : [];

  const handleBulkHide = useCallback(async () => {
    for (const id of selectedIds) {
      toggleHidden.mutate(id);
    }
    toast.success(`${selectedIds.length} listing(s) hidden`);
    setRowSelection({});
  }, [selectedIds, toggleHidden]);

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.platform) params.set("platform", filters.platform);
    if (filters.state) params.set("state", filters.state);
    if (filters.showHidden) params.set("showHidden", "true");
    window.open(`/api/listings/export?${params.toString()}`, "_blank");
  }, [filters]);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Listings</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} businesses found` : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <Link
            href="/listings/add"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Listing
          </Link>
        </div>
      </div>

      {/* Filters */}
      <ListingFiltersPanel filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load listings. Please try again.
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground" role="status" aria-label="Loading listings">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          <p className="mt-2">Loading listings...</p>
        </div>
      )}

      {/* Bulk actions toolbar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <button
            onClick={handleBulkHide}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Hide All
          </button>
          <button
            onClick={() => setRowSelection({})}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {data && !isLoading && (
        <>
          <ListingsTable
            listings={data.listings}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            onHide={handleHide}
            onPromote={handlePromote}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
          />

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, data.total)} of {data.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                  const pageNum =
                    data.totalPages <= 5
                      ? i + 1
                      : Math.max(1, Math.min(page - 2, data.totalPages - 4)) + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                        pageNum === page
                          ? "bg-primary text-primary-foreground"
                          : "border hover:bg-muted"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
