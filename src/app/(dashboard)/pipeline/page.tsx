"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  GripVertical,
  ExternalLink,
  Clock,
  MessageSquare,
  LayoutGrid,
  List,
  Mail,
  Flag,
  User,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { usePipeline, useUpdateOpportunity } from "@/hooks/use-pipeline";
import { useThesisSettings } from "@/hooks/use-thesis-settings";
import { PIPELINE_STAGES, PRIORITY_LEVELS, PRIMARY_TRADES, type PipelineStageKey, type PrimaryTradeKey } from "@/lib/constants";
import { cn, formatCurrency, formatRelativeDate } from "@/lib/utils";
import { getImpliedEV, getOpportunityValueRange } from "@/lib/valuation";
import { TierBadge } from "@/components/listings/tier-badge";
import { FitScoreGauge } from "@/components/listings/fit-score-gauge";
import {
  getLastActivityDate,
  getActivityGroup,
  getActivityDescription,
} from "@/lib/activity-utils";

// Pipeline stages split into two rows — mature deals on top for quick access
const KANBAN_ROW_1: PipelineStageKey[] = [
  "DUE_DILIGENCE",
  "OFFER_SENT",
  "COUNTER_OFFER_RECEIVED",
  "UNDER_CONTRACT",
];

const KANBAN_ROW_2: PipelineStageKey[] = [
  "CONTACTING",
  "REQUESTED_CIM",
  "SIGNED_NDA",
];

// Combined for drag-and-drop lookups
const ALL_KANBAN_STAGES = [...KANBAN_ROW_1, ...KANBAN_ROW_2];

// ─────────────────────────────────────────────
// Deal Aging Thresholds (per stage)
// Tuple: [greenMax, yellowMax, amberMax] in days
// Beyond amberMax = red
// ─────────────────────────────────────────────

const AGING_THRESHOLDS: Record<string, [number, number, number]> = {
  CONTACTING:             [7,  14, 30],
  REQUESTED_CIM:          [7,  14, 30],
  SIGNED_NDA:             [7,  14, 21],
  DUE_DILIGENCE:          [14, 30, 60],
  OFFER_SENT:             [5,  10, 21],
  COUNTER_OFFER_RECEIVED: [3,  7,  14],
  UNDER_CONTRACT:         [7,  14, 30],
};
const DEFAULT_AGING: [number, number, number] = [7, 14, 30];

