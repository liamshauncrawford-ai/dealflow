"use client";

import { useState, useCallback, useEffect } from "react";
import { Users } from "lucide-react";
import type { SortingState } from "@tanstack/react-table";
import { useAllContacts } from "@/hooks/use-all-contacts";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { ContactFiltersPanel } from "@/components/contacts/contact-filters";
import { ContactDetailSheet } from "@/components/contacts/contact-detail-sheet";
import type { ContactFilters, ContactWithOpportunity } from "@/types/contact";

const FILTERS_STORAGE_KEY = "dealflow-contact-filters";

function loadSavedFilters(): ContactFilters {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export default function ContactsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [filters, setFilters] = useState<ContactFilters>(loadSavedFilters);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [selectedContact, setSelectedContact] = useState<ContactWithOpportunity | null>(null);

  // Persist filters to localStorage
  useEffect(() => {
    const hasFilters = Object.values(filters).some(
      (v) => v !== undefined && v !== "" && v !== false
    );
    if (hasFilters) {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } else {
      localStorage.removeItem(FILTERS_STORAGE_KEY);
    }
  }, [filters]);

  const sortBy = sorting[0]?.id || "createdAt";
  const sortDir = sorting[0]?.desc ? "desc" : "asc";

  const { data, isLoading, error } = useAllContacts({
    page,
    pageSize,
    sortBy,
    sortDir,
    ...filters,
  });

  const handleSortingChange = useCallback(
    (newSorting: SortingState) => {
      setSorting(newSorting);
      setPage(1);
    },
    []
  );

  const handleFiltersChange = useCallback(
    (newFilters: ContactFilters) => {
      setFilters(newFilters);
      setPage(1);
    },
    []
  );

  const handleContactClick = useCallback(
    (contact: ContactWithOpportunity) => {
      setSelectedContact(contact);
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold text-foreground">Contacts</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data ? `${data.total} contacts across all deals` : "Loading..."}
          </p>
        </div>
      </div>

      {/* Filters */}
      <ContactFiltersPanel filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load contacts. Please try again.
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          className="rounded-lg border bg-card p-8 text-center text-muted-foreground"
          role="status"
          aria-label="Loading contacts"
        >
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          <p className="mt-2">Loading contacts...</p>
        </div>
      )}

      {/* Table */}
      {data && !isLoading && (
        <>
          <ContactsTable
            contacts={data.contacts}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            onContactClick={handleContactClick}
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

      {/* Detail Sheet */}
      <ContactDetailSheet
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
      />
    </div>
  );
}
