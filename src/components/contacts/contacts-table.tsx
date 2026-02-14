"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Star,
} from "lucide-react";
import { cn, formatRelativeDate, truncate } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  OUTREACH_STATUSES,
  CONTACT_SENTIMENTS,
  type PipelineStageKey,
} from "@/lib/constants";
import type { ContactWithOpportunity } from "@/types/contact";

interface ContactsTableProps {
  contacts: ContactWithOpportunity[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onContactClick: (contact: ContactWithOpportunity) => void;
}

const INTEREST_COLORS: Record<string, string> = {
  UNKNOWN: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800",
  LOW: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20",
  MEDIUM: "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20",
  HIGH: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20",
  VERY_HIGH: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/20",
};

const INTEREST_LABELS: Record<string, string> = {
  UNKNOWN: "Unknown",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  VERY_HIGH: "Very High",
};

const columnHelper = createColumnHelper<ContactWithOpportunity>();

function SortHeader({
  label,
  columnId,
  sorting,
}: {
  label: string;
  columnId: string;
  sorting: SortingState;
}) {
  const sortState = sorting.find((s) => s.id === columnId);
  return (
    <span className="flex items-center gap-1">
      {label}
      {sortState ? (
        sortState.desc ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUp className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </span>
  );
}

function formatDate(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return "";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(dateVal: string | Date | null | undefined): boolean {
  if (!dateVal) return false;
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  return d < new Date();
}

export function ContactsTable({
  contacts,
  sorting,
  onSortingChange,
  onContactClick,
}: ContactsTableProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: ColumnDef<ContactWithOpportunity, any>[] = useMemo(
    () => [
      // 1. Name
      columnHelper.accessor("name", {
        header: () => <SortHeader label="Name" columnId="name" sorting={sorting} />,
        cell: (info) => {
          const contact = info.row.original;
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {contact.isPrimary && (
                  <Star className="h-3 w-3 shrink-0 text-amber-500 fill-amber-500" />
                )}
                <span className="font-medium text-sm truncate">{contact.name}</span>
              </div>
              {contact.email && (
                <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
              )}
            </div>
          );
        },
        size: 200,
      }),

      // 2. Company
      columnHelper.accessor("company", {
        header: () => <SortHeader label="Company" columnId="company" sorting={sorting} />,
        cell: (info) => {
          const contact = info.row.original;
          return (
            <div className="min-w-0">
              <span className="text-sm truncate block">{contact.company || "—"}</span>
              {contact.role && (
                <p className="text-xs text-muted-foreground truncate">{contact.role}</p>
              )}
            </div>
          );
        },
        size: 160,
      }),

      // 3. Deal
      columnHelper.display({
        id: "deal",
        header: "Deal",
        cell: (info) => {
          const opp = info.row.original.opportunity;
          if (!opp) return <span className="text-muted-foreground">—</span>;
          return (
            <Link
              href={`/pipeline/${opp.id}`}
              className="text-sm text-primary hover:underline truncate block max-w-[180px]"
              onClick={(e) => e.stopPropagation()}
              title={opp.title}
            >
              {truncate(opp.title, 30)}
            </Link>
          );
        },
        size: 200,
      }),

      // 4. Stage
      columnHelper.display({
        id: "stage",
        header: "Stage",
        cell: (info) => {
          const opp = info.row.original.opportunity;
          if (!opp) return null;
          const stageConfig = PIPELINE_STAGES[opp.stage as PipelineStageKey];
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white",
                stageConfig?.color || "bg-gray-500"
              )}
            >
              {stageConfig?.label || opp.stage}
            </span>
          );
        },
        size: 130,
      }),

      // 5. Interest
      columnHelper.display({
        id: "interest",
        header: "Interest",
        cell: (info) => {
          const level = info.row.original.interestLevel;
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                INTEREST_COLORS[level] || INTEREST_COLORS.UNKNOWN
              )}
            >
              {INTEREST_LABELS[level] || level}
            </span>
          );
        },
        size: 90,
      }),

      // 6. Outreach
      columnHelper.display({
        id: "outreach",
        header: "Outreach",
        cell: (info) => {
          const status = info.row.original.outreachStatus;
          if (!status) return <span className="text-xs text-muted-foreground">—</span>;
          const config = OUTREACH_STATUSES[status as keyof typeof OUTREACH_STATUSES];
          return (
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {config?.label || status}
            </span>
          );
        },
        size: 130,
      }),

      // 7. Sentiment
      columnHelper.display({
        id: "sentiment",
        header: "Sentiment",
        cell: (info) => {
          const sentiment = info.row.original.sentiment;
          if (!sentiment) return <span className="text-xs text-muted-foreground">—</span>;
          const config = CONTACT_SENTIMENTS[sentiment as keyof typeof CONTACT_SENTIMENTS];
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                config?.color || "text-gray-600 bg-gray-100"
              )}
            >
              {config?.label || sentiment}
            </span>
          );
        },
        size: 100,
      }),

      // 8. Follow-up
      columnHelper.accessor("nextFollowUpDate", {
        header: () => (
          <SortHeader label="Follow-up" columnId="nextFollowUpDate" sorting={sorting} />
        ),
        cell: (info) => {
          const dateStr = info.getValue() as string | Date | null;
          if (!dateStr) return <span className="text-xs text-muted-foreground">—</span>;
          const overdue = isOverdue(dateStr);
          return (
            <div className="flex items-center gap-1.5">
              {overdue && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
              )}
              <span
                className={cn(
                  "text-xs",
                  overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"
                )}
              >
                {formatDate(dateStr)}
              </span>
            </div>
          );
        },
        size: 120,
      }),

      // 9. Last Activity
      columnHelper.accessor("lastInteractionDate", {
        header: () => (
          <SortHeader label="Last Activity" columnId="lastInteractionDate" sorting={sorting} />
        ),
        cell: (info) => {
          const dateStr = info.getValue() as string | Date | null;
          const contact = info.row.original;
          if (!dateStr) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(dateStr)}
              </span>
              {contact.lastInteractionType && (
                <span className="rounded border px-1 py-0.5 text-[9px] text-muted-foreground">
                  {contact.lastInteractionType}
                </span>
              )}
            </div>
          );
        },
        size: 140,
      }),
    ],
    [sorting]
  );

  const table = useReactTable({
    data: contacts,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-left">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b bg-muted/30">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    "px-3 py-2.5 text-xs font-medium text-muted-foreground",
                    header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground"
                  )}
                  style={{ width: header.getSize() }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                No contacts found
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                onClick={() => onContactClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 py-2.5"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
