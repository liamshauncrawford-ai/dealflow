"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Cable } from "lucide-react";
import { useCablingOpportunity, useDeleteCablingOpportunity } from "@/hooks/use-market-intel";
import {
  CABLING_STATUSES,
  CABLING_SCOPES,
  type CablingStatusKey,
} from "@/lib/market-intel-constants";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { CablingForm } from "@/components/market-intel/cabling-form";

function formatCurrency(value: number | null | undefined): string {
  if (!value) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function CablingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const { data: opp, isLoading } = useCablingOpportunity(isNew ? null : id);
  const [editing, setEditing] = useState(isNew);
  const router = useRouter();
  const deleteOpp = useDeleteCablingOpportunity();

  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/market-intel/opportunities" className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">New Cabling Opportunity</h1>
        </div>
        <CablingForm onSuccess={() => router.push("/market-intel/opportunities")} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!opp) {
    return <div className="py-12 text-center text-muted-foreground">Cabling opportunity not found</div>;
  }

  const statusConfig = opp.status ? CABLING_STATUSES[opp.status as CablingStatusKey] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/market-intel/opportunities" className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{opp.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {statusConfig && (
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusConfig.badge)}>
                  {statusConfig.label}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this cabling opportunity?")) {
                deleteOpp.mutate(id, { onSuccess: () => router.push("/market-intel/opportunities") });
              }
            }}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>

      {editing ? (
        <CablingForm initialData={opp} onSuccess={() => setEditing(false)} />
      ) : (
        <>
          {/* Value Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ValueCard label="Estimated Value" value={formatCurrency(opp.estimatedValue)} />
            <ValueCard label="Bid Submitted" value={formatCurrency(opp.bidSubmittedValue)} />
            <ValueCard label="Awarded Value" value={formatCurrency(opp.awardedValue)} accent />
            <ValueCard label="Actual Value" value={formatCurrency(opp.actualValue)} />
          </div>

          {/* Info Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold">Relationships</h3>
              <div className="space-y-2">
                <InfoRow label="Operator" value={
                  opp.operator ? (
                    <Link href={`/market-intel/operators/${opp.operator.id}`} className="text-primary hover:underline">
                      {opp.operator.name}
                    </Link>
                  ) : "—"
                } />
                <InfoRow label="GC" value={
                  opp.gc ? (
                    <Link href={`/market-intel/gcs/${opp.gc.id}`} className="text-primary hover:underline">
                      {opp.gc.name}
                    </Link>
                  ) : "—"
                } />
                <InfoRow label="Facility" value={
                  opp.facility ? `${opp.facility.facilityName}${opp.facility.capacityMW ? ` (${opp.facility.capacityMW} MW)` : ""}` : "—"
                } />
                {opp.facilityAddress && <InfoRow label="Address" value={opp.facilityAddress} />}
                {opp.facilitySizeMW && <InfoRow label="Facility Size" value={`${opp.facilitySizeMW} MW`} />}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold">Timeline</h3>
              <div className="space-y-2">
                <InfoRow label="RFQ Date" value={formatDate(opp.rfqDate)} />
                <InfoRow label="Bid Due" value={formatDate(opp.bidDueDate)} />
                <InfoRow label="Construction Start" value={formatDate(opp.constructionStart)} />
                <InfoRow label="Construction End" value={formatDate(opp.constructionEnd)} />
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold">Scope</h3>
              <div className="space-y-2">
                {opp.cablingScopes?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {opp.cablingScopes.map((scope: string) => {
                      const scopeConfig = CABLING_SCOPES[scope as keyof typeof CABLING_SCOPES];
                      return (
                        <span key={scope} className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {scopeConfig?.label ?? scope}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No scopes specified</p>
                )}
              </div>
            </div>
          </div>

          {/* Loss Details */}
          {(opp.status === "LOST" && (opp.lossReason || opp.competitorWhoWon)) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
              <h3 className="mb-2 font-semibold text-red-800 dark:text-red-400">Loss Details</h3>
              {opp.lossReason && <p className="text-sm text-red-700 dark:text-red-300">{opp.lossReason}</p>}
              {opp.competitorWhoWon && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">Won by: {opp.competitorWhoWon}</p>
              )}
            </div>
          )}

          {/* Description */}
          {opp.description && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 font-semibold">Description</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{opp.description}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function ValueCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums", accent && value !== "—" && "text-emerald-600 dark:text-emerald-400")}>
        {value}
      </p>
    </div>
  );
}
