"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  EyeOff,
  Eye,
  PlusCircle,
  Calculator,
} from "lucide-react";
import { cn, formatCurrency, formatRelativeDate, truncate } from "@/lib/utils";
import { PLATFORMS, type PlatformKey } from "@/lib/constants";
import type { ListingWithSources } from "@/types/listing";

interface ListingsTableProps {
  listings: ListingWithSources[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onHide: (id: string) => void;
  onPromote: (id: string) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
}

function toNum(val: unknown): number | null {
  if (val == null) return null;
  const n = typeof val === "string" ? parseFloat(val) : (val as number);
  return isNaN(n) ? null : n;
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted-foreground text-xs">-</span>;

  let colorClasses: string;
  if (score >= 80) colorClasses = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  else if (score >= 60) colorClasses = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  else colorClasses = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", colorClasses)}>
      {score}
    </span>
  );
}

function EffectiveEbitda({ listing }: { listing: ListingWithSources }) {
  const ebitda = toNum(listing.ebitda);
  const inferred = toNum(listing.inferredEbitda);
  const display = ebitda ?? inferred;
  const isInferred = ebitda == null && inferred != null;

  if (display == null) return <span className="text-muted-foreground">-</span>;

  return (
    <span className={cn("flex items-center gap-1", isInferred && "text-muted-foreground")}>
      {isInferred && <Calculator className="h-3 w-3" />}
      <span className={cn(isInferred && "border-b border-dashed border-muted-foreground/40")}>
        {formatCurrency(display)}
      </span>
    </span>
  );
}

function EffectiveSde({ listing }: { listing: ListingWithSources }) {
  const sde = toNum(listing.sde);
  const inferred = toNum(listing.inferredSde);
  const display = sde ?? inferred;
  const isInferred = sde == null && inferred != null;

  if (display == null) return <span className="text-muted-foreground">-</span>;

  return (
    <span className={cn("flex items-center gap-1", isInferred && "text-muted-foreground")}>
      {isInferred && <Calculator className="h-3 w-3" />}
      <span className={cn(isInferred && "border-b border-dashed border-muted-foreground/40")}>
        {formatCurrency(display)}
      </span>
    </span>
  );
}

function SourceBadges({ sources }: { sources: ListingWithSources["sources"] }) {
  return (
    <div className="flex gap-1">
      {sources.map((s) => {
        const platform = PLATFORMS[s.platform as PlatformKey];
        if (!platform) return null;
        return (
          <a
            key={s.id}
            href={s.sourceUrl.startsWith("manual://") ? undefined : s.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: platform.color }}
            title={`View on ${platform.label}`}
            onClick={(e) => e.stopPropagation()}
          >
            {platform.shortLabel}
          </a>
        );
      })}
    </div>
  );
}

function FreshnessIndicator({ lastSeenAt }: { lastSeenAt: string | Date }) {
  const d = new Date(lastSeenAt);
  const daysSince = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));

  let color = "bg-success"; // Green: seen in last 7 days
  if (daysSince > 14) color = "bg-destructive"; // Red: not seen in 14+ days
  else if (daysSince > 7) color = "bg-warning"; // Yellow: 7-14 days

  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full", color)}
      title={`Last seen ${formatRelativeDate(d)}`}
    />
  );
}

