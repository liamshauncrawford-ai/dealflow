"use client";

import { Trash2 } from "lucide-react";
import {
  useHistoricFinancials,
  useUploadHistoricPnl,
  useDeleteHistoricPnl,
} from "@/hooks/use-historic-financials";
import { ErrorBoundary } from "@/components/error-boundary";
import { HistoricPnlUpload } from "@/components/financials/historic-pnl-upload";
import { HistoricPnlTable } from "@/components/financials/historic-pnl-table";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface HistoricFinancialsTabContentProps {
  opportunityId: string;
}

export function HistoricFinancialsTabContent({
  opportunityId,
}: HistoricFinancialsTabContentProps) {
  const { data: historicPnLs = [], isLoading } =
    useHistoricFinancials(opportunityId);
  const uploadPnl = useUploadHistoricPnl(opportunityId);
  const deletePnl = useDeleteHistoricPnl(opportunityId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  const hasData = historicPnLs.length > 0;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      {hasData && (
        <div className="flex items-center justify-between">
          <HistoricPnlUpload
            onFileSelected={(file) => uploadPnl.mutate(file)}
            isUploading={uploadPnl.isPending}
            compact
          />
          <p className="text-xs text-muted-foreground">
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

      {/* P&L tables */}
      {historicPnLs.map((pnl: any) => (
        <ErrorBoundary key={pnl.id}>
          <div className="space-y-3">
            {/* P&L header */}
            <div className="flex items-start justify-between">
              <div>
                {pnl.companyName && (
                  <h3 className="text-sm font-semibold text-foreground">
                    {pnl.companyName}
                  </h3>
                )}
                {pnl.title && (
                  <p className="text-sm text-muted-foreground">{pnl.title}</p>
                )}
                {pnl.basis && (
                  <p className="text-xs text-muted-foreground/70">
                    {pnl.basis}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {pnl.sourceFileName && (
                  <span className="text-xs text-muted-foreground/50">
                    {pnl.sourceFileName}
                  </span>
                )}
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this historic P&L? This cannot be undone.",
                      )
                    ) {
                      deletePnl.mutate(pnl.id);
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

            {/* The table */}
            <HistoricPnlTable pnl={pnl} opportunityId={opportunityId} />
          </div>
        </ErrorBoundary>
      ))}
    </div>
  );
}
