"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useUpdateHistoricPnlCell } from "@/hooks/use-historic-financials";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Column {
  header: string;
  subheader: string | null;
}

interface HistoricPnlTableProps {
  pnl: any;
  opportunityId: string;
}

// ─── Value formatting ───────────────────────────

function formatValue(val: number | null): string {
  if (val === null || val === undefined) return "";
  const abs = Math.abs(val);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  // Show negatives in parentheses (accounting style)
  return val < 0 ? `(${formatted})` : formatted;
}

// ─── Indentation levels ─────────────────────────

const DEPTH_PADDING: Record<number, string> = {
  0: "pl-4",
  1: "pl-9",
  2: "pl-14",
  3: "pl-19",
  4: "pl-24",
};

function depthClass(depth: number): string {
  return DEPTH_PADDING[depth] ?? "pl-24";
}

// ─── Component ──────────────────────────────────

export function HistoricPnlTable({ pnl, opportunityId }: HistoricPnlTableProps) {
  const columns = (pnl.columns as Column[]) ?? [];
  const rows = (pnl.rows as any[]) ?? [];
  const updateCell = useUpdateHistoricPnlCell(opportunityId);

  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    type: "value" | "label";
    columnIndex?: number;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // ── Edit handlers ──

  function handleCellDoubleClick(row: any, columnIndex: number) {
    if (row.isBlank) return;
    const values = (row.values as (number | null)[]) ?? [];
    const current = values[columnIndex];
    setEditingCell({ rowId: row.id, type: "value", columnIndex });
    setEditValue(current !== null && current !== undefined ? String(current) : "");
  }

  function handleLabelDoubleClick(row: any) {
    if (row.isBlank) return;
    setEditingCell({ rowId: row.id, type: "label" });
    setEditValue(row.label);
  }

  function handleSave(row: any) {
    if (!editingCell) return;

    if (editingCell.type === "label") {
      const newLabel = editValue.trim();
      if (newLabel !== row.label) {
        updateCell.mutate({
          pnlId: pnl.id,
          rowId: row.id,
          label: newLabel,
        });
      }
    } else if (editingCell.type === "value" && editingCell.columnIndex !== undefined) {
      const values = (row.values as (number | null)[]) ?? [];
      const currentVal = values[editingCell.columnIndex];
      const newVal = editValue.trim() === "" ? null : parseFloat(editValue);
      const changed =
        newVal === null
          ? currentVal !== null
          : !isNaN(newVal) && newVal !== currentVal;

      if (changed) {
        updateCell.mutate({
          pnlId: pnl.id,
          rowId: row.id,
          columnIndex: editingCell.columnIndex,
          value: newVal === null || isNaN(newVal as number) ? null : newVal,
        });
      }
    }

    setEditingCell(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, row: any) {
    if (e.key === "Enter") handleSave(row);
    if (e.key === "Escape") setEditingCell(null);
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        {/* Column headers */}
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/50 px-4 py-2 text-left font-medium text-muted-foreground w-72">
              {/* Empty — label column */}
            </th>
            {columns.map((col, i) => (
              <th
                key={i}
                className="min-w-[130px] px-3 py-2 text-right"
              >
                <div className="text-xs font-medium text-foreground">
                  {col.header}
                </div>
                {col.subheader && (
                  <div className="text-[10px] font-normal text-muted-foreground mt-0.5">
                    {col.subheader}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row: any) => {
            const isBold = row.isTotal || row.isSummary;
            const values = (row.values as (number | null)[]) ?? [];

            // Blank separator rows
            if (row.isBlank) {
              return (
                <tr key={row.id}>
                  <td
                    colSpan={columns.length + 1}
                    className="h-4"
                  />
                </tr>
              );
            }

            return (
              <tr
                key={row.id}
                className={`border-b last:border-0 ${
                  row.isSummary
                    ? "bg-primary/5"
                    : row.isTotal
                      ? "bg-muted/20"
                      : ""
                }`}
              >
                {/* Label cell */}
                <td
                  className={`sticky left-0 z-10 py-1.5 pr-2 ${
                    row.isSummary
                      ? "bg-primary/5"
                      : row.isTotal
                        ? "bg-muted/20"
                        : "bg-card"
                  } ${depthClass(row.depth)} ${
                    isBold ? "font-semibold" : ""
                  }`}
                  onDoubleClick={() => handleLabelDoubleClick(row)}
                >
                  {editingCell?.rowId === row.id &&
                  editingCell?.type === "label" ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSave(row)}
                      onKeyDown={(e) => handleKeyDown(e, row)}
                      className="w-full rounded border bg-background px-1 py-0.5 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span className="flex items-center gap-1 text-foreground">
                      {row.label}
                      {row.notes && (
                        <span className="group relative inline-flex">
                          <Info className="h-3 w-3 text-blue-400 shrink-0" />
                          <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20 max-w-xs rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md border whitespace-pre-wrap">
                            {row.notes}
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                </td>

                {/* Value cells */}
                {columns.map((_, colIdx) => {
                  const val = values[colIdx] ?? null;
                  const isNegative = val !== null && val < 0;
                  const isEditing =
                    editingCell?.rowId === row.id &&
                    editingCell?.type === "value" &&
                    editingCell?.columnIndex === colIdx;

                  return (
                    <td
                      key={colIdx}
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        isBold ? "font-semibold" : ""
                      } ${
                        isNegative
                          ? "text-red-600 dark:text-red-400"
                          : ""
                      }`}
                      onDoubleClick={() => handleCellDoubleClick(row, colIdx)}
                    >
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSave(row)}
                          onKeyDown={(e) => handleKeyDown(e, row)}
                          className="w-full rounded border bg-background px-1 py-0.5 text-right text-sm"
                          autoFocus
                        />
                      ) : (
                        formatValue(val)
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
