"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  GitMerge,
  Loader2,
  ExternalLink,
  Layers,
} from "lucide-react";
import {
  useDedupCandidates,
  useRunDedup,
  useResolveDedupCandidate,
} from "@/hooks/use-dedup";
import { PLATFORMS, type PlatformKey } from "@/lib/constants";
import { cn, formatCurrency, formatRelativeDate } from "@/lib/utils";

type StatusFilter = "PENDING" | "CONFIRMED_DUPLICATE" | "NOT_DUPLICATE" | "MERGED" | "";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending Review",
  CONFIRMED_DUPLICATE: "Confirmed",
  NOT_DUPLICATE: "Not Duplicate",
  MERGED: "Merged",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning",
  CONFIRMED_DUPLICATE: "bg-info/10 text-info",
  NOT_DUPLICATE: "bg-muted text-muted-foreground",
  MERGED: "bg-success/10 text-success",
};

export default function DedupSettingsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useDedupCandidates({
    status: statusFilter || undefined,
    page,
  });
  const runDedup = useRunDedup();
  const resolveCandidate = useResolveDedupCandidate();

  const candidates = data?.candidates ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/settings" className="hover:text-foreground">Settings</Link>
        <span>/</span>
        <span className="font-medium text-foreground">Deduplication</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deduplication</h1>
          <p className="text-sm text-muted-foreground">
            Find and merge duplicate listings across platforms
          </p>
        </div>
        <button
          onClick={() => runDedup.mutate()}
          disabled={runDedup.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {runDedup.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Layers className="h-4 w-4" />
          )}
          Run Deduplication
        </button>
      </div>

      {/* Run result banner */}
      {runDedup.isSuccess && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            Deduplication Complete
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Found {runDedup.data.candidatesFound} candidate pairs across{" "}
            {runDedup.data.groupsCreated} groups.
            {runDedup.data.errors.length > 0 && (
              <span className="text-warning">
                {" "}({runDedup.data.errors.length} errors)
              </span>
            )}
          </p>
        </div>
      )}

      {/* How it works info */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-4">
        <h3 className="mb-2 text-sm font-semibold text-info">
          How Deduplication Works
        </h3>
        <ol className="space-y-1 text-sm text-muted-foreground">
          <li>
            <span className="font-medium">1. Blocking:</span> Listings are
            grouped by location, price range, and title similarity to reduce
            comparisons
          </li>
          <li>
            <span className="font-medium">2. Scoring:</span> Each candidate pair
            is scored using weighted Jaro-Winkler similarity across title, price,
            location, industry, and broker fields
          </li>
          <li>
            <span className="font-medium">3. Review:</span> Pairs scoring above
            0.65 are flagged for review. Pairs above 0.85 are auto-merged
          </li>
          <li>
            <span className="font-medium">4. Merge:</span> When merged, listing
            sources are combined under a single primary listing
          </li>
        </ol>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b">
        {(
          [
            { value: "PENDING", label: "Pending Review" },
            { value: "", label: "All" },
            { value: "MERGED", label: "Merged" },
            { value: "NOT_DUPLICATE", label: "Not Duplicate" },
          ] as { value: StatusFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              statusFilter === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => refetch()}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Dedup candidates list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Layers className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-medium">No duplicate candidates found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusFilter === "PENDING"
              ? "Run deduplication to scan for potential duplicate listings across platforms."
              : "No candidates match the selected filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onMerge={(primaryId) =>
                resolveCandidate.mutate({
                  candidateId: candidate.id,
                  action: "merge",
                  primaryId,
                })
              }
              onReject={() =>
                resolveCandidate.mutate({ candidateId: candidate.id, action: "reject" })
              }
              isMutating={resolveCandidate.isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ── Candidate Card Component ──

interface ListingInfo {
  id: string;
  title: string;
  businessName: string | null;
  askingPrice: string | null;
  revenue: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  sources: Array<{ platform: string; sourceUrl: string }>;
}

interface CandidateCardProps {
  candidate: {
    id: string;
    listingAId: string;
    listingBId: string;
    overallScore: number;
    nameScore: number | null;
    locationScore: number | null;
    priceScore: number | null;
    status: string;
    createdAt: string;
    listingA: ListingInfo | null;
    listingB: ListingInfo | null;
  };
  onMerge: (primaryId: string) => void;
  onReject: () => void;
  isMutating: boolean;
}

function CandidateCard({ candidate, onMerge, onReject, isMutating }: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const scorePercent = Math.round(candidate.overallScore * 100);

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/30"
      >
        {/* Score */}
        <div
          className={cn(
            "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold",
            scorePercent >= 85
              ? "bg-destructive/10 text-destructive"
              : scorePercent >= 70
              ? "bg-warning/10 text-warning"
              : "bg-info/10 text-info"
          )}
        >
          {scorePercent}%
        </div>

        {/* Pair summary */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">
              {candidate.listingA?.title ?? "Unknown"}{" "}
              <span className="text-muted-foreground">vs</span>{" "}
              {candidate.listingB?.title ?? "Unknown"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {candidate.listingA?.sources.map((s) => (
              <span
                key={s.sourceUrl}
                className="rounded px-1 py-0.5 text-white"
                style={{
                  backgroundColor:
                    PLATFORMS[s.platform as PlatformKey]?.color ?? "#6b7280",
                }}
              >
                {PLATFORMS[s.platform as PlatformKey]?.shortLabel ?? s.platform}
              </span>
            ))}
            <span className="text-muted-foreground/50">↔</span>
            {candidate.listingB?.sources.map((s) => (
              <span
                key={s.sourceUrl}
                className="rounded px-1 py-0.5 text-white"
                style={{
                  backgroundColor:
                    PLATFORMS[s.platform as PlatformKey]?.color ?? "#6b7280",
                }}
              >
                {PLATFORMS[s.platform as PlatformKey]?.shortLabel ?? s.platform}
              </span>
            ))}
          </div>
        </div>

        {/* Status & date */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              STATUS_COLORS[candidate.status] ?? "bg-muted text-muted-foreground"
            )}
          >
            {STATUS_LABELS[candidate.status] ?? candidate.status}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeDate(candidate.createdAt)}
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          {/* Listings side-by-side */}
          <div className="grid gap-3 md:grid-cols-2">
            {[candidate.listingA, candidate.listingB].map(
              (listing, idx) =>
                listing && (
                  <div key={listing.id} className="rounded-md border bg-muted/20 p-3">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      Listing {idx === 0 ? "A" : "B"}
                    </div>
                    <h4 className="text-sm font-medium">{listing.title}</h4>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {listing.businessName && <span>{listing.businessName}</span>}
                      {listing.askingPrice && (
                        <span>{formatCurrency(parseFloat(listing.askingPrice))}</span>
                      )}
                      {listing.city && listing.state && (
                        <span>
                          {listing.city}, {listing.state}
                        </span>
                      )}
                      {listing.industry && <span>{listing.industry}</span>}
                    </div>
                    <div className="mt-2 flex gap-1">
                      {listing.sources.map((s) => (
                        <a
                          key={s.sourceUrl}
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white"
                          style={{
                            backgroundColor:
                              PLATFORMS[s.platform as PlatformKey]?.color ?? "#6b7280",
                          }}
                        >
                          {PLATFORMS[s.platform as PlatformKey]?.shortLabel ?? s.platform}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )
            )}
          </div>

          {/* Actions */}
          {candidate.status === "PENDING" && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => onMerge(candidate.listingAId)}
                disabled={isMutating}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <GitMerge className="h-3 w-3" />
                Merge (Keep A)
              </button>
              <button
                onClick={() => onMerge(candidate.listingBId)}
                disabled={isMutating}
                className="inline-flex items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                <GitMerge className="h-3 w-3" />
                Merge (Keep B)
              </button>
              <button
                onClick={onReject}
                disabled={isMutating}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <XCircle className="h-3 w-3" />
                Not Duplicate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
