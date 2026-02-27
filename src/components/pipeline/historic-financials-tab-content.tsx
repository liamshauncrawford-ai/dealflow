"use client";

import { Trash2, ArrowRightLeft, Loader2 } from "lucide-react";
import {
  useHistoricFinancials,
  useUploadHistoricPnl,
  useDeleteHistoricPnl,
  useDeleteHistoricWorkbookGroup,
  useConvertHistoricToFinancials,
} from "@/hooks/use-historic-financials";
import { ErrorBoundary } from "@/components/error-boundary";
import { HistoricPnlUpload } from "@/components/financials/historic-pnl-upload";
import { WorkbookCard } from "@/components/financials/workbook-card";
import { HistoricPnlTable } from "@/components/financials/historic-pnl-table";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface HistoricFinancialsTabContentProps {
  opportunityId: string;
}

/**
 * Groups P&Ls by workbookGroup. Ungrouped P&Ls (workbookGroup = null)
 * are each treated as standalone entries.
 */
function groupByWorkbook(pnls: any[]): Array<{
  key: string;
  workbookGroup: string | null;
  fileName: string;
  pnls: any[];
}> {
  const groups = new Map<
    string,
    { workbookGroup: string | null; fileName: string; pnls: any[] }
  >();

  for (const pnl of pnls) {
    const groupKey = pnl.workbookGroup || `standalone-${pnl.id}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        workbookGroup: pnl.workbookGroup,
        fileName: pnl.sourceFileName || "Untitled",
        pnls: [],
      });
    }

    groups.get(groupKey)!.pnls.push(pnl);
  }

  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    ...group,
  }));
}

export function HistoricFinancialsTabContent({
  opportunityId,
}: HistoricFinancialsTabContentProps) {
  const { data: historicPnLs = [], isLoading } =
    useHistoricFinancials(opportunityId);
  const uploadPnl = useUploadHistoricPnl(opportunityId);
  const deletePnl = useDeleteHistoricPnl(opportunityId);
  const deleteWorkbook = useDeleteHistoricWorkbookGroup(opportunityId);
  const convertFinancials = useConvertHistoricToFinancials(opportunityId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  const hasData = historicPnLs.length > 0;
  const workbookGroups = groupByWorkbook(historicPnLs);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      {hasData && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <HistoricPnlUpload
              onFileSelected={(file) => uploadPnl.mutate(file)}
              isUploading={uploadPnl.isPending}
              compact
            />
            <button
              onClick={() => {
                if (
                  confirm(
                    "This will replace all existing Financial Overview data with values extracted from this P&L. Continue?",
                  )
                ) {
                  convertFinancials.mutate({ replaceExisting: true });
                }
              }}
              disabled={convertFinancials.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
              title="Create Financial Overview periods from this P&L data (no AI needed)"
            >
              {convertFinancials.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              {convertFinancials.isPending
                ? "Converting…"
                : "Populate Financial Overview"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground shrink-0">
            Double-click any cell to edit
          </p>
        </div>
      )}

      {/* Empty state: full-width dropzone */}
      {!hasData && (
        <HistoricPnlUpload
          onFileSelected={(file) => uploadPnl.mutate(file)}
          isUploading={uploadPnl.isPending}
        />
      )}

      {/* Workbook groups + standalone P&Ls */}
      {workbookGroups.map((group) => (
        <ErrorBoundary key={group.key}>
          {group.workbookGroup ? (
            /* Multi-sheet workbook — render WorkbookCard with sub-tabs */
            <WorkbookCard
              pnls={group.pnls}
              fileName={group.fileName}
              opportunityId={opportunityId}
              onDelete={() => deleteWorkbook.mutate(group.workbookGroup!)}
              isDeleting={deleteWorkbook.isPending}
            />
          ) : (
            /* Standalone P&L (no workbookGroup) — backward compatible */
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  {group.pnls[0]?.companyName && (
                    <h3 className="text-sm font-semibold text-foreground">
                      {group.pnls[0].companyName}
                    </h3>
                  )}
                  {group.pnls[0]?.title && (
                    <p className="text-sm text-muted-foreground">
                      {group.pnls[0].title}
                    </p>
                  )}
                  {group.pnls[0]?.basis && (
                    <p className="text-xs text-muted-foreground/70">
                      {group.pnls[0].basis}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {group.pnls[0]?.sourceFileName && (
                    <span className="text-xs text-muted-foreground/50">
                      {group.pnls[0].sourceFileName}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "Delete this historic P&L? This cannot be undone.",
                        )
                      ) {
                        deletePnl.mutate(group.pnls[0].id);
                      }
                    }}
                    disabled={deletePnl.isPending}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    title="Delete this P&L"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <HistoricPnlTable
                pnl={group.pnls[0]}
                opportunityId={opportunityId}
              />
            </div>
          )}
        </ErrorBoundary>
      ))}
    </div>
  );
}
