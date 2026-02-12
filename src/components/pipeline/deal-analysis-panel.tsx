"use client";

import { useState } from "react";
import { BarChart3, PenLine, Save, X, AlertTriangle, TrendingUp } from "lucide-react";
import { useUpdateOpportunity } from "@/hooks/use-pipeline";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DealAnalysisPanelProps {
  opportunity: Record<string, any>;
}

const INTEGRATION_COMPLEXITY_LABELS: Record<string, { label: string; color: string }> = {
  LOW: { label: "Low", color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300" },
  MEDIUM: { label: "Medium", color: "text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300" },
  HIGH: { label: "High", color: "text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300" },
};

const KEY_PERSON_RISK_LABELS: Record<string, { label: string; color: string }> = {
  LOW: { label: "Low", color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300" },
  MEDIUM: { label: "Medium", color: "text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300" },
  HIGH: { label: "High", color: "text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300" },
};

const REVENUE_TREND_LABELS: Record<string, { label: string; color: string }> = {
  GROWING: { label: "Growing", color: "text-emerald-700" },
  STABLE: { label: "Stable", color: "text-blue-700" },
  DECLINING: { label: "Declining", color: "text-red-700" },
};

export function DealAnalysisPanel({ opportunity }: DealAnalysisPanelProps) {
  const updateOpportunity = useUpdateOpportunity();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});

  // Check if there is any thesis data to display
  const hasData = opportunity.actualRevenue || opportunity.actualEbitda ||
    opportunity.recurringRevenuePct !== null || opportunity.customerConcentration !== null ||
    opportunity.integrationComplexity || opportunity.keyPersonRisk ||
    opportunity.dealStructure || opportunity.offeredMultiple ||
    opportunity.synergyEstimate || opportunity.backlog ||
    opportunity.certificationTransferRisk || opportunity.customerRetentionRisk ||
    opportunity.revenueTrend;

  const startEditing = () => {
    setEditData({
      actualRevenue: opportunity.actualRevenue ? Number(opportunity.actualRevenue) : "",
      actualEbitda: opportunity.actualEbitda ? Number(opportunity.actualEbitda) : "",
      actualEbitdaMargin: opportunity.actualEbitdaMargin ?? "",
      revenueTrend: opportunity.revenueTrend || "",
      recurringRevenuePct: opportunity.recurringRevenuePct ?? "",
      customerConcentration: opportunity.customerConcentration ?? "",
      backlog: opportunity.backlog ? Number(opportunity.backlog) : "",
      offeredMultiple: opportunity.offeredMultiple ?? "",
      dealStructure: opportunity.dealStructure || "",
      synergyEstimate: opportunity.synergyEstimate ? Number(opportunity.synergyEstimate) : "",
      integrationComplexity: opportunity.integrationComplexity || "",
      keyPersonRisk: opportunity.keyPersonRisk || "",
      certificationTransferRisk: opportunity.certificationTransferRisk || "",
      customerRetentionRisk: opportunity.customerRetentionRisk || "",
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    const data: Record<string, unknown> = {};
    // Decimal/numeric fields
    for (const f of ["actualRevenue", "actualEbitda", "synergyEstimate", "backlog"]) {
      const v = editData[f];
      data[f] = v === "" || v === null || v === undefined ? null : Number(v);
    }
    // Float fields
    for (const f of ["actualEbitdaMargin", "recurringRevenuePct", "customerConcentration", "offeredMultiple"]) {
      const v = editData[f];
      data[f] = v === "" || v === null || v === undefined ? null : parseFloat(String(v));
    }
    // String fields
    for (const f of ["dealStructure", "certificationTransferRisk", "customerRetentionRisk"]) {
      const v = editData[f];
      data[f] = v && String(v).trim() ? String(v).trim() : null;
    }
    // Enum fields
    for (const f of ["revenueTrend", "integrationComplexity", "keyPersonRisk"]) {
      const v = editData[f];
      data[f] = v && String(v).trim() ? String(v).trim() : null;
    }

    updateOpportunity.mutate(
      { id: opportunity.id, data },
      { onSuccess: () => setIsEditing(false) }
    );
  };

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Deal Analysis</h2>
        </div>
        {!isEditing && (
          <button
            onClick={startEditing}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <PenLine className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="p-4 space-y-4">
          {/* Financials */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Actual Financials</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Revenue</label>
                <input type="number" value={editData.actualRevenue === null || editData.actualRevenue === undefined || editData.actualRevenue === "" ? "" : String(editData.actualRevenue)} onChange={(e) => setEditData((p) => ({ ...p, actualRevenue: e.target.value ? Number(e.target.value) : "" }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="$0" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">EBITDA</label>
                <input type="number" value={editData.actualEbitda === null || editData.actualEbitda === undefined || editData.actualEbitda === "" ? "" : String(editData.actualEbitda)} onChange={(e) => setEditData((p) => ({ ...p, actualEbitda: e.target.value ? Number(e.target.value) : "" }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="$0" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">EBITDA Margin (%)</label>
                <input type="number" step="0.01" value={editData.actualEbitdaMargin === null || editData.actualEbitdaMargin === undefined || editData.actualEbitdaMargin === "" ? "" : String(editData.actualEbitdaMargin)} onChange={(e) => setEditData((p) => ({ ...p, actualEbitdaMargin: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="0.15" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Revenue Trend</label>
                <select value={String(editData.revenueTrend || "")} onChange={(e) => setEditData((p) => ({ ...p, revenueTrend: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs">
                  <option value="">Select...</option>
                  <option value="GROWING">Growing</option>
                  <option value="STABLE">Stable</option>
                  <option value="DECLINING">Declining</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Recurring Rev %</label>
                <input type="number" step="0.01" value={editData.recurringRevenuePct === null || editData.recurringRevenuePct === undefined || editData.recurringRevenuePct === "" ? "" : String(editData.recurringRevenuePct)} onChange={(e) => setEditData((p) => ({ ...p, recurringRevenuePct: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="0.30" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Customer Concentration</label>
                <input type="number" step="0.01" value={editData.customerConcentration === null || editData.customerConcentration === undefined || editData.customerConcentration === "" ? "" : String(editData.customerConcentration)} onChange={(e) => setEditData((p) => ({ ...p, customerConcentration: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="0.25" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Backlog ($)</label>
                <input type="number" value={editData.backlog === null || editData.backlog === undefined || editData.backlog === "" ? "" : String(editData.backlog)} onChange={(e) => setEditData((p) => ({ ...p, backlog: e.target.value ? Number(e.target.value) : "" }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="$0" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Offered Multiple</label>
                <input type="number" step="0.1" value={editData.offeredMultiple === null || editData.offeredMultiple === undefined || editData.offeredMultiple === "" ? "" : String(editData.offeredMultiple)} onChange={(e) => setEditData((p) => ({ ...p, offeredMultiple: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="4.0" />
              </div>
            </div>
          </div>

          {/* Deal Structure */}
          <div>
            <label className="text-[10px] text-muted-foreground">Deal Structure</label>
            <textarea value={String(editData.dealStructure || "")} onChange={(e) => setEditData((p) => ({ ...p, dealStructure: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" rows={2} placeholder="SBA 7(a), seller note, earnout..." />
          </div>

          {/* Synergy */}
          <div>
            <label className="text-[10px] text-muted-foreground">Synergy Estimate ($)</label>
            <input type="number" value={editData.synergyEstimate === null || editData.synergyEstimate === undefined || editData.synergyEstimate === "" ? "" : String(editData.synergyEstimate)} onChange={(e) => setEditData((p) => ({ ...p, synergyEstimate: e.target.value ? Number(e.target.value) : "" }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="$0" />
          </div>

          {/* Risks */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Risk Assessment</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Integration Complexity</label>
                <select value={String(editData.integrationComplexity || "")} onChange={(e) => setEditData((p) => ({ ...p, integrationComplexity: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs">
                  <option value="">Select...</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Key Person Risk</label>
                <select value={String(editData.keyPersonRisk || "")} onChange={(e) => setEditData((p) => ({ ...p, keyPersonRisk: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs">
                  <option value="">Select...</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            </div>
            <div className="mt-2">
              <label className="text-[10px] text-muted-foreground">Cert Transfer Risk</label>
              <textarea value={String(editData.certificationTransferRisk || "")} onChange={(e) => setEditData((p) => ({ ...p, certificationTransferRisk: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" rows={1} placeholder="e.g., MBE cert not transferable" />
            </div>
            <div className="mt-2">
              <label className="text-[10px] text-muted-foreground">Customer Retention Risk</label>
              <textarea value={String(editData.customerRetentionRisk || "")} onChange={(e) => setEditData((p) => ({ ...p, customerRetentionRisk: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" rows={1} placeholder="e.g., 2 large clients, personal relationship" />
            </div>
          </div>

          <div className="flex gap-2 border-t pt-3">
            <button onClick={() => setIsEditing(false)} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
              <X className="h-3 w-3" /> Cancel
            </button>
            <button onClick={saveEdit} disabled={updateOpportunity.isPending} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90 disabled:opacity-50">
              <Save className="h-3 w-3" /> {updateOpportunity.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : hasData ? (
        <div className="p-4 space-y-3">
          {/* Actual financials grid */}
          {(opportunity.actualRevenue || opportunity.actualEbitda) && (
            <div className="grid grid-cols-2 gap-2">
              {opportunity.actualRevenue && (
                <div className="rounded-md border bg-muted/20 p-2">
                  <div className="text-[10px] text-muted-foreground">Actual Revenue</div>
                  <div className="text-sm font-semibold">{formatCurrency(Number(opportunity.actualRevenue))}</div>
                  {opportunity.revenueTrend && (
                    <span className={cn("text-[10px] font-medium", REVENUE_TREND_LABELS[opportunity.revenueTrend]?.color)}>
                      {REVENUE_TREND_LABELS[opportunity.revenueTrend]?.label}
                    </span>
                  )}
                </div>
              )}
              {opportunity.actualEbitda && (
                <div className="rounded-md border bg-muted/20 p-2">
                  <div className="text-[10px] text-muted-foreground">Actual EBITDA</div>
                  <div className="text-sm font-semibold">{formatCurrency(Number(opportunity.actualEbitda))}</div>
                  {opportunity.actualEbitdaMargin !== null && opportunity.actualEbitdaMargin !== undefined && (
                    <span className="text-[10px] text-muted-foreground">
                      {(Number(opportunity.actualEbitdaMargin) * 100).toFixed(0)}% margin
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Key metrics row */}
          <div className="flex flex-wrap gap-2">
            {opportunity.recurringRevenuePct !== null && opportunity.recurringRevenuePct !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                <TrendingUp className="h-2.5 w-2.5" />
                {(Number(opportunity.recurringRevenuePct) * 100).toFixed(0)}% recurring
              </span>
            )}
            {opportunity.customerConcentration !== null && opportunity.customerConcentration !== undefined && (
              <span className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-xs",
                Number(opportunity.customerConcentration) > 0.3
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
              )}>
                Top customer: {(Number(opportunity.customerConcentration) * 100).toFixed(0)}%
              </span>
            )}
            {opportunity.backlog && (
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Backlog: {formatCurrency(Number(opportunity.backlog))}
              </span>
            )}
            {opportunity.offeredMultiple !== null && opportunity.offeredMultiple !== undefined && (
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {Number(opportunity.offeredMultiple).toFixed(1)}x offered
              </span>
            )}
            {opportunity.synergyEstimate && (
              <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                Synergy: {formatCurrency(Number(opportunity.synergyEstimate))}
              </span>
            )}
          </div>

          {/* Deal structure */}
          {opportunity.dealStructure && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase">Deal Structure</div>
              <p className="mt-0.5 text-xs text-foreground">{String(opportunity.dealStructure)}</p>
            </div>
          )}

          {/* Risk badges */}
          {(opportunity.integrationComplexity || opportunity.keyPersonRisk) && (
            <div className="flex flex-wrap gap-2">
              {opportunity.integrationComplexity && (() => {
                const config = INTEGRATION_COMPLEXITY_LABELS[opportunity.integrationComplexity];
                return config ? (
                  <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", config.color)}>
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Integration: {config.label}
                  </span>
                ) : null;
              })()}
              {opportunity.keyPersonRisk && (() => {
                const config = KEY_PERSON_RISK_LABELS[opportunity.keyPersonRisk];
                return config ? (
                  <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", config.color)}>
                    Key Person: {config.label}
                  </span>
                ) : null;
              })()}
            </div>
          )}

          {/* Risk notes */}
          {(opportunity.certificationTransferRisk || opportunity.customerRetentionRisk) && (
            <div className="space-y-1.5">
              {opportunity.certificationTransferRisk && (
                <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-2">
                  <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300">Cert Transfer Risk</div>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{String(opportunity.certificationTransferRisk)}</p>
                </div>
              )}
              {opportunity.customerRetentionRisk && (
                <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-2">
                  <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300">Customer Retention Risk</div>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{String(opportunity.customerRetentionRisk)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 text-center">
          <p className="text-xs text-muted-foreground">No deal analysis data yet</p>
          <button
            onClick={startEditing}
            className="mt-1 text-xs text-primary hover:underline"
          >
            Add deal analysis
          </button>
        </div>
      )}
    </div>
  );
}
