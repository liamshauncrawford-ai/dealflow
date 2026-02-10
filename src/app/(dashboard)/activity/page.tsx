"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Clock,
  Mail,
  MessageSquare,
  Flag,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { usePipeline } from "@/hooks/use-pipeline";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { PIPELINE_STAGES, PRIORITY_LEVELS, type PipelineStageKey } from "@/lib/constants";
import { cn, formatCurrency, formatRelativeDate } from "@/lib/utils";
import {
  getLastActivityDate,
  getActivityGroup,
  getActivityDescription,
  getFollowUpStatus,
} from "@/lib/activity-utils";

const GROUP_ORDER = ["Needs Follow-up", "Today", "This Week", "This Month", "Older"];

export default function ActivityPage() {
  const { data, isLoading } = usePipeline();
  const { data: tasksData } = useTasks({ status: "pending", limit: 20 });
  const updateTask = useUpdateTask();

  const opportunities = data?.opportunities ?? [];

  const activityGroups = useMemo(() => {
    // Only active deals
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
      const followUp = getFollowUpStatus(opp);
      let group: string;

      if (followUp === "overdue") {
        group = "Needs Follow-up";
      } else {
        group = getActivityGroup(getLastActivityDate(opp));
      }

      if (!groups[group]) groups[group] = [];
      groups[group].push(opp);
    }

    return groups;
  }, [opportunities]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Track deal activity and follow-ups across your pipeline
        </p>
      </div>

      {/* Upcoming Tasks */}
      {tasksData?.tasks && tasksData.tasks.length > 0 && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Upcoming Tasks</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {tasksData.tasks.length}
            </span>
          </div>
          <div className="divide-y">
            {tasksData.tasks.slice(0, 10).map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button
                    onClick={() => updateTask.mutate({ id: task.id, data: { isCompleted: true } })}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Circle className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm">{task.title}</span>
                    {task.opportunity && (
                      <Link href={`/pipeline/${task.opportunity.id}`} className="ml-2 text-xs text-primary hover:underline">
                        {task.opportunity.title}
                      </Link>
                    )}
                  </div>
                  {task.dueDate && (
                    <span className={cn("text-xs", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {isOverdue ? "Overdue: " : ""}{formatRelativeDate(task.dueDate)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground" role="status" aria-label="Loading activity">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          <p className="mt-2">Loading activity...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {GROUP_ORDER.map((groupLabel) => {
            const groupOpps = activityGroups[groupLabel];
            if (!groupOpps || groupOpps.length === 0) return null;

            const isFollowUp = groupLabel === "Needs Follow-up";

            return (
              <div key={groupLabel}>
                <div className="flex items-center gap-2 mb-3">
                  {isFollowUp ? (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h2
                    className={cn(
                      "text-sm font-semibold",
                      isFollowUp ? "text-amber-600" : "text-foreground"
                    )}
                  >
                    {groupLabel}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      isFollowUp
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {groupOpps.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {groupOpps.map((opp) => {
                    const stageInfo = PIPELINE_STAGES[opp.stage as PipelineStageKey];
                    const priorityInfo =
                      PRIORITY_LEVELS[opp.priority as keyof typeof PRIORITY_LEVELS];
                    const followUp = getFollowUpStatus(opp);

                    return (
                      <Link
                        key={opp.id}
                        href={`/pipeline/${opp.id}`}
                        className={cn(
                          "flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-all",
                          followUp === "overdue" && "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/30"
                        )}
                      >
                        {/* Stage indicator */}
                        <div className="flex flex-col items-center gap-1">
                          <div className={cn("h-3 w-3 rounded-full", stageInfo?.color)} />
                          {followUp === "overdue" && (
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          )}
                          {followUp === "ok" && (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          )}
                        </div>

                        {/* Main content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {opp.title}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                                stageInfo?.color,
                                "bg-opacity-20"
                              )}
                            >
                              {stageInfo?.label}
                            </span>
                            {priorityInfo && (
                              <Flag className={cn("h-3 w-3", priorityInfo.color)} />
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            {opp.listing?.city && (
                              <span>
                                {opp.listing.city}, {opp.listing.state}
                              </span>
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

          {/* Empty state */}
          {Object.values(activityGroups).every(
            (g) => !g || g.length === 0
          ) && (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-medium">No Active Deals</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Add deals to your pipeline to track activity and follow-ups here.
              </p>
              <Link
                href="/pipeline/add"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add Opportunity
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
