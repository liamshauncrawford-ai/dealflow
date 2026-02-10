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
} from "lucide-react";
import { usePipeline, useUpdateOpportunity } from "@/hooks/use-pipeline";
import { PIPELINE_STAGES, PRIORITY_LEVELS, type PipelineStageKey } from "@/lib/constants";
import { cn, formatCurrency, formatRelativeDate } from "@/lib/utils";
import {
  getLastActivityDate,
  getActivityGroup,
  getActivityDescription,
} from "@/lib/activity-utils";

// Active pipeline stages for the Kanban board (not closed/hold)
const KANBAN_STAGES: PipelineStageKey[] = [
  "CONTACTING",
  "INTERESTED",
  "REQUESTED_CIM",
  "SIGNED_NDA",
  "DUE_DILIGENCE",
  "OFFER_SENT",
  "COUNTER_OFFER_RECEIVED",
  "UNDER_CONTRACT",
];

type ViewMode = "stage" | "activity";

export default function PipelinePage() {
  const { data, isLoading } = usePipeline();
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
      const opp = opportunities.find((o) => o.id === draggedId);
      if (opp && opp.stage !== stage) {
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

      {isLoading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground" role="status" aria-label="Loading pipeline">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          <p className="mt-2">Loading pipeline...</p>
        </div>
      ) : viewMode === "stage" ? (
        <>
          {/* Kanban Board */}
          <div className="flex gap-3 overflow-x-auto pb-4">
            {KANBAN_STAGES.map((stageKey) => {
              const stage = PIPELINE_STAGES[stageKey];
              const stageOpps = getOpportunitiesByStage(stageKey);

              return (
                <div
                  key={stageKey}
                  className={cn(
                    "flex min-w-[280px] flex-shrink-0 flex-col rounded-lg border bg-muted/30",
                    dragOverStage === stageKey && "ring-2 ring-primary/50"
                  )}
                  onDragOver={(e) => handleDragOver(e, stageKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stageKey)}
                >
                  {/* Column Header */}
                  <div className="flex items-center gap-2 border-b px-3 py-2.5">
                    <div className={cn("h-2.5 w-2.5 rounded-full", stage.color)} />
                    <span className="text-sm font-medium">{stage.label}</span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {stageOpps.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 space-y-2 p-2">
                    {stageOpps.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                        Drop here
                      </div>
                    ) : (
                      stageOpps.map((opp) => (
                        <div
                          key={opp.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, opp.id)}
                          className={cn(
                            "cursor-grab rounded-md border bg-card p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing",
                            draggedId === opp.id && "opacity-50"
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

                              {opp.listing && (
                                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                  {opp.listing.city && (
                                    <span>{opp.listing.city}, {opp.listing.state}</span>
                                  )}
                                </div>
                              )}

                              <div className="mt-2 flex items-center justify-between">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-medium text-foreground">
                                    {opp.listing?.askingPrice
                                      ? formatCurrency(Number(opp.listing.askingPrice))
                                      : "Price N/A"}
                                  </span>
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
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="h-3 w-3" />
                                    {formatRelativeDate(opp.updatedAt)}
                                  </span>
                                </div>
                              </div>

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
                      ))
                    )}
                  </div>
                </div>
              );
            })}
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
