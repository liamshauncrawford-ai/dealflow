"use client";

import { useState } from "react";
import { Trash2, FileSpreadsheet } from "lucide-react";
import { SheetTabBar } from "@/components/financials/sheet-tab-bar";
import { HistoricPnlTable } from "@/components/financials/historic-pnl-table";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface WorkbookCardProps {
  /** All P&Ls belonging to this workbook group */
  pnls: any[];
  /** The shared source file name */
  fileName: string;
  opportunityId: string;
  onDelete: () => void;
  isDeleting: boolean;
}

export function WorkbookCard({
  pnls,
  fileName,
  opportunityId,
  onDelete,
  isDeleting,
}: WorkbookCardProps) {
  const [activeSheetId, setActiveSheetId] = useState(pnls[0]?.id ?? "");

  const activePnl = pnls.find((p: any) => p.id === activeSheetId) ?? pnls[0];
  const hasMultipleSheets = pnls.length > 1;

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* File header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground truncate">
            {fileName}
          </span>
          <span className="text-xs text-muted-foreground">
            ({pnls.length} {pnls.length === 1 ? "sheet" : "sheets"})
          </span>
        </div>
        <button
          onClick={() => {
            const msg = hasMultipleSheets
              ? `Delete all ${pnls.length} sheets from "${fileName}"? This cannot be undone.`
              : `Delete this P&L from "${fileName}"? This cannot be undone.`;
            if (confirm(msg)) {
              onDelete();
            }
          }}
          disabled={isDeleting}
          className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          title="Delete workbook"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Sheet tabs (only if multi-sheet) */}
      {hasMultipleSheets && (
        <div className="border-b px-4 py-2">
          <SheetTabBar
            sheets={pnls.map((p: any) => ({
              id: p.id,
              title: p.title,
            }))}
            activeSheetId={activeSheetId}
            onSheetChange={setActiveSheetId}
          />
        </div>
      )}

      {/* Active sheet metadata */}
      {activePnl && (
        <div className="px-4 pt-3 pb-1 space-y-0.5">
          {activePnl.companyName && (
            <h3 className="text-sm font-semibold text-foreground">
              {activePnl.companyName}
            </h3>
          )}
          {!hasMultipleSheets && activePnl.title && (
            <p className="text-sm text-muted-foreground">{activePnl.title}</p>
          )}
          {activePnl.basis && (
            <p className="text-xs text-muted-foreground/70">
              {activePnl.basis}
            </p>
          )}
        </div>
      )}

      {/* P&L table for active sheet */}
      {activePnl && (
        <div className="p-4 pt-2">
          <HistoricPnlTable pnl={activePnl} opportunityId={opportunityId} />
        </div>
      )}
    </div>
  );
}
