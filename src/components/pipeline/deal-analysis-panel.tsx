"use client";

import { useState } from "react";
import {
  BarChart3,
  PenLine,
  Save,
  X,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Users,
  Calendar,
  Sparkles,
} from "lucide-react";
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

  // When FinancialPeriod records exist, the financials tab is the source of truth —
  // Revenue, EBITDA, and EBITDA Margin are synced automatically and locked here.
  const hasFinancialPeriods = !!opportunity.latestFinancials;

  // Check if there is any thesis data or listing data to display
  const listing = opportunity.listing;
  const hasListingFinancials = listing && (
    listing.askingPrice || listing.revenue || listing.ebitda || listing.inferredEbitda ||
    listing.sde || listing.cashFlow || listing.employees || listing.established ||
    listing.city || listing.state
  );
  const hasData = hasListingFinancials || opportunity.actualRevenue || opportunity.actualEbitda ||
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
    // Fields locked when financial periods exist (synced from Financials tab)
    const lockedFields = hasFinancialPeriods
      ? new Set(["actualRevenue", "actualEbitda", "actualEbitdaMargin"])
      : new Set<string>();

    for (const f of ["actualRevenue", "actualEbitda", "synergyEstimate", "backlog"]) {
      if (lockedFields.has(f)) continue;
      const v = editData[f];
      data[f] = v === "" || v === null || v === undefined ? null : Number(v);
    }
    for (const f of ["actualEbitdaMargin", "recurringRevenuePct", "customerConcentration", "offeredMultiple"]) {
      if (lockedFields.has(f)) continue;
      const v = editData[f];
      data[f] = v === "" || v === null || v === undefined ? null : parseFloat(String(v));
    }
    for (const f of ["dealStructure", "certificationTransferRisk", "customerRetentionRisk"]) {
      const v = editData[f];
      data[f] = v && String(v).trim() ? String(v).trim() : null;
    }
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
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Actual Financials</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <label className="text-[10px] text-muted-foreground">Revenue</label>
                {hasFinancialPeriods ? (
                  <div className="mt-0.5 w-full rounded border bg-muted/50 px-2 py-1 text-xs text-muted-foreground cursor-not-allowed">
                    {editData.actualRevenue ? formatCurrency(Number(editData.actualRevenue)) : "—"}
                    <div className="text-[9px] text-muted-foreground/70 mt-0.5">Synced from Financials</div>
                  </div>
                ) : (
                  <input type="number" value={editData.actualRevenue === null || editData.actualRevenue === undefined || editData.actualRevenue === "" ? "" : String(editData.actualRevenue)} onChange={(e) => setEditData((p) => ({ ...p, actualRevenue: e.target.value ? Number(e.target.value) : "" }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="$0" />
                )}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">EBITDA</label>
                {hasFinancialPeriods ? (
                  <div className="mt-0.5 w-full rounded border bg-muted/50 px-2 py-1 text-xs text-muted-foreground cursor-not-allowed">
                    {editData.actualEbitda ? formatCurrency(Number(editData.actualEbitda)) : "—"}
                    <div className="text-[9px] text-muted-foreground/70 mt-0.5">Synced from Financials</div>
                  </div>
                ) : (
                  <input type="number" value={editData.actualEbitda === null || editData.actualEbitda === undefined || editData.actualEbitda === "" ? "" : String(editData.actualEbitda)} onChange={(e) => setEditData((p) => ({ ...p, actualEbitda: e.target.value ? Number(e.target.value) : "" }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="$0" />
                )}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">EBITDA Margin (%)</label>
                {hasFinancialPeriods ? (
                  <div className="mt-0.5 w-full rounded border bg-muted/50 px-2 py-1 text-xs text-muted-foreground cursor-not-allowed">
                    {editData.actualEbitdaMargin ? `${(Number(editData.actualEbitdaMargin) * 100).toFixed(1)}%` : "—"}
                    <div className="text-[9px] text-muted-foreground/70 mt-0.5">Synced from Financials</div>
                  </div>
                ) : (
                  <input type="number" step="0.01" value={editData.actualEbitdaMargin === null || editData.actualEbitdaMargin === undefined || editData.actualEbitdaMargin === "" ? "" : String(editData.actualEbitdaMargin)} onChange={(e) => setEditData((p) => ({ ...p, actualEbitdaMargin: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="0.15" />
                )}
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

          <div>
            <label className="text-[10px] text-muted-foreground">Deal Structure</label>
            <textarea value={String(editData.dealStructure || "")} onChange={(e) => setEditData((p) => ({ ...p, dealStructure: e.target.value }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" rows={2} placeholder="SBA 7(a), seller note, earnout..." />
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground">Synergy Estimate ($)</label>
            <input type="number" value={editData.synergyEstimate === null || editData.synergyEstimate === undefined || editData.synergyEstimate === "" ? "" : String(editData.synergyEstimate)} onChange={(e) => setEditData((p) => ({ ...p, synergyEstimate: e.target.value ? Number(e.target.value) : "" }))} className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs" placeholder="$0" />
          </div>

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
          {/* Buyer-Perspective Multiples */}
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

          {/* Listing Snapshot — key metrics from the linked listing */}
          {hasListingFinancials && (() => {
            const loc = [listing.city, listing.state].filter(Boolean).join(", ");
            const ebitdaVal = listing.ebitda ? Number(listing.ebitda) : (listing.inferredEbitda ? Number(listing.inferredEbitda) : null);
            const isEstimated = !listing.ebitda && !!listing.inferredEbitda;

            const metrics: Array<{ label: string; value: string; icon?: React.ReactNode }> = [];

            if (listing.askingPrice) metrics.push({ label: "Asking Price", value: formatCurrency(Number(listing.askingPrice)) });
            if (listing.revenue) metrics.push({ label: "Revenue", value: formatCurrency(Number(listing.revenue)) });
            if (ebitdaVal) metrics.push({ label: isEstimated ? "EBITDA (est.)" : "EBITDA", value: formatCurrency(ebitdaVal) });
            if (listing.sde) metrics.push({ label: "SDE", value: formatCurrency(Number(listing.sde)) });
            if (listing.cashFlow) metrics.push({ label: "Cash Flow", value: formatCurrency(Number(listing.cashFlow)) });
            if (listing.employees) metrics.push({ label: "Employees", value: String(listing.employees), icon: <Users className="h-2.5 w-2.5" /> });
            if (listing.established) metrics.push({ label: "Est.", value: String(listing.established), icon: <Calendar className="h-2.5 w-2.5" /> });
            if (loc) metrics.push({ label: "Location", value: loc, icon: <MapPin className="h-2.5 w-2.5" /> });

            if (metrics.length === 0) return null;

            return (
              <div className="rounded-md border bg-muted/10 p-3">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Listing Snapshot
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {metrics.map((m) => (
                    <div key={m.label} className="inline-flex items-center gap-1">
                      {m.icon}
                      <span className="text-[10px] text-muted-foreground">{m.label}:</span>
                      <span className="text-xs font-medium">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Financial Period data — overrides flat fields when available */}
          {opportunity.latestFinancials && (() => {
            const ds = opportunity.latestFinancials.dataSource;
            const badgeStyle =
              ds === "AI_EXTRACTION"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : ds === "MANUAL"
                  ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  : "bg-primary/10 text-primary";
            const badgeLabel =
              ds === "AI_EXTRACTION" ? "AI Extracted" : ds === "MANUAL" ? "Manual" : "Period";

            return (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {opportunity.latestFinancials.totalRevenue && (
                  <div className="rounded-md border bg-emerald-50/50 dark:bg-emerald-900/10 p-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Revenue</span>
                      <span className={cn("rounded px-1 py-0.5 text-[8px] font-medium", badgeStyle)}>{badgeLabel}</span>
                    </div>
                    <div className="text-sm font-semibold">{formatCurrency(Number(opportunity.latestFinancials.totalRevenue))}</div>
                  </div>
                )}
                {opportunity.latestFinancials.adjustedEbitda && (
                  <div className="rounded-md border bg-emerald-50/50 dark:bg-emerald-900/10 p-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Adj. EBITDA</span>
                      <span className={cn("rounded px-1 py-0.5 text-[8px] font-medium", badgeStyle)}>{badgeLabel}</span>
                    </div>
                    <div className="text-sm font-semibold">{formatCurrency(Number(opportunity.latestFinancials.adjustedEbitda))}</div>
                  </div>
                )}
                {opportunity.latestFinancials.sde && (
                  <div className="rounded-md border bg-emerald-50/50 dark:bg-emerald-900/10 p-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">SDE</span>
                      <span className={cn("rounded px-1 py-0.5 text-[8px] font-medium", badgeStyle)}>{badgeLabel}</span>
                    </div>
                    <div className="text-sm font-semibold">{formatCurrency(Number(opportunity.latestFinancials.sde))}</div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* AI Financial Analysis summary — from Financials tab AI Analyze */}
          {opportunity.latestFinancialAnalysis?.resultData && (() => {
            const analysis = opportunity.latestFinancialAnalysis.resultData as any;
            if (!analysis?.summary) return null;
            return (
              <div className="rounded-md border bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-medium text-primary uppercase tracking-wide">
                    AI Financial Analysis
                  </span>
                  {analysis.qualityScore && (
                    <span className={cn(
                      "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      analysis.qualityScore >= 8
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : analysis.qualityScore >= 5
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    )}>
                      {analysis.qualityScore}/10
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed">{analysis.summary}</p>
                {analysis.redFlags?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {analysis.redFlags.slice(0, 3).map((flag: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {flag.length > 60 ? flag.slice(0, 57) + "…" : flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Actual financials grid — shown when no financial periods exist */}
          {!opportunity.latestFinancials && (opportunity.actualRevenue || opportunity.actualEbitda) && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
