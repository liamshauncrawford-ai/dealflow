"use client";

import { Fragment, useState } from "react";
import { Lock, Unlock, Trash2, ChevronRight, Pencil, X } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  useUpdateFinancialPeriod,
  useDeleteFinancialPeriod,
  useUpdateLineItem,
  useUpdateTotalAddBacks,
  useUpdateOverride,
} from "@/hooks/use-financials";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface FinancialPeriodsTableProps {
  periods: any[];
  viewMode: "ebitda" | "sde";
  opportunityId: string;
  selectedPeriodId?: string;
  onSelectPeriod: (id: string) => void;
}

const ROW_CONFIG = [
  { key: "totalRevenue", label: "Revenue", bold: true, category: "REVENUE" },
  { key: "totalCogs", label: "Cost of Goods Sold", indent: false, category: "COGS" },
  { key: "grossProfit", label: "Gross Profit", bold: true, computed: true },
  { key: "grossMargin", label: "Gross Margin", format: "percent", computed: true },
  { key: "divider1", divider: true },
  { key: "totalOpex", label: "Operating Expenses", category: "OPEX" },
  { key: "ebitda", label: "EBITDA", bold: true, computed: true },
  { key: "ebitdaMargin", label: "EBITDA Margin", format: "percent", computed: true },
  { key: "divider2", divider: true },
  { key: "depreciationAmort", label: "Depreciation & Amort.", category: "D_AND_A" },
  { key: "ebit", label: "EBIT", bold: true, computed: true },
  { key: "interestExpense", label: "Interest Expense", category: "INTEREST" },
  { key: "taxExpense", label: "Tax Expense", category: "TAX" },
  { key: "netIncome", label: "Net Income", bold: true, computed: true },
  { key: "netMargin", label: "Net Margin", format: "percent", computed: true },
  { key: "divider3", divider: true },
  { key: "totalAddBacks", label: "Total Add-Backs", bold: true, highlight: true },
  { key: "adjustedEbitda", label: "Adj. EBITDA", bold: true, highlight: true, computed: true },
  { key: "adjustedEbitdaMargin", label: "Adj. EBITDA Margin", format: "percent", highlight: true },
  { key: "sde", label: "SDE", bold: true, highlight: true },
] as const;

// Maps row keys to their override field names in the database.
// Computed rows with an override mapping can be double-click edited.
const OVERRIDE_MAP: Record<string, string> = {
  totalRevenue: "overrideTotalRevenue",
  totalCogs: "overrideTotalCogs",
  grossProfit: "overrideGrossProfit",
  totalOpex: "overrideTotalOpex",
  ebitda: "overrideEbitda",
  adjustedEbitda: "overrideAdjustedEbitda",
  ebit: "overrideEbit",
  netIncome: "overrideNetIncome",
};

function formatValue(val: any, format?: string): string {
  if (val == null) return "—";
  const num = Number(val);
  if (isNaN(num)) return "—";
  if (format === "percent") return formatPercent(num);
  return formatCurrency(num);
}

function periodLabel(period: any): string {
  if (period.label) return period.label;
  const q = period.quarter ? ` Q${period.quarter}` : "";
  return `${period.periodType}${q} ${period.year}`;
}

/** Check if a period has an active override for a given row key */
function hasOverride(period: any, rowKey: string): boolean {
  const overrideField = OVERRIDE_MAP[rowKey];
  if (!overrideField) return false;
  return period[overrideField] != null;
}