function getAgingStatus(days: number, stageKey: string): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  const [greenMax, yellowMax, amberMax] =
    AGING_THRESHOLDS[stageKey] ?? DEFAULT_AGING;

  if (days <= greenMax) {
    return { label: `${days}d`, color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30", borderColor: "border-l-green-400" };
  }
  if (days <= yellowMax) {
    return { label: `${days}d`, color: "text-yellow-700 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", borderColor: "border-l-yellow-400" };
  }
  if (days <= amberMax) {
    return { label: `${days}d`, color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30", borderColor: "border-l-amber-400" };
  }
  return { label: `${days}d`, color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30", borderColor: "border-l-red-500" };
}

// ─────────────────────────────────────────────
// Stage-Gate Validation (soft gates — warn but allow)
// ─────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const STAGE_GATE_RULES: Record<string, { check: (opp: any) => boolean; message: string }[]> = {
  REQUESTED_CIM: [
    { check: (opp) => (opp._count?.contacts ?? 0) >= 1, message: "No contacts added — consider adding a contact before requesting CIM" },
  ],
  SIGNED_NDA: [
    { check: (opp) => !!opp.contactedAt, message: "Contacted date not set — stage may be premature" },
  ],
  DUE_DILIGENCE: [
    { check: (opp) => !!opp.ndaSignedAt, message: "NDA signed date not set — confirm NDA is in place" },
  ],
  OFFER_SENT: [
    { check: (opp) => !!opp.offerPrice, message: "Offer price not set — add an offer price before sending" },
  ],
  UNDER_CONTRACT: [
    { check: (opp) => !!opp.offerSentAt, message: "Offer sent date not set — confirm the offer was sent" },
  ],
};
/* eslint-enable @typescript-eslint/no-explicit-any */

type ViewMode = "stage" | "activity";

/* eslint-disable @typescript-eslint/no-explicit-any */
function KanbanColumn({
  stageKey,
  opportunities: stageOpps,
  draggedId,
  dragOverStage,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  stageKey: PipelineStageKey;
  opportunities: any[];
  draggedId: string | null;
  dragOverStage: string | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, stage: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, stage: string) => void;
}) {
  const stage = PIPELINE_STAGES[stageKey];

  // Column value subtotal
  const columnValue = useMemo(() => {
    let total = 0;
    let hasAny = false;
    for (const opp of stageOpps) {
      const ev = getImpliedEV(opp);
      if (ev !== null) {
        total += ev;
        hasAny = true;
      }
    }
    return hasAny ? total : null;
  }, [stageOpps]);

  const isEmpty = stageOpps.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-muted/30",
        dragOverStage === stageKey && "ring-2 ring-primary/50"
      )}
      onDragOver={(e) => onDragOver(e, stageKey)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stageKey)}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <div className={cn("h-2.5 w-2.5 rounded-full", stage.color)} />
        <span className="text-sm font-medium">{stage.label}</span>
        <div className="ml-auto flex items-center gap-2">
          {columnValue !== null && (
            <span className="text-[10px] font-medium text-muted-foreground" title="Column total implied EV">
              {formatCurrency(columnValue)}
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {stageOpps.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className={cn(
        "flex-1 space-y-2 p-2 overflow-y-auto",
        isEmpty ? "max-h-[80px]" : "max-h-[60vh]"
      )}>
        {stageOpps.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Drop here
          </div>
        ) : (
          stageOpps.map((opp: any) => {
            // Precompute aging status for border + badge
            const daysInStage = opp.stageHistory?.[0]?.createdAt
              ? Math.max(0, Math.floor((Date.now() - new Date(opp.stageHistory[0].createdAt).getTime()) / 86400000))
              : null;
            const aging = daysInStage !== null ? getAgingStatus(daysInStage, stageKey) : null;

            return (
              <div
                key={opp.id}
                draggable
                onDragStart={(e) => onDragStart(e, opp.id)}
                className={cn(
                  "cursor-grab rounded-md border bg-card p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing border-l-[3px]",
                  draggedId === opp.id && "opacity-50",
                  aging ? aging.borderColor : "border-l-transparent"
                )}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/pipeline/${opp.id}`}
                      className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {opp.title}
                    </Link>

                    {/* Owner name */}
                    {opp.contacts?.[0]?.name && (
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <User className="h-2.5 w-2.5" />
                        <span>{opp.contacts[0].name}</span>
                      </div>
                    )}

                    {/* Priority & Win Probability */}
                    {(opp.priority === "CRITICAL" || opp.priority === "HIGH" || opp.priority === "MEDIUM" || (opp.winProbability != null && opp.winProbability > 0)) && (
                      <div className="mt-1 flex items-center gap-1.5">
                        {opp.priority === "CRITICAL" && (
                          <span className="inline-flex items-center gap-0.5 text-destructive animate-pulse">
                            <Flag className="h-3 w-3" />
                            <span className="text-[10px] font-semibold">CRITICAL</span>
                          </span>
                        )}
                        {opp.priority === "HIGH" && (
                          <span className="inline-flex items-center gap-0.5 text-warning">
                            <Flag className="h-3 w-3" />
                            <span className="text-[10px] font-semibold">HIGH</span>
                          </span>
                        )}
                        {opp.priority === "MEDIUM" && (
                          <Flag className="h-3 w-3 text-info opacity-60" />
                        )}
                        {opp.winProbability != null && opp.winProbability > 0 && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                            {Math.round(opp.winProbability * 100)}%
                          </span>
                        )}
                      </div>
                    )}

                    {opp.listing && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {opp.listing.city && (
                          <span>{opp.listing.city}, {opp.listing.state}</span>
                        )}
                        {opp.listing.tier && <TierBadge tier={opp.listing.tier} size="sm" />}
                        {(opp.listing.compositeScore ?? opp.listing.fitScore) != null && (
                          <FitScoreGauge score={(opp.listing.compositeScore ?? opp.listing.fitScore)!} size="sm" showLabel={false} />
                        )}
                        {opp.listing.primaryTrade && (
                          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                            {PRIMARY_TRADES[opp.listing.primaryTrade as PrimaryTradeKey]?.label ?? opp.listing.primaryTrade}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        {/* Implied EV or asking price */}
                        {(() => {
                          const ebitdaVal = opp.listing?.ebitda ? Number(opp.listing.ebitda) : (opp.listing?.inferredEbitda ? Number(opp.listing.inferredEbitda) : null);
                          const multLow = opp.listing?.targetMultipleLow ?? 3.0;
                          const multHigh = opp.listing?.targetMultipleHigh ?? 5.0;
                          if (ebitdaVal && ebitdaVal > 0) {
                            return (
                              <span className="text-xs font-medium text-foreground" title={`EBITDA × ${multLow}–${multHigh}x`}>
                                {formatCurrency(ebitdaVal * multLow)} – {formatCurrency(ebitdaVal * multHigh)}
                              </span>
                            );
                          }
                          return (
                            <span className="text-xs font-medium text-foreground">
                              {opp.listing?.askingPrice
                                ? formatCurrency(Number(opp.listing.askingPrice))
                                : "Price N/A"}
                            </span>
                          );
                        })()}
                        {opp.offerPrice && (
                          <span className="text-[10px] font-medium text-emerald-600">
                            Offer: {formatCurrency(Number(opp.offerPrice))}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {opp.emails && opp.emails.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Mail className="h-3 w-3" />
                            {opp.emails.length}
                          </span>
                        )}
                        {opp.notes && opp.notes.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="h-3 w-3" />
                            {opp.notes.length}
                          </span>
                        )}
                        {/* Color-coded aging badge */}
                        {aging ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              aging.bgColor, aging.color
                            )}
                            title={`${daysInStage} days in ${stage.label}`}
                          >
                            <Clock className="h-2.5 w-2.5" />
                            {aging.label}
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {formatRelativeDate(opp.updatedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Next follow-up date */}
                    {opp.contacts?.[0]?.nextFollowUpDate && (
                      <div className={cn(
                        "mt-1.5 flex items-center gap-1 text-[10px]",
                        new Date(opp.contacts[0].nextFollowUpDate) < new Date()
                          ? "text-red-600 font-medium"
                          : "text-muted-foreground"
                      )}>
                        <CalendarClock className="h-2.5 w-2.5" />
                        Follow-up: {new Date(opp.contacts[0].nextFollowUpDate).toLocaleDateString()}
                      </div>
                    )}

                    {/* Last email preview */}
                    {opp.emails && opp.emails.length > 0 && opp.emails[0]?.email && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Mail className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="truncate">
                          {opp.emails[0].email.subject || "(no subject)"}
                        </span>
                        {opp.emails[0].email.sentAt && (
                          <span className="flex-shrink-0 ml-auto">
                            {formatRelativeDate(opp.emails[0].email.sentAt)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Source badges */}
                    {opp.listing?.sources && opp.listing.sources.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {opp.listing.sources
                          .filter((s: { sourceUrl: string }) => !s.sourceUrl.startsWith("manual://"))
                          .slice(0, 3)
                          .map((s: { id: string; sourceUrl: string }) => (
                            <a
                              key={s.id}
                              href={s.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded p-0.5 text-muted-foreground hover:text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function PipelinePage() {
  const { data, isLoading } = usePipeline();
  const { data: thesisConfig } = useThesisSettings();
  const updateOpportunity = useUpdateOpportunity();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("stage");

  const opportunities = data?.opportunities ?? [];

  const getOpportunitiesByStage = (stage: string) =>
    opportunities.filter((opp) => opp.stage === stage);

  // Activity-grouped opportunities
  const activityGroups = useMemo(() => {
    const activeOpps = opportunities.filter(
      (opp) => !["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(opp.stage)
    );

    const sorted = [...activeOpps].sort((a, b) => {
      const dateA = getLastActivityDate(a);
      const dateB = getLastActivityDate(b);
      return dateB.getTime() - dateA.getTime();
    });

    const groups: Record<string, typeof sorted> = {};
    for (const opp of sorted) {
      const group = getActivityGroup(getLastActivityDate(opp));
      if (!groups[group]) groups[group] = [];
      groups[group].push(opp);
    }

    return groups;
  }, [opportunities]);

  // Pipeline quick stats (computed from already-loaded data)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pipelineStats = useMemo(() => {
    const activeOpps = (opportunities as any[]).filter(
      (opp) => !["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(opp.stage)
    );

    const totalActive = activeOpps.length;

    // Pipeline value range — only include stages from thesis config
    // Uses shared 5-tier waterfall: dealValue → offerPrice → actualEbitda × mult → listing EBITDA × mult → askingPrice
    const valueStages = thesisConfig?.pipelineValueStages ?? [
      "SIGNED_NDA", "DUE_DILIGENCE", "OFFER_SENT", "COUNTER_OFFER_RECEIVED", "UNDER_CONTRACT",
    ];
    const valueOpps = activeOpps.filter((opp) => valueStages.includes(opp.stage));

    let totalValueLow = 0;
    let totalValueHigh = 0;
    let hasValue = false;
    for (const opp of valueOpps) {
      const range = getOpportunityValueRange(opp);
      if (range) {
        totalValueLow += range.low;
        totalValueHigh += range.high;
        hasValue = true;
      }
    }

    // Weighted pipeline value
    let weightedValue = 0;
    for (const opp of activeOpps) {
      const ev = getImpliedEV(opp);
      const prob = opp.winProbability ?? 0;
      if (ev !== null && prob > 0) weightedValue += ev * prob;
    }

    // Avg days in pipeline
    let totalDays = 0;
    let daysCount = 0;
    for (const opp of activeOpps) {
      if (opp.stageHistory && opp.stageHistory.length > 0) {
        const firstEntry = opp.stageHistory[opp.stageHistory.length - 1];
        const days = Math.max(0, Math.floor((Date.now() - new Date(firstEntry.createdAt).getTime()) / 86400000));
        totalDays += days;
        daysCount++;
      }
    }

    // Overdue follow-ups
    const now = new Date();
    let overdueFollowUps = 0;
    for (const opp of activeOpps) {
      if (opp.contacts?.[0]?.nextFollowUpDate && new Date(opp.contacts[0].nextFollowUpDate) < now) {
        overdueFollowUps++;
      }
    }

    return {
      totalActive,
      totalValueLow: hasValue ? totalValueLow : null,
      totalValueHigh: hasValue ? totalValueHigh : null,
      weightedValue: weightedValue > 0 ? weightedValue : null,
      avgDays: daysCount > 0 ? Math.round(totalDays / daysCount) : 0,
      overdueFollowUps,
    };
  }, [opportunities, thesisConfig]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (draggedId) {
      const opp = opportunities.find((o) => o.id === draggedId) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (opp && opp.stage !== stage) {
        // Stage-gate validation (soft gate — warn but allow)
        const rules = STAGE_GATE_RULES[stage];
        if (rules) {
          const failures = rules.filter((rule) => !rule.check(opp));
          for (const failure of failures) {
            toast.warning(failure.message, {
              description: `Moving "${opp.title}" to ${PIPELINE_STAGES[stage as PipelineStageKey]?.label}`,
              duration: 6000,
            });
          }
        }

        updateOpportunity.mutate({
          id: draggedId,
          data: { stage },
        });
      }
    }
    setDraggedId(null);
  };

  return (
    <div className="space-y-4 w-full max-w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {opportunities.length} opportunities in pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="inline-flex rounded-md border bg-muted/30">
            <button
              onClick={() => setViewMode("stage")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-l-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "stage"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              By Stage
            </button>
            <button
              onClick={() => setViewMode("activity")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-r-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "activity"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
              By Activity
            </button>
          </div>

          <Link
            href="/pipeline/add"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Opportunity
          </Link>
        </div>
      </div>

      {/* Pipeline Quick Stats Bar */}
      {!isLoading && viewMode === "stage" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-lg border bg-card px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Active Deals</div>
            <div className="text-lg font-semibold text-foreground">{pipelineStats.totalActive}</div>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Pipeline Value</div>
            <div className="text-sm font-semibold text-foreground">
              {pipelineStats.totalValueLow !== null
                ? `${formatCurrency(pipelineStats.totalValueLow)} – ${formatCurrency(pipelineStats.totalValueHigh!)}`
                : "N/A"}
            </div>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Weighted Value</div>
            <div className="text-sm font-semibold text-foreground">
              {pipelineStats.weightedValue !== null
                ? formatCurrency(pipelineStats.weightedValue)
                : "N/A"}
            </div>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Avg Days</div>
            <div className="text-lg font-semibold text-foreground">{pipelineStats.avgDays}d</div>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Overdue Follow-ups</div>
            <div className={cn(
              "text-lg font-semibold",
              pipelineStats.overdueFollowUps > 0 ? "text-red-600" : "text-foreground"
            )}>
              {pipelineStats.overdueFollowUps}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground" role="status" aria-label="Loading pipeline">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          <p className="mt-2">Loading pipeline...</p>
        </div>
      ) : viewMode === "stage" ? (
        <>
          {/* Kanban Board — Two-Row Grid Layout */}
          <div className="space-y-4">
            {/* Row 1: Active Negotiation — most mature deals first */}
            <div>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                Active Negotiation
                <span className="h-px flex-1 bg-border" />
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {KANBAN_ROW_1.map((stageKey) => (
                  <KanbanColumn
                    key={stageKey}
                    stageKey={stageKey}
                    opportunities={getOpportunitiesByStage(stageKey)}
                    draggedId={draggedId}
                    dragOverStage={dragOverStage}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  />
                ))}
              </div>
            </div>

            {/* Row 2: Early Pipeline */}
            <div>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                Early Pipeline
                <span className="h-px flex-1 bg-border" />
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {KANBAN_ROW_2.map((stageKey) => (
                  <KanbanColumn
                    key={stageKey}
                    stageKey={stageKey}
                    opportunities={getOpportunitiesByStage(stageKey)}
                    draggedId={draggedId}
                    dragOverStage={dragOverStage}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Closed/Hold section */}
          {opportunities.some((o) =>
            ["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(o.stage)
          ) && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Closed / On Hold</h2>
              <div className="space-y-2">
                {opportunities
                  .filter((o) => ["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(o.stage))
                  .map((opp) => (
                    <Link
                      key={opp.id}
                      href={`/pipeline/${opp.id}`}
                      className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            PIPELINE_STAGES[opp.stage as PipelineStageKey]?.color
                          )}
                        />
                        <span className="text-sm">{opp.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {PIPELINE_STAGES[opp.stage as PipelineStageKey]?.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeDate(opp.updatedAt)}
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── Activity View ── */
        <div className="space-y-6">
          {["Today", "This Week", "This Month", "Older"].map((groupLabel) => {
            const groupOpps = activityGroups[groupLabel];
            if (!groupOpps || groupOpps.length === 0) return null;

            return (
              <div key={groupLabel}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-foreground">{groupLabel}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {groupOpps.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {groupOpps.map((opp) => {
                    const stageInfo = PIPELINE_STAGES[opp.stage as PipelineStageKey];
                    const priorityInfo = PRIORITY_LEVELS[opp.priority as keyof typeof PRIORITY_LEVELS];

                    return (
                      <Link
                        key={opp.id}
                        href={`/pipeline/${opp.id}`}
                        className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-all"
                      >
                        {/* Stage indicator */}
                        <div className="flex flex-col items-center gap-1">
                          <div className={cn("h-3 w-3 rounded-full", stageInfo?.color)} />
                        </div>

                        {/* Main content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{opp.title}</span>
                            {/* Stage badge */}
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                              stageInfo?.color, "bg-opacity-20"
                            )}>
                              {stageInfo?.label}
                            </span>
                            {/* Priority */}
                            {priorityInfo && (
                              <Flag className={cn("h-3 w-3", priorityInfo.color)} />
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            {opp.listing?.city && (
                              <span>{opp.listing.city}, {opp.listing.state}</span>
                            )}
                            {opp.listing?.askingPrice && (
                              <span className="font-medium text-foreground">
                                {formatCurrency(Number(opp.listing.askingPrice))}
                              </span>
                            )}
                            {opp.offerPrice && (
                              <span className="font-medium text-emerald-600">
                                Offer: {formatCurrency(Number(opp.offerPrice))}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Activity info */}
                        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getActivityDescription(opp)}
                          </div>
                          <div className="flex items-center gap-2">
                            {opp.emails && opp.emails.length > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Mail className="h-3 w-3" />
                                {opp.emails.length}
                              </span>
                            )}
                            {opp.notes && opp.notes.length > 0 && (
                              <span className="flex items-center gap-0.5">
                                <MessageSquare className="h-3 w-3" />
                                {opp.notes.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* No activity placeholder */}
          {Object.values(activityGroups).every((g) => g.length === 0) && (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-medium">No Active Opportunities</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Add opportunities to your pipeline to see them organized by recent activity.
              </p>
            </div>
          )}

          {/* Closed/Hold section for activity view */}
          {opportunities.some((o) =>
            ["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(o.stage)
          ) && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Closed / On Hold</h2>
              <div className="space-y-2">
                {opportunities
                  .filter((o) => ["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(o.stage))
                  .map((opp) => (
                    <Link
                      key={opp.id}
                      href={`/pipeline/${opp.id}`}
                      className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            PIPELINE_STAGES[opp.stage as PipelineStageKey]?.color
                          )}
                        />
                        <span className="text-sm">{opp.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {PIPELINE_STAGES[opp.stage as PipelineStageKey]?.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeDate(opp.updatedAt)}
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
