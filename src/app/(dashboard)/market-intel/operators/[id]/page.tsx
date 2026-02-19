"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, MapPin, Globe, Phone, Mail, Pencil } from "lucide-react";
import { useOperator, useUpdateOperator, useDeleteOperator } from "@/hooks/use-market-intel";
import {
  OPERATOR_TIERS,
  OPERATOR_RELATIONSHIP_STATUS,
  FACILITY_STATUS,
  type OperatorTierKey,
  type FacilityStatusKey,
} from "@/lib/market-intel-constants";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OperatorForm } from "@/components/market-intel/operator-form";
import { MiniMap } from "@/components/maps/mini-map";

export default function OperatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const { data: operator, isLoading } = useOperator(isNew ? null : id);
  const [editing, setEditing] = useState(isNew);
  const router = useRouter();
  const updateOperator = useUpdateOperator();
  const deleteOperator = useDeleteOperator();

  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/market-intel/operators" className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">New DC Operator</h1>
        </div>
        <OperatorForm onSuccess={() => router.push("/market-intel/operators")} />
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

  if (!operator) {
    return <div className="py-12 text-center text-muted-foreground">Operator not found</div>;
  }

  const tierConfig = operator.tier ? OPERATOR_TIERS[operator.tier as OperatorTierKey] : null;
  const relStatus = operator.relationshipStatus
    ? OPERATOR_RELATIONSHIP_STATUS[operator.relationshipStatus as keyof typeof OPERATOR_RELATIONSHIP_STATUS]
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/market-intel/operators" className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{operator.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {tierConfig && (
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", tierConfig.badge)}>
                  {tierConfig.label}
                </span>
              )}
              {relStatus && (
                <span className="text-sm text-muted-foreground">{relStatus.label}</span>
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
              if (confirm("Delete this operator and all its facilities?")) {
                deleteOperator.mutate(id, { onSuccess: () => router.push("/market-intel/operators") });
              }
            }}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>

      {editing ? (
        <OperatorForm
          initialData={operator}
          onSuccess={() => setEditing(false)}
        />
      ) : (
        <>
          {/* Info Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <InfoCard title="Details">
              {operator.parentCompany && <InfoRow label="Parent" value={operator.parentCompany} />}
              {operator.hqLocation && <InfoRow label="HQ" value={operator.hqLocation} icon={<MapPin className="h-3.5 w-3.5" />} />}
              {operator.website && (
                <InfoRow label="Website" value={
                  <a href={operator.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    {new URL(operator.website).hostname} <Globe className="h-3 w-3" />
                  </a>
                } />
              )}
              <InfoRow label="Cabling Score" value={operator.cablingOpportunityScore ? `${operator.cablingOpportunityScore}/10` : "—"} />
              {operator.estimatedAnnualCablingRevenue && (
                <InfoRow label="Est. Annual Cabling" value={`$${(operator.estimatedAnnualCablingRevenue / 1_000_000).toFixed(1)}M`} />
              )}
            </InfoCard>

            <InfoCard title="Construction Activity">
              <InfoRow label="Active Construction" value={operator.activeConstruction ? "Yes" : "No"} />
              {operator.constructionTimeline && <InfoRow label="Timeline" value={operator.constructionTimeline} />}
              {operator.phaseCount && <InfoRow label="Phases" value={String(operator.phaseCount)} />}
            </InfoCard>

            <InfoCard title="Contact">
              {operator.primaryContactName && <InfoRow label="Name" value={operator.primaryContactName} />}
              {operator.primaryContactTitle && <InfoRow label="Title" value={operator.primaryContactTitle} />}
              {operator.primaryContactEmail && (
                <InfoRow label="Email" value={
                  <a href={`mailto:${operator.primaryContactEmail}`} className="text-primary hover:underline inline-flex items-center gap-1">
                    {operator.primaryContactEmail} <Mail className="h-3 w-3" />
                  </a>
                } />
              )}
              {operator.primaryContactPhone && (
                <InfoRow label="Phone" value={operator.primaryContactPhone} icon={<Phone className="h-3.5 w-3.5" />} />
              )}
            </InfoCard>
          </div>

          {/* Notes */}
          {operator.notes && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 font-semibold">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{operator.notes}</p>
            </div>
          )}

          {/* Facility Map */}
          {operator.facilities?.some((f: Record<string, unknown>) => f.latitude && f.longitude) && (
            <MiniMap
              markers={operator.facilities
                .filter((f: Record<string, unknown>) => f.latitude && f.longitude)
                .map((f: Record<string, unknown>) => ({
                  id: f.id as string,
                  lat: f.latitude as number,
                  lng: f.longitude as number,
                  label: f.facilityName as string,
                  tier: operator.tier as string,
                  capacityMW: f.capacityMW as number | null,
                  type: "facility" as const,
                }))}
              height="250px"
            />
          )}

          {/* Facilities */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold">Facilities ({operator.facilities?.length ?? 0})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-4 py-2 text-left font-medium">Location</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Capacity</th>
                    <th className="px-4 py-2 text-left font-medium">GC</th>
                  </tr>
                </thead>
                <tbody>
                  {(!operator.facilities || operator.facilities.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No facilities recorded</td>
                    </tr>
                  ) : (
                    operator.facilities.map((f: Record<string, unknown>) => {
                      const statusConfig = f.status ? FACILITY_STATUS[f.status as FacilityStatusKey] : null;
                      return (
                        <tr key={f.id as string} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium">{f.facilityName as string}</td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {[f.city, f.state].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-4 py-2">
                            {statusConfig && (
                              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusConfig.badge)}>
                                {statusConfig.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {f.capacityMW ? `${f.capacityMW} MW` : "—"}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {(f.generalContractor as Record<string, unknown>)?.name as string ?? "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cabling Opportunities */}
          {operator.cablingOpportunities?.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold">Cabling Opportunities ({operator.cablingOpportunities.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium">Est. Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operator.cablingOpportunities.map((opp: Record<string, unknown>) => (
                      <tr key={opp.id as string} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2">
                          <Link href={`/market-intel/opportunities/${opp.id}`} className="font-medium hover:text-primary hover:underline">
                            {opp.name as string}
                          </Link>
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

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
        {icon}{label}
      </span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
