"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, HardHat, MapPin, Globe, Phone, Mail } from "lucide-react";
import { useGC, useDeleteGC } from "@/hooks/use-market-intel";
import {
  GC_PRIORITIES,
  GC_DC_EXPERIENCE,
  SUB_QUALIFICATION_STATUS,
  GC_RELATIONSHIP_STATUS,
  type GCPriorityKey,
} from "@/lib/market-intel-constants";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { GCForm } from "@/components/market-intel/gc-form";

export default function GCDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const { data: gc, isLoading } = useGC(isNew ? null : id);
  const [editing, setEditing] = useState(isNew);
  const router = useRouter();
  const deleteGC = useDeleteGC();

  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/market-intel/gcs" className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">New General Contractor</h1>
        </div>
        <GCForm onSuccess={() => router.push("/market-intel/gcs")} />
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

  if (!gc) {
    return <div className="py-12 text-center text-muted-foreground">General contractor not found</div>;
  }

  const prioConfig = gc.priority ? GC_PRIORITIES[gc.priority as GCPriorityKey] : null;
  const expConfig = gc.dcExperienceLevel ? GC_DC_EXPERIENCE[gc.dcExperienceLevel as keyof typeof GC_DC_EXPERIENCE] : null;
  const subConfig = gc.subQualificationStatus ? SUB_QUALIFICATION_STATUS[gc.subQualificationStatus as keyof typeof SUB_QUALIFICATION_STATUS] : null;
  const relConfig = gc.relationshipStatus ? GC_RELATIONSHIP_STATUS[gc.relationshipStatus as keyof typeof GC_RELATIONSHIP_STATUS] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/market-intel/gcs" className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{gc.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {prioConfig && (
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", prioConfig.badge)}>
                  {prioConfig.label}
                </span>
              )}
              {subConfig && (
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", subConfig.badge)}>
                  {subConfig.label}
                </span>
              )}
              {gc.coloradoOffice && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">CO Office</span>
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
              if (confirm("Delete this general contractor?")) {
                deleteGC.mutate(id, { onSuccess: () => router.push("/market-intel/gcs") });
              }
            }}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>

      {editing ? (
        <GCForm initialData={gc} onSuccess={() => setEditing(false)} />
      ) : (
        <>
          {/* Info Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold">Details</h3>
              <div className="space-y-2">
                {gc.hqLocation && <InfoRow label="HQ" value={gc.hqLocation} />}
                {gc.website && (
                  <InfoRow label="Website" value={
                    <a href={gc.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      {new URL(gc.website).hostname} <Globe className="h-3 w-3" />
                    </a>
                  } />
                )}
                <InfoRow label="DC Experience" value={expConfig?.label ?? "—"} />
                <InfoRow label="Relationship" value={relConfig?.label ?? "—"} />
                {gc.estimatedAnnualOpportunity && (
                  <InfoRow label="Est. Annual Opp" value={`$${(gc.estimatedAnnualOpportunity / 1_000_000).toFixed(1)}M`} />
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold">Qualification</h3>
              <div className="space-y-2">
                <InfoRow label="Approved Sub List" value={gc.approvedSubList ? "Yes" : "No"} />
                <InfoRow label="Status" value={subConfig?.label ?? "—"} />
                {gc.prequalificationRequirements && (
                  <InfoRow label="Preq. Requirements" value={gc.prequalificationRequirements} />
                )}
                {gc.coloradoOfficeAddress && (
                  <InfoRow label="CO Office" value={gc.coloradoOfficeAddress} />
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold">Contact</h3>
              <div className="space-y-2">
                {gc.primaryContactName && <InfoRow label="Name" value={gc.primaryContactName} />}
                {gc.primaryContactTitle && <InfoRow label="Title" value={gc.primaryContactTitle} />}
                {gc.primaryContactEmail && (
                  <InfoRow label="Email" value={
                    <a href={`mailto:${gc.primaryContactEmail}`} className="text-primary hover:underline">{gc.primaryContactEmail}</a>
                  } />
                )}
                {gc.primaryContactPhone && <InfoRow label="Phone" value={gc.primaryContactPhone} />}
              </div>
            </div>
          </div>

          {/* Notable Projects */}
          {gc.notableDCProjects?.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 font-semibold">Notable DC Projects</h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {gc.notableDCProjects.map((p: string, i: number) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {gc.notes && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 font-semibold">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{gc.notes}</p>
            </div>
          )}

          {/* Assigned Facilities */}
          {gc.facilities?.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold">Assigned Facilities ({gc.facilities.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Facility</th>
                      <th className="px-4 py-2 text-left font-medium">Operator</th>
                      <th className="px-4 py-2 text-right font-medium">Capacity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gc.facilities.map((f: Record<string, unknown>) => (
                      <tr key={f.id as string} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">{f.facilityName as string}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {f.operator ? (
                            <Link href={`/market-intel/operators/${(f.operator as Record<string, unknown>).id}`} className="hover:text-primary hover:underline">
                              {(f.operator as Record<string, unknown>).name as string}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {f.capacityMW ? `${f.capacityMW} MW` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cabling Opportunities */}
          {gc.cablingOpportunities?.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold">Cabling Opportunities ({gc.cablingOpportunities.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Operator</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium">Est. Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gc.cablingOpportunities.map((opp: Record<string, unknown>) => (
                      <tr key={opp.id as string} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2">
                          <Link href={`/market-intel/opportunities/${opp.id}`} className="font-medium hover:text-primary hover:underline">
                            {opp.name as string}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {(opp.operator as Record<string, unknown>)?.name as string ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{(opp.status as string)?.replace(/_/g, " ") ?? "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {opp.estimatedValue ? `$${((opp.estimatedValue as number) / 1000).toFixed(0)}K` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
