"use client";

import { useState } from "react";
import {
  BarChart3,
  PenLine,
  Save,
  X,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import { useUpdateOpportunity } from "@/hooks/use-pipeline";
import { useRiskAssessment } from "@/hooks/use-ai";
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

interface RiskFlag {
  severity: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  description: string;
}

interface RiskAssessmentData {
  overallRisk: "HIGH" | "MEDIUM" | "LOW";
  thesisFitScore: number;
  riskFlags: RiskFlag[];
  strengths: string[];
  concerns: string[];
  recommendation: string;
  keyQuestions: string[];
}

const RISK_COLORS: Record<string, string> = {
  HIGH: "text-red-700 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  MEDIUM: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  LOW: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
};

const RISK_ICON: Record<string, typeof ShieldAlert> = {
  HIGH: ShieldAlert,
  MEDIUM: AlertTriangle,
  LOW: ShieldCheck,
};

export function DealAnalysisPanel({ opportunity }: DealAnalysisPanelProps) {
  const updateOpportunity = useUpdateOpportunity();
  const riskAssessmentMutation = useRiskAssessment(opportunity.id);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [riskData, setRiskData] = useState<RiskAssessmentData | null>(null);

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

  const handleGenerateRisk = () => {
    riskAssessmentMutation.mutate(undefined, {
      onSuccess: (data) => {
        setRiskData(data.result as unknown as RiskAssessmentData);
      },
    });
  };

  return (
    <>
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
      ) : hasData || opportunity.offerPrice ? (
        <div className="p-4 space-y-3">
          {/* Buyer-Perspective Multiples (when offerPrice exists) */}
          {opportunity.offerPrice && opportunity.listing && (() => {
            const offer = Number(opportunity.offerPrice);
            const askPrice = opportunity.listing.askingPrice ? Number(opportunity.listing.askingPrice) : null;
            const ebitdaVal = opportunity.listing.ebitda ? Number(opportunity.listing.ebitda) :
              (opportunity.listing.inferredEbitda ? Number(opportunity.listing.inferredEbitda) : null);
            const sdeVal = opportunity.listing.sde ? Number(opportunity.listing.sde) :
              (opportunity.listing.inferredSde ? Number(opportunity.listing.inferredSde) : null);
            const revenueVal = opportunity.listing.revenue ? Number(opportunity.listing.revenue) : null;

            const offerEbitda = ebitdaVal && ebitdaVal > 0 ? offer / ebitdaVal : null;
            const offerSde = sdeVal && sdeVal > 0 ? offer / sdeVal : null;
            const offerRev = revenueVal && revenueVal > 0 ? offer / revenueVal : null;
            const discountPct = askPrice && askPrice > 0 ? ((askPrice - offer) / askPrice) * 100 : null;

            if (!offerEbitda && !offerSde && !offerRev) return null;

            return (
              <div className="rounded-md border bg-primary/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-medium text-primary uppercase tracking-wide">
                    Buyer-Perspective Multiples (Offer: {formatCurrency(offer)})
                  </div>
                  {discountPct !== null && (
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded",
                      discountPct > 0
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                      {discountPct > 0 ? "" : "+"}{discountPct.toFixed(0)}% from asking
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {offerEbitda && (
                    <div className="rounded border bg-background p-2">
                      <div className="text-[10px] text-muted-foreground">Offer/EBITDA</div>
                      <div className="text-sm font-bold text-primary">{offerEbitda.toFixed(1)}x</div>
                    </div>
                  )}
                  {offerSde && (
                    <div className="rounded border bg-background p-2">
                      <div className="text-[10px] text-muted-foreground">Offer/SDE</div>
                      <div className="text-sm font-bold text-primary">{offerSde.toFixed(1)}x</div>
                    </div>
                  )}
                  {offerRev && (
                    <div className="rounded border bg-background p-2">
                      <div className="text-[10px] text-muted-foreground">Offer/Revenue</div>
                      <div className="text-sm font-bold text-primary">{offerRev.toFixed(1)}x</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

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

    {/* ── AI Risk Assessment Card ── */}
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">AI Risk Assessment</h2>
        </div>
        {riskData && (
          <button
            onClick={handleGenerateRisk}
            disabled={riskAssessmentMutation.isPending}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Refresh assessment"
          >
            <RefreshCw className={cn("h-3 w-3", riskAssessmentMutation.isPending && "animate-spin")} />
          </button>
        )}
      </div>

      {/* No assessment yet */}
      {!riskData && !riskAssessmentMutation.isPending && !riskAssessmentMutation.isError && (
        <div className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Generate an AI-powered risk assessment for this deal
          </p>
          <button
            onClick={handleGenerateRisk}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            <Sparkles className="h-3 w-3" />
            Generate Assessment
          </button>
        </div>
      )}

      {/* Loading */}
      {riskAssessmentMutation.isPending && (
        <div className="flex items-center justify-center gap-2 p-6">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Analyzing deal risk...</span>
        </div>
      )}

      {/* Error */}
      {riskAssessmentMutation.isError && !riskData && (
        <div className="p-4 text-center">
          <p className="text-xs text-destructive mb-2">
            {riskAssessmentMutation.error.message}
          </p>
          <button
            onClick={handleGenerateRisk}
            className="text-xs text-primary hover:underline"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Assessment Results */}
      {riskData && (
        <div className="p-4 space-y-3">
          {/* Overall risk + thesis fit */}
          <div className="flex items-center gap-2">
            {(() => {
              const RiskIcon = RISK_ICON[riskData.overallRisk] || AlertTriangle;
              return (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                  RISK_COLORS[riskData.overallRisk],
                )}>
                  <RiskIcon className="h-3 w-3" />
                  {riskData.overallRisk} Risk
                </span>
              );
            })()}
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Thesis Fit: {riskData.thesisFitScore}/10
            </span>
          </div>

          {/* Recommendation */}
          {riskData.recommendation && (
            <div className="rounded-md border bg-muted/20 p-2">
              <p className="text-xs">{riskData.recommendation}</p>
            </div>
          )}

          {/* Risk Flags */}
          {riskData.riskFlags.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Risk Flags
              </div>
              <div className="space-y-1">
                {riskData.riskFlags.map((flag, i) => (
                  <div key={i} className={cn(
                    "flex items-start gap-2 rounded-md border p-2 text-xs",
                    RISK_COLORS[flag.severity],
                  )}>
                    <span className="font-semibold shrink-0 uppercase text-[10px]">{flag.severity}</span>
                    <div>
                      <span className="font-medium">{flag.category}:</span>{" "}
                      {flag.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {riskData.strengths.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Strengths
              </div>
              {riskData.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs mb-0.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}

          {/* Concerns */}
          {riskData.concerns.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Concerns
              </div>
              {riskData.concerns.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs mb-0.5">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          )}

          {/* Key Diligence Questions */}
          {riskData.keyQuestions.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Key Diligence Questions
              </div>
              {riskData.keyQuestions.map((q, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs mb-0.5">
                  <HelpCircle className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                  <span>{q}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
