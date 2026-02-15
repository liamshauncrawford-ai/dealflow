"use client";

import { Plus, Sparkles } from "lucide-react";

interface DataEntryToolbarProps {
  onAddPeriod: () => void;
  onExtractFromDocument?: () => void;
  viewMode: "ebitda" | "sde";
  onViewModeChange: (mode: "ebitda" | "sde") => void;
  hasPeriods: boolean;
  hasDocuments?: boolean;
}

export function DataEntryToolbar({
  onAddPeriod,
  onExtractFromDocument,
  viewMode,
  onViewModeChange,
  hasPeriods,
  hasDocuments,
}: DataEntryToolbarProps) {
  return (
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
  );
}
