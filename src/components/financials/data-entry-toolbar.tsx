"use client";

import { useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";

interface DataEntryToolbarProps {
  onAddPeriod: () => void;
  onExtractFromDocument?: () => void;
  onClearAll?: () => void;
  isClearingAll?: boolean;
  viewMode: "ebitda" | "sde";
  onViewModeChange: (mode: "ebitda" | "sde") => void;
  hasPeriods: boolean;
  hasDocuments?: boolean;
  periodCount?: number;
}

export function DataEntryToolbar({
  onAddPeriod,
  onExtractFromDocument,
  onClearAll,
  isClearingAll,
  viewMode,
  onViewModeChange,
  hasPeriods,
  hasDocuments,
  periodCount = 0,
}: DataEntryToolbarProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onAddPeriod}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Period
        </button>

        {hasDocuments && onExtractFromDocument && (
          <button
            onClick={onExtractFromDocument}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Extract from Document
          </button>
        )}

        {hasPeriods && onClearAll && (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isClearingAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isClearingAll ? "Clearing…" : "Clear All"}
          </button>
        )}

        {hasPeriods && (
          <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
            <button
              onClick={() => onViewModeChange("ebitda")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "ebitda"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EBITDA
            </button>
            <button
              onClick={() => onViewModeChange("sde")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "sde"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SDE
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Clear All Financial Data?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {periodCount} financial period{periodCount !== 1 ? "s" : ""}
              </span>{" "}
              including all line items and add-backs. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  onClearAll?.();
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Clear All Periods
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