export function ListingsTable({
  listings,
  sorting,
  onSortingChange,
  onHide,
  onPromote,
  rowSelection = {},
  onRowSelectionChange,
}: ListingsTableProps) {
  const columnHelper = createColumnHelper<ListingWithSources>();

  const columns: ColumnDef<ListingWithSources, unknown>[] = useMemo(() => [
    // Checkbox column (only when selection is enabled)
    ...(onRowSelectionChange ? [columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="h-3.5 w-3.5 rounded border-gray-300"
        />
      ),
      size: 36,
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 rounded border-gray-300"
        />
      ),
    }) as ColumnDef<ListingWithSources, unknown>] : []),
    columnHelper.display({
      id: "freshness",
      header: "",
      size: 32,
      cell: ({ row }) => <FreshnessIndicator lastSeenAt={row.original.lastSeenAt} />,
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.accessor("title", {
      header: "Business",
      size: 280,
      cell: ({ row }) => (
        <div className="max-w-[280px]">
          <Link
            href={`/listings/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {truncate(row.original.title, 50)}
          </Link>
          {row.original.industry && (
            <p className="text-xs text-muted-foreground">{row.original.industry}</p>
          )}
        </div>
      ),
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.accessor("city", {
      header: "Location",
      size: 150,
      cell: ({ row }) => {
        const city = row.original.city;
        const state = row.original.state;
        if (!city && !state) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="text-sm">
            {city}{city && state ? ", " : ""}{state}
          </span>
        );
      },
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.accessor("compositeScore", {
      header: "Score",
      size: 70,
      cell: ({ row }) => <ScoreBadge score={row.original.compositeScore ?? row.original.fitScore} />,
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.accessor("askingPrice", {
      header: "Asking Price",
      size: 130,
      cell: ({ row }) => {
        const val = toNum(row.original.askingPrice);
        if (val == null) return <span className="text-muted-foreground">-</span>;
        return <span className="font-medium">{formatCurrency(val)}</span>;
      },
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.accessor("revenue", {
      header: "Revenue",
      size: 130,
      cell: ({ row }) => {
        const val = toNum(row.original.revenue);
        if (val == null) return <span className="text-muted-foreground">-</span>;
        return formatCurrency(val);
      },
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.display({
      id: "ebitda",
      header: "EBITDA",
      size: 130,
      cell: ({ row }) => <EffectiveEbitda listing={row.original} />,
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.display({
      id: "sde",
      header: "SDE",
      size: 130,
      cell: ({ row }) => <EffectiveSde listing={row.original} />,
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.accessor("brokerCompany", {
      header: "Broker",
      size: 140,
      cell: ({ row }) => {
        const broker = row.original.brokerName || row.original.brokerCompany;
        if (!broker) return <span className="text-muted-foreground">-</span>;
        return <span className="text-sm">{truncate(broker, 25)}</span>;
      },
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.display({
      id: "sources",
      header: "Sources",
      size: 100,
      cell: ({ row }) => <SourceBadges sources={row.original.sources} />,
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.accessor("firstSeenAt", {
      header: "Listed",
      size: 90,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatRelativeDate(row.original.firstSeenAt)}
        </span>
      ),
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.display({
      id: "pipeline",
      header: "",
      size: 40,
      cell: ({ row }) => {
        if (row.original.opportunity) {
          return (
            <Link
              href={`/pipeline/${row.original.opportunity.id}`}
              className="text-xs text-primary hover:underline"
              title="View in pipeline"
            >
              In Pipeline
            </Link>
          );
        }
        return null;
      },
    }) as ColumnDef<ListingWithSources, unknown>,
    columnHelper.display({
      id: "actions",
      header: "",
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {/* External link to first non-manual source */}
          {row.original.sources.some((s) => !s.sourceUrl.startsWith("manual://")) && (
            <a
              href={row.original.sources.find((s) => !s.sourceUrl.startsWith("manual://"))?.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="View original listing"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {!row.original.opportunity && (
            <button
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
              title="Add to pipeline"
              onClick={(e) => {
                e.stopPropagation();
                onPromote(row.original.id);
              }}
            >
              <PlusCircle className="h-4 w-4" />
            </button>
          )}
          <button
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={row.original.isHidden ? "Show listing" : "Hide listing"}
            onClick={(e) => {
              e.stopPropagation();
              onHide(row.original.id);
            }}
          >
            {row.original.isHidden ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
        </div>
      ),
    }) as ColumnDef<ListingWithSources, unknown>,
  ], [columnHelper, onHide, onPromote, onRowSelectionChange]);

  const table = useReactTable({
    data: listings,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(newSorting);
    },
    onRowSelectionChange: onRowSelectionChange
      ? (updater) => {
          const newSelection = typeof updater === "function" ? updater(rowSelection) : updater;
          onRowSelectionChange(newSelection);
        }
      : undefined,
    enableRowSelection: !!onRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b bg-muted/50">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = sorting.find((s) => s.id === header.column.id);

                return (
                  <th
                    key={header.id}
                    className={cn(
                      "h-10 px-3 text-left text-xs font-medium text-muted-foreground",
                      canSort && "cursor-pointer select-none hover:text-foreground"
                    )}
                    style={{ width: header.getSize() }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="ml-1">
                          {sorted ? (
                            sorted.desc ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUp className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {listings.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                No target businesses found
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b transition-colors hover:bg-muted/30",
                  row.original.isHidden && "opacity-50"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5">
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