export function FinancialPeriodsTable({
  periods,
  viewMode,
  opportunityId,
  selectedPeriodId,
  onSelectPeriod,
}: FinancialPeriodsTableProps) {
  const updatePeriod = useUpdateFinancialPeriod(opportunityId);
  const deletePeriod = useDeleteFinancialPeriod(opportunityId);
  const updateLineItem = useUpdateLineItem(opportunityId);
  const updateTotalAddBacks = useUpdateTotalAddBacks(opportunityId);
  const updateOverride = useUpdateOverride(opportunityId);
  const [editingCell, setEditingCell] = useState<{ periodId: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingPeriodHeader, setEditingPeriodHeader] = useState<string | null>(null);
  const [headerYear, setHeaderYear] = useState<number>(0);
  const [headerPeriodType, setHeaderPeriodType] = useState<string>("");
  const [headerQuarter, setHeaderQuarter] = useState<number | null>(null);

  // Sort periods by year desc
  const sorted = [...periods].sort((a, b) => b.year - a.year || a.periodType.localeCompare(b.periodType));

  // Compute YoY growth for each period
  function getYoYGrowth(current: any, field: string): number | null {
    const idx = sorted.indexOf(current);
    if (idx >= sorted.length - 1) return null;
    const prev = sorted[idx + 1];
    const curVal = Number(current[field] ?? 0);
    const prevVal = Number(prev[field] ?? 0);
    if (prevVal === 0) return null;
    return (curVal - prevVal) / Math.abs(prevVal);
  }

  // Find the line item for inline editing by category
  function findLineItemForCategory(period: any, category: string): any {
    return period.lineItems?.find((li: any) => li.category === category);
  }

  function handleCellDoubleClick(period: any, row: typeof ROW_CONFIG[number]) {
    if ("divider" in row || period.isLocked) return;

    // Percent rows (margins) are always computed-only, not editable
    if ("format" in row && row.format === "percent") return;

    // Special case: totalAddBacks is editable as a single number
    if (row.key === "totalAddBacks") {
      setEditingCell({ periodId: period.id, key: row.key as string });
      setEditValue(String(Number(period.totalAddBacks ?? 0)));
      return;
    }

    // Overridable computed rows: allow editing via override
    const overrideField = OVERRIDE_MAP[row.key as string];
    if (overrideField && ("computed" in row || "category" in row)) {
      setEditingCell({ periodId: period.id, key: row.key as string });
      setEditValue(String(Number(period[row.key as string] ?? 0)));
      return;
    }

    // Regular line-item rows (category-backed)
    if (!("category" in row) || !row.category) return;
    // Skip if this row also has an override mapping and was already handled above
    if (overrideField) return;

    const lineItem = findLineItemForCategory(period, row.category);
    if (!lineItem) return;

    setEditingCell({ periodId: period.id, key: row.key as string });
    setEditValue(String(Number(lineItem.amount)));
  }

  function handleCellSave(period: any, row: typeof ROW_CONFIG[number]) {
    // Special case: totalAddBacks sets the total via dedicated endpoint
    if (row.key === "totalAddBacks") {
      const newTotal = parseFloat(editValue);
      if (!isNaN(newTotal) && newTotal !== Number(period.totalAddBacks ?? 0)) {
        updateTotalAddBacks.mutate({ periodId: period.id, total: newTotal });
      }
      setEditingCell(null);
      return;
    }

    // Override-backed rows (computed fields + category rows with override mapping)
    const overrideField = OVERRIDE_MAP[row.key as string];
    if (overrideField) {
      const newVal = parseFloat(editValue);
      if (!isNaN(newVal) && newVal !== Number(period[row.key as string] ?? 0)) {
        updateOverride.mutate({
          periodId: period.id,
          field: overrideField,
          value: newVal,
        });
      }
      setEditingCell(null);
      return;
    }

    // Regular line-item rows
    if (!("category" in row) || !row.category) return;
    const lineItem = findLineItemForCategory(period, row.category);
    if (!lineItem) return;

    const newAmount = parseFloat(editValue);
    if (!isNaN(newAmount) && newAmount !== Number(lineItem.amount)) {
      updateLineItem.mutate({
        periodId: period.id,
        itemId: lineItem.id,
        data: { amount: newAmount },
      });
    }
    setEditingCell(null);
  }

  function handleClearOverride(e: React.MouseEvent, period: any, rowKey: string) {
    e.stopPropagation();
    const overrideField = OVERRIDE_MAP[rowKey];
    if (!overrideField) return;
    updateOverride.mutate({
      periodId: period.id,
      field: overrideField,
      value: null,
    });
  }

  function startEditingPeriodHeader(period: any) {
    setEditingPeriodHeader(period.id);
    setHeaderYear(period.year);
    setHeaderPeriodType(period.periodType);
    setHeaderQuarter(period.quarter ?? null);
  }

  function savePeriodHeader(period: any) {
    const changes: Record<string, unknown> = {};
    if (headerYear !== period.year) changes.year = headerYear;
    if (headerPeriodType !== period.periodType) changes.periodType = headerPeriodType;
    if (headerQuarter !== (period.quarter ?? null)) changes.quarter = headerQuarter;

    if (Object.keys(changes).length > 0) {
      updatePeriod.mutate({ periodId: period.id, data: changes });
    }
    setEditingPeriodHeader(null);
  }

  const filteredRows = ROW_CONFIG.filter((row) => {
    if (viewMode === "ebitda" && row.key === "sde") return false;
    if (viewMode === "sde" && (row.key === "adjustedEbitda" || row.key === "adjustedEbitdaMargin")) return false;
    return true;
  });

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/50 px-4 py-2 text-left font-medium text-muted-foreground w-48">
              P&L Line Item
            </th>
            {sorted.map((period, idx) => (
              <Fragment key={period.id}>
                <th className="min-w-[120px] px-3 py-2 text-right">
                  {editingPeriodHeader === period.id ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <select
                          value={headerPeriodType}
                          onChange={(e) => setHeaderPeriodType(e.target.value)}
                          className="rounded border bg-background px-1 py-0.5 text-xs"
                        >
                          <option value="ANNUAL">Annual</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="LTM">LTM</option>
                          <option value="YTD">YTD</option>
                          <option value="PROJECTED">Projected</option>
                        </select>
                        <input
                          type="number"
                          value={headerYear}
                          onChange={(e) => setHeaderYear(parseInt(e.target.value) || 0)}
                          className="w-16 rounded border bg-background px-1 py-0.5 text-right text-xs"
                          min={1990}
                          max={2100}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") savePeriodHeader(period);
                            if (e.key === "Escape") setEditingPeriodHeader(null);
                          }}
                        />
                      </div>
                      {headerPeriodType === "QUARTERLY" && (
                        <select
                          value={headerQuarter ?? ""}
                          onChange={(e) => setHeaderQuarter(e.target.value ? parseInt(e.target.value) : null)}
                          className="rounded border bg-background px-1 py-0.5 text-xs"
                        >
                          <option value="">No quarter</option>
                          <option value="1">Q1</option>
                          <option value="2">Q2</option>
                          <option value="3">Q3</option>
                          <option value="4">Q4</option>
                        </select>
                      )}
                      <div className="flex gap-1">
                        <button
                          onClick={() => savePeriodHeader(period)}
                          className="rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground hover:bg-primary/90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPeriodHeader(null)}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-muted/80"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectPeriod(period.id)}
                          className={`text-xs font-medium hover:underline ${
                            selectedPeriodId === period.id ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {periodLabel(period)}
                        </button>
                        {selectedPeriodId === period.id && (
                          <ChevronRight className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-end gap-1">
                        {!period.isLocked && (
                          <button
                            onClick={() => startEditingPeriodHeader(period)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Edit period year/type"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            updatePeriod.mutate({
                              periodId: period.id,
                              data: { isLocked: !period.isLocked },
                            })
                          }
                          className="text-muted-foreground hover:text-foreground"
                          title={period.isLocked ? "Unlock period" : "Lock period"}
                        >
                          {period.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        </button>
                        {!period.isLocked && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${periodLabel(period)}?`)) {
                                deletePeriod.mutate(period.id);
                              }
                            }}
                            className="text-muted-foreground hover:text-destructive"
                            title="Delete period"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </th>
                {idx < sorted.length - 1 && (
                  <th className="min-w-[60px] px-2 py-2 text-right text-xs text-muted-foreground">
                    YoY
                  </th>
                )}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => {
            // Total columns = 1 (label) + sorted.length (values) + max(sorted.length - 1, 0) (YoY gaps)
            const totalCols = 1 + sorted.length + Math.max(sorted.length - 1, 0);

            if ("divider" in row && row.divider) {
              return (
                <tr key={row.key}>
                  <td colSpan={totalCols} className="h-px bg-border" />
                </tr>
              );
            }

            const isBold = "bold" in row && row.bold;
            const isHighlight = "highlight" in row && row.highlight;
            const format = "format" in row ? row.format : undefined;

            return (
              <tr
                key={row.key}
                className={`border-b last:border-0 ${
                  isHighlight ? "bg-primary/5" : ""
                }`}
              >
                <td
                  className={`sticky left-0 z-10 px-4 py-1.5 ${
                    isHighlight ? "bg-primary/5" : "bg-card"
                  } ${isBold ? "font-semibold" : ""}`}
                >
                  {"label" in row ? row.label : ""}
                </td>
                {sorted.map((period, idx) => {
                  const isEditing =
                    editingCell?.periodId === period.id && editingCell?.key === row.key;
                  const val = period[row.key as string];
                  const negative = val != null && Number(val) < 0;
                  const isOverridden = hasOverride(period, row.key as string);

                  return (
                    <Fragment key={period.id}>
                      <td
                        className={`px-3 py-1.5 text-right tabular-nums ${
                          isBold ? "font-semibold" : ""
                        } ${negative ? "text-red-600 dark:text-red-400" : ""} ${
                          isOverridden ? "bg-amber-50 dark:bg-amber-900/10" : ""
                        }`}
                        onDoubleClick={() => handleCellDoubleClick(period, row)}
                      >
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleCellSave(period, row)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCellSave(period, row);
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            className="w-full rounded border bg-background px-1 py-0.5 text-right text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1 justify-end">
                            {formatValue(val, format)}
                            {isOverridden && (
                              <>
                                <Pencil className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                <button
                                  onClick={(e) => handleClearOverride(e, period, row.key as string)}
                                  className="text-muted-foreground/50 hover:text-red-500 shrink-0"
                                  title="Clear override (revert to computed)"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </>
                            )}
                          </span>
                        )}
                      </td>
                      {idx < sorted.length - 1 && (
                        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                          {format !== "percent" ? (() => {
                            const growth = getYoYGrowth(period, row.key as string);
                            if (growth === null) return "—";
                            const positive = growth >= 0;
                            return (
                              <span className={positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                                {positive ? "+" : ""}{(growth * 100).toFixed(1)}%
                              </span>
                            );
                          })() : ""}
                        </td>
                      )}
                    </Fragment>
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
