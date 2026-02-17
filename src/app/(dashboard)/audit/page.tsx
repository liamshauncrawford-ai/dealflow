"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  Plus,
  Trash2,
  Link2,
  Unlink,
  Send,
  Upload,
  CheckCircle2,
  PenLine,
  Bot,
  Filter,
  X,
} from "lucide-react";
import { useAuditLog } from "@/hooks/use-audit-log";
import { cn, formatRelativeDate } from "@/lib/utils";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  OPPORTUNITY: "Opportunity",
  CONTACT: "Contact",
  NOTE: "Note",
  DOCUMENT: "Document",
  TASK: "Task",
  EMAIL: "Email",
  FINANCIAL: "Financial",
  USER: "User",
  ACCESS: "Access",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  CREATED: "Created",
  UPDATED: "Updated",
  DELETED: "Deleted",
  STAGE_CHANGED: "Stage Changed",
  LINKED: "Linked",
  UNLINKED: "Unlinked",
  SENT: "Sent",
  UPLOADED: "Uploaded",
  COMPLETED: "Completed",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  CREATED: "bg-emerald-500",
  UPDATED: "bg-blue-500",
  DELETED: "bg-red-500",
  STAGE_CHANGED: "bg-violet-500",
  LINKED: "bg-cyan-500",
  UNLINKED: "bg-orange-500",
  SENT: "bg-indigo-500",
  UPLOADED: "bg-teal-500",
  COMPLETED: "bg-green-600",
};

const EVENT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATED: Plus,
  UPDATED: PenLine,
  DELETED: Trash2,
  STAGE_CHANGED: ArrowRightLeft,
  LINKED: Link2,
  UNLINKED: Unlink,
  SENT: Send,
  UPLOADED: Upload,
  COMPLETED: CheckCircle2,
};

const ENTITY_TYPES = Object.keys(ENTITY_TYPE_LABELS);
const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS);

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState<string | undefined>();
  const [eventFilter, setEventFilter] = useState<string | undefined>();

  const { data, isLoading } = useAuditLog({
    page,
    limit: 50,
    entityType: entityFilter,
    eventType: eventFilter,
  });

  const logs = data?.logs ?? [];
  const pagination = data?.pagination;
  const hasFilters = entityFilter || eventFilter;

  const clearFilters = () => {
    setEntityFilter(undefined);
    setEventFilter(undefined);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Track every change across deals, contacts, tasks, documents, and emails.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={entityFilter ?? ""}
          onChange={(e) => {
            setEntityFilter(e.target.value || undefined);
            setPage(1);
          }}
          className="rounded border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">All Entities</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {ENTITY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={eventFilter ?? ""}
          onChange={(e) => {
            setEventFilter(e.target.value || undefined);
            setPage(1);
          }}
          className="rounded border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">All Events</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
        {pagination && (
          <span className="ml-auto text-xs text-muted-foreground">
            {pagination.total} {pagination.total === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12" role="status" aria-label="Loading audit log">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center">
          <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {hasFilters ? "No entries match the selected filters." : "No audit entries yet. Changes will appear here as you work."}
          </p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute bottom-0 left-[15px] top-0 w-px bg-border" />

          {logs.map((log) => {
            const EventIcon = EVENT_TYPE_ICONS[log.eventType] ?? PenLine;
            const dotColor = EVENT_TYPE_COLORS[log.eventType] ?? "bg-muted-foreground";

            return (
              <div key={log.id} className="relative flex gap-4 py-3 pl-10">
                {/* Dot */}
                <div
                  className={cn(
                    "absolute left-[9px] top-[18px] h-3.5 w-3.5 rounded-full border-2 border-background",
                    dotColor
                  )}
                />

                <div className="min-w-0 flex-1">
                  {/* Summary line */}
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {log.summary}
                      </p>

                      {/* Field change detail */}
                      {log.fieldName && (log.oldValue || log.newValue) && (
                        <div className="mt-1 flex items-center gap-2 text-xs font-mono">
                          {log.oldValue && (
                            <span className="text-muted-foreground line-through">
                              {truncateValue(log.oldValue)}
                            </span>
                          )}
                          {log.oldValue && log.newValue && (
                            <span className="text-muted-foreground">&rarr;</span>
                          )}
                          {log.newValue && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {truncateValue(log.newValue)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Badges & meta */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {log.actorType === "WORKFLOW" && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                          <Bot className="h-2.5 w-2.5" />
                          AUTO
                        </span>
                      )}
                      <span className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        "bg-muted text-muted-foreground"
                      )}>
                        <EventIcon className="h-2.5 w-2.5" />
                        {EVENT_TYPE_LABELS[log.eventType] ?? log.eventType}
                      </span>
                    </div>
                  </div>

                  {/* Footer: user, entity type, deal link, timestamp */}
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {log.user && (
                      <>
                        <span className="flex items-center gap-1">
                          {log.user.image ? (
                            <img src={log.user.image} alt="" className="h-3.5 w-3.5 rounded-full" />
                          ) : (
                            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/10 text-[8px] font-medium text-primary">
                              {(log.user.name ?? log.user.email ?? "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                          {log.user.name ?? log.user.email}
                        </span>
                        <span>&middot;</span>
                      </>
                    )}
                    <span>{ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType}</span>
                    {log.opportunity && (
                      <>
                        <span>&middot;</span>
                        <Link
                          href={`/pipeline/${log.opportunity.id}`}
                          className="text-primary hover:underline truncate max-w-[200px]"
                        >
                          {log.opportunity.title}
                        </Link>
                      </>
                    )}
                    <span>&middot;</span>
                    <span>{formatRelativeDate(log.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function truncateValue(value: string, max = 60): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + "...";
}
