"use client";

import Link from "next/link";
import {
  ScrollText,
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
} from "lucide-react";
import { useAuditLog } from "@/hooks/use-audit-log";
import { cn, formatRelativeDate } from "@/lib/utils";

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

interface AuditLogPanelProps {
  opportunityId: string;
}

export function AuditLogPanel({ opportunityId }: AuditLogPanelProps) {
  const { data, isLoading } = useAuditLog({
    opportunityId,
    limit: 10,
  });

  const logs = data?.logs ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Audit Trail</h2>
          {total > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {total}
            </span>
          )}
        </div>
        {total > 10 && (
          <Link
            href={`/audit?opportunityId=${opportunityId}`}
            className="text-xs text-primary hover:underline"
          >
            View All
          </Link>
        )}
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-2">
            No audit entries yet
          </p>
        ) : (
          <div className="relative space-y-3">
            <div className="absolute bottom-0 left-[5px] top-0 w-px bg-border" />

            {logs.map((log) => {
              const dotColor = EVENT_TYPE_COLORS[log.eventType] ?? "bg-muted-foreground";
              const EventIcon = EVENT_TYPE_ICONS[log.eventType] ?? PenLine;

              return (
                <div key={log.id} className="relative flex gap-3 pl-5">
                  <div
                    className={cn(
                      "absolute left-0 top-[5px] h-2.5 w-2.5 rounded-full border-2 border-card",
                      dotColor
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1.5">
                      <EventIcon className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs leading-relaxed">
                        {log.summary}
                      </p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{formatRelativeDate(log.createdAt)}</span>
                      {log.actorType === "WORKFLOW" && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1 py-0 text-[9px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                          <Bot className="h-2 w-2" />
                          AUTO
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
