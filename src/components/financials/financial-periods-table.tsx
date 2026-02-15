"use client";

import { useState } from "react";
import { Lock, Unlock, Trash2, ChevronRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useUpdateFinancialPeriod, useDeleteFinancialPeriod, useUpdateLineItem } from "@/hooks/use-financials";
import { CATEGORY_LABELS } from "@/lib/financial/canonical-labels";

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
  { key: "adjustedEbitda", label: "Adj. EBITDA", bold: true, highlight: true },
  { key: "adjustedEbitdaMargin", label: "Adj. EBITDA Margin", format: "percent", highlight: true },
  { key: "sde", label: "SDE", bold: true, highlight: true },
] as const;

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
  const [editingCell, setEditingCell] = useState<{ periodId: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");

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
    if ("divider" in row || "computed" in row || period.isLocked) return;
    if (!("category" in row) || !row.category) return;

    const lineItem = findLineItemForCategory(period, row.category);
    if (!lineItem) return;

    setEditingCell({ periodId: period.id, key: row.key as string });
    setEditValue(String(Number(lineItem.amount)));
  }

  function handleCellSave(period: any, row: typeof ROW_CONFIG[number]) {
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
            {sorted.map((period) => (
              <th key={period.id} className="min-w-[120px] px-3 py-2 text-right">
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
              </th>
            ))}
            {sorted.length > 1 && (
              <th className="min-w-[80px] px-3 py-2 text-right text-xs text-muted-foreground">
                YoY
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => {
            if ("divider" in row && row.divider) {
              return (
                <tr key={row.key}>
                  <td colSpan={sorted.length + (sorted.length > 1 ? 2 : 1)} className="h-px bg-border" />
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
                {sorted.map((period) => {
                  const isEditing =
                    editingCell?.periodId === period.id && editingCell?.key === row.key;
                  const val = period[row.key as string];
                  const negative = val != null && Number(val) < 0;

                  return (
                    <td
                      key={period.id}
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        isBold ? "font-semibold" : ""
                      } ${negative ? "text-red-600 dark:text-red-400" : ""}`}
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
                        formatValue(val, format)
                      )}
                    </td>
                  );
                })}
                {sorted.length > 1 && (
                  <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                    {format !== "percent" && !("divider" in row) ? (() => {
                      const growth = getYoYGrowth(sorted[0], row.key as string);
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
