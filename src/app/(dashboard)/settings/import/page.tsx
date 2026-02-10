"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderOpen,
  FileSpreadsheet,
  FileText,
  FileCheck,
  FileWarning,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useImportPreview, useImportDeals } from "@/hooks/use-import";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Stage display config
// ─────────────────────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  CONTACTING: { label: "Contacting", color: "bg-gray-100 text-gray-700" },
  REQUESTED_CIM: { label: "CIM Requested", color: "bg-indigo-100 text-indigo-700" },
  SIGNED_NDA: { label: "NDA Signed", color: "bg-purple-100 text-purple-700" },
  DUE_DILIGENCE: { label: "Due Diligence", color: "bg-amber-100 text-amber-700" },
  OFFER_SENT: { label: "Offer Sent", color: "bg-orange-100 text-orange-700" },
};

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  CIM: FileText,
  FINANCIAL_MODEL: FileSpreadsheet,
  FINANCIAL_STATEMENT: FileSpreadsheet,
  TAX_RETURN: FileCheck,
  LOI: FileWarning,
  NDA: FileCheck,
  VALUATION: FileSpreadsheet,
  OTHER: FileText,
};

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function ImportSettingsPage() {
  const { data: preview, isLoading, error, refetch } = useImportPreview();
  const importDeals = useImportDeals();
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    details: Array<{
      folderName: string;
      status: string;
      reason?: string;
      financialSource?: string;
      stage?: string;
    }>;
  } | null>(null);

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (!preview) return;
    if (selectedDeals.size === preview.deals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(preview.deals.map((d) => d.folderName)));
    }
  };

  const toggleDeal = (name: string) => {
    const next = new Set(selectedDeals);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setSelectedDeals(next);
  };

  const handleImport = async () => {
    const folderNames = selectedDeals.size > 0
      ? Array.from(selectedDeals)
      : undefined;

    try {
      const result = await importDeals.mutateAsync({
        folderNames,
        skipExisting: true,
        runDedup: true,
      });
      setImportResult(result);
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/settings" className="hover:text-foreground">Settings</Link>
        <span>/</span>
        <span className="font-medium text-foreground">Historical Deal Import</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Historical Deal Import
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import deal data from your iCloud Drive Acquisition Targets folder
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">
            Scanning deal folders...
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">
                Failed to scan deal folders
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
            <div className="flex-1">
              <h3 className="font-semibold">Import Complete</h3>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-green-600">
                  {importResult.imported} imported
                </span>
                <span className="text-muted-foreground">
                  {importResult.skipped} skipped
                </span>
                {importResult.errors.length > 0 && (
                  <span className="text-destructive">
                    {importResult.errors.length} errors
                  </span>
                )}
              </div>

              {/* Detail rows */}
              <div className="mt-3 space-y-1">
                {importResult.details.map((d) => (
                  <div
                    key={d.folderName}
                    className="flex items-center gap-2 text-sm"
                  >
                    {d.status === "imported" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : d.status === "skipped" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className="font-medium">{d.folderName}</span>
                    {d.stage && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          STAGE_CONFIG[d.stage]?.color || "bg-gray-100"
                        )}
                      >
                        {STAGE_CONFIG[d.stage]?.label || d.stage}
                      </span>
                    )}
                    {d.financialSource && d.financialSource !== "none" && (
                      <span className="text-xs text-muted-foreground">
                        ({d.financialSource} financials)
                      </span>
                    )}
                    {d.reason && (
                      <span className="text-xs text-muted-foreground">
                        — {d.reason}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-3">
                <Link
                  href="/pipeline"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View Pipeline
                </Link>
                <button
                  onClick={() => {
                    setImportResult(null);
                    refetch();
                  }}
                  className="text-sm font-medium text-muted-foreground hover:underline"
                >
                  Import More
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && !importResult && (
        <>
          {/* Summary */}
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Folder Scan Results</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Found{" "}
                  <span className="font-medium text-foreground">
                    {preview.totalDeals} deal folders
                  </span>{" "}
                  with{" "}
                  <span className="font-medium text-foreground">
                    {preview.totalFiles} documents
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {selectedDeals.size === preview.deals.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
                <button
                  onClick={handleImport}
                  disabled={importDeals.isPending}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium text-white",
                    importDeals.isPending
                      ? "cursor-not-allowed bg-primary/60"
                      : "bg-primary hover:bg-primary/90"
                  )}
                >
                  {importDeals.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {importDeals.isPending
                    ? "Importing..."
                    : selectedDeals.size > 0
                    ? `Import ${selectedDeals.size} Deals`
                    : `Import All ${preview.totalDeals} Deals`}
                </button>
              </div>
            </div>

            {preview.skippedFolders.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Skipped folders: {preview.skippedFolders.join(", ")}
              </p>
            )}
          </div>

          {/* Error from mutation */}
          {importDeals.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
                <p className="text-sm text-destructive">
                  {importDeals.error?.message || "Import failed"}
                </p>
              </div>
            </div>
          )}

          {/* Deal list */}
          <div className="space-y-2">
            {preview.deals.map((deal) => {
              const isExpanded = expandedDeal === deal.folderName;
              const isSelected = selectedDeals.has(deal.folderName);
              const stageInfo = STAGE_CONFIG[deal.detectedStage] || {
                label: deal.detectedStage,
                color: "bg-gray-100 text-gray-700",
              };

              return (
                <div
                  key={deal.folderName}
                  className={cn(
                    "rounded-lg border bg-card shadow-sm transition-all",
                    isSelected && "border-primary/40 bg-primary/5"
                  )}
                >
                  {/* Deal header */}
                  <div className="flex items-center gap-3 p-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDeal(deal.folderName)}
                      className="h-4 w-4 rounded border-gray-300"
                    />

                    {/* Folder icon */}
                    <FolderOpen className="h-5 w-5 text-amber-600" />

                    {/* Name + metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {deal.folderName}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
                            stageInfo.color
                          )}
                        >
                          {stageInfo.label}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{deal.fileCount} files</span>
                        {deal.hasFinancialModel && (
                          <span className="flex items-center gap-1">
                            <FileSpreadsheet className="h-3 w-3" />
                            Financial Model
                          </span>
                        )}
                        {deal.hasCIM && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            CIM
                          </span>
                        )}
                        {deal.hasNDA && (
                          <span className="flex items-center gap-1">
                            <FileCheck className="h-3 w-3" />
                            NDA
                          </span>
                        )}
                        {deal.hasLOI && (
                          <span className="flex items-center gap-1">
                            <FileWarning className="h-3 w-3" />
                            LOI
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand button */}
                    <button
                      onClick={() =>
                        setExpandedDeal(isExpanded ? null : deal.folderName)
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Expanded file list */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground">
                            <th className="pb-1 text-left font-medium">File</th>
                            <th className="pb-1 text-left font-medium">Category</th>
                            <th className="pb-1 text-right font-medium">Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deal.files.map((file, idx) => {
                            const Icon =
                              CATEGORY_ICONS[file.category] || FileText;
                            return (
                              <tr
                                key={idx}
                                className="border-t border-dashed border-muted"
                              >
                                <td className="py-1.5">
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="truncate max-w-[300px]">
                                      {file.fileName}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-1.5">
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                    {file.category}
                                  </span>
                                </td>
                                <td className="py-1.5 text-right text-muted-foreground">
                                  {formatFileSize(file.fileSize)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
