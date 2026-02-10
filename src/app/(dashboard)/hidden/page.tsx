"use client";

import Link from "next/link";
import {
  Eye,
  EyeOff,
  MapPin,
  Building2,
  ExternalLink,
} from "lucide-react";
import { useListings, useToggleHidden } from "@/hooks/use-listings";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";

export default function HiddenListingsPage() {
  const { data, isLoading } = useListings({
    showHidden: true,
    meetsThreshold: false,
    sortBy: "lastSeenAt",
    sortDir: "desc",
    pageSize: 100,
  });
  const toggleHidden = useToggleHidden();

  const hiddenListings =
    data?.listings?.filter((l: Record<string, unknown>) => l.isHidden) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label="Loading hidden listings">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Hidden Listings</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Hidden Listings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hiddenListings.length} listing{hiddenListings.length !== 1 ? "s" : ""}{" "}
          hidden from your main view
        </p>
      </div>

      {hiddenListings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <EyeOff className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-medium">No Hidden Listings</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Listings you hide from the main view will appear here. You can
            unhide them at any time.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {hiddenListings.map(
            (listing: Record<string, unknown> & {
              id: string;
              title: string;
              sources: { id: string; platform: string; sourceUrl: string }[];
            }) => (
              <div
                key={listing.id}
                className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="truncate font-medium hover:text-primary hover:underline"
                    >
                      {listing.title}
                    </Link>
                    {listing.sources?.[0] &&
                      !listing.sources[0].sourceUrl.startsWith("manual://") && (
                        <a
                          href={listing.sources[0].sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    {Boolean(listing.city) && Boolean(listing.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {String(listing.city)}, {String(listing.state)}
                      </span>
                    )}
                    {Boolean(listing.industry) && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {String(listing.industry)}
                      </span>
                    )}
                    {Boolean(listing.askingPrice) && (
                      <span className="font-medium text-foreground">
                        {formatCurrency(Number(listing.askingPrice))}
                      </span>
                    )}
                    <span>Hidden {formatRelativeDate(String(listing.lastSeenAt))}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleHidden.mutate(listing.id)}
                  disabled={toggleHidden.isPending}
                  className="ml-4 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" />
                  Unhide
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
