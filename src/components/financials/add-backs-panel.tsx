"use client";

import { useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAddAddBack, useUpdateAddBack, useDeleteAddBack } from "@/hooks/use-financials";
import { ADD_BACK_CATEGORY_LABELS } from "@/lib/financial/canonical-labels";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface AddBacksPanelProps {
  opportunityId: string;
  period: any;
  viewMode: "ebitda" | "sde";
}

const ADD_BACK_CATEGORIES = Object.entries(ADD_BACK_CATEGORY_LABELS);

export function AddBacksPanel({ opportunityId, period, viewMode }: AddBacksPanelProps) {
  const addAddBack = useAddAddBack(opportunityId);
  const updateAddBack = useUpdateAddBack(opportunityId);
  const deleteAddBack = useDeleteAddBack(opportunityId);

  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState("OWNER_COMPENSATION");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const addBacks: any[] = period.addBacks ?? [];
  const ebitda = Number(period.ebitda ?? 0);
  const primaryLabel = viewMode === "sde" ? "SDE" : "Adj. EBITDA";
  const primaryValue = viewMode === "sde" ? Number(period.sde ?? 0) : Number(period.adjustedEbitda ?? 0);

  async function handleAdd() {
    if (!newDescription || !newAmount) return;
    await addAddBack.mutateAsync({
      periodId: period.id,
      data: {
        category: newCategory,
        description: newDescription,
        amount: parseFloat(newAmount),
      },
    });
    setNewDescription("");
    setNewAmount("");
    setShowAdd(false);
  }

  function toggleInclude(ab: any, field: "includeInSde" | "includeInEbitda") {
    updateAddBack.mutate({
      periodId: period.id,
      addBackId: ab.id,
      data: { [field]: !ab[field] },
    });
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold text-sm">Add-Backs</h3>
        {!period.isLocked && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      <div className="p-4">
        {/* Waterfall visualization */}
        <div className="mb-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">EBITDA</span>
            <span className="tabular-nums">{formatCurrency(ebitda)}</span>
          </div>
          {addBacks.map((ab: any) => {
            const included = viewMode === "sde" ? ab.includeInSde : ab.includeInEbitda;
            if (!included) return null;
            return (
              <div key={ab.id} className="flex justify-between text-sm">
                <span className="text-emerald-600 dark:text-emerald-400">
                  + {ab.description}
                </span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(Number(ab.amount))}
                </span>
              </div>
            );
          })}
          <div className="border-t pt-1.5">
            <div className="flex justify-between text-sm font-semibold">
              <span>{primaryLabel}</span>
              <span className="tabular-nums">{formatCurrency(primaryValue)}</span>
            </div>
          </div>
        </div>

        {/* Add-backs list */}
        {addBacks.length > 0 ? (
          <div className="space-y-2">
            {addBacks.map((ab: any) => (
              <div
                key={ab.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                      {ADD_BACK_CATEGORY_LABELS[ab.category as keyof typeof ADD_BACK_CATEGORY_LABELS] ?? ab.category}
                    </span>
                    <span className="truncate">{ab.description}</span>
                  </div>
                </div>
                <span className="tabular-nums font-medium whitespace-nowrap">
                  {formatCurrency(Number(ab.amount))}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleInclude(ab, viewMode === "sde" ? "includeInSde" : "includeInEbitda")}
                    className={`rounded p-1 ${
                      (viewMode === "sde" ? ab.includeInSde : ab.includeInEbitda)
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                    title={`Toggle include in ${primaryLabel}`}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  {!period.isLocked && (
                    <button
                      onClick={() =>
                        deleteAddBack.mutate({
                          periodId: period.id,
                          addBackId: ab.id,
                        })
                      }
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No add-backs for this period.</p>
        )}

        {/* Inline add form */}
        {showAdd && (
          <div className="mt-3 space-y-2 rounded-md border border-dashed p-3">
            <div className="flex gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-40 rounded border bg-background px-2 py-1 text-xs"
              >
                {ADD_BACK_CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description"
                className="flex-1 rounded border bg-background px-2 py-1 text-sm"
              />
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="$"
                className="w-24 rounded border bg-background px-2 py-1 text-right text-sm"
              />
            </div>
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                onClick={handleAdd}
                disabled={addAddBack.isPending || !newDescription || !newAmount}
                className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
