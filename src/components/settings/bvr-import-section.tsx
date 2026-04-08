"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Database,
  FileSpreadsheet,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewData {
  preview: true;
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  rejectedRows: number;
  filteredRows: number;
  sample: SampleRow[];
  parseErrors: string[];
}

interface SampleRow {
  sicCode?: string | null;
  revenue?: number | null;
  ebitda?: number | null;
  mvicEbitdaMultiple?: number | null;
  state?: string | null;
  industry?: string | null;
  transactionDate?: string | null;
}

interface ImportResult {
  importId: string;
  rowsImported: number;
  rowsDuplicate: number;
  rowsRejected: number;
}

interface ImportHistoryEntry {
  id: string;
  createdAt: string;
  sourceDatabase: string;
  fileName: string;
  rowsImported: number;
  rowsDuplicate: number;
  rowsRejected: number;
  rowsTotal: number;
}

type SourceDatabase = "DealStats" | "BizComps";

const RANK_OPTIONS = [
  { rank: 1, label: "Rank 1 -- MSP" },
  { rank: 2, label: "Rank 2 -- UCaaS" },
  { rank: 3, label: "Rank 3 -- Security Integration" },
  { rank: 4, label: "Rank 4 -- Structured Cabling" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
  return (bytes / 1024).toFixed(0) + " KB";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "--";
  return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatMultiple(value: number | null | undefined): string {
  if (value == null) return "--";
  return value.toFixed(1) + "x";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BvrImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [file, setFile] = useState<File | null>(null);
  const [sourceDatabase, setSourceDatabase] =
    useState<SourceDatabase>("DealStats");
  const [selectedRanks, setSelectedRanks] = useState<number[]>([1, 2, 3, 4]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Import history
  const { data: history, refetch: refetchHistory } = useQuery<
    ImportHistoryEntry[]
  >({
    queryKey: ["bvr-import-history"],
    queryFn: async () => {
      const res = await fetch("/api/settings/bvr-import");
      if (!res.ok) throw new Error("Failed to fetch import history");
      return res.json();
    },
  });

  // Handlers
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setImportResult(null);
    setError(null);
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleRank(rank: number) {
    setSelectedRanks((prev) =>
      prev.includes(rank) ? prev.filter((r) => r !== rank) : [...prev, rank],
    );
  }

  async function handlePreview() {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setPreview(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceDatabase", sourceDatabase);
      formData.append("selectedRanks", JSON.stringify(selectedRanks));

      const res = await fetch("/api/settings/bvr-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Preview failed");
        return;
      }
      setPreview(data as PreviewData);
    } catch {
      setError("Network error during preview");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setIsConfirming(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceDatabase", sourceDatabase);
      formData.append("selectedRanks", JSON.stringify(selectedRanks));
      formData.append("confirm", "true");

      const res = await fetch("/api/settings/bvr-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setImportResult(data as ImportResult);
      setPreview(null);
      refetchHistory();
    } catch {
      setError("Network error during import");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Database className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">Market Data Imports</h2>
          <p className="text-xs text-muted-foreground">
            Import BVR DealStats or BizComps transaction data for valuation
            benchmarks
          </p>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* File input */}
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 py-8 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
            >
              <Upload className="h-4 w-4" />
              Choose .xlsx or .csv file
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={clearFile}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Source database */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Source Database
          </label>
          <div className="flex gap-4">
            {(["DealStats", "BizComps"] as const).map((src) => (
              <label
                key={src}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="sourceDatabase"
                  value={src}
                  checked={sourceDatabase === src}
                  onChange={() => setSourceDatabase(src)}
                  className="accent-primary"
                />
                {src}
              </label>
            ))}
          </div>
        </div>

        {/* Rank filter */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Target Type Filter
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {RANK_OPTIONS.map(({ rank, label }) => (
              <label
                key={rank}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedRanks.includes(rank)}
                  onChange={() => toggleRank(rank)}
                  className="accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Preview button */}
        <button
          type="button"
          onClick={handlePreview}
          disabled={!file || isUploading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Preview Import
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Preview results */}
        {preview && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold">Preview Results</h3>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-md border bg-card px-3 py-2">
                <span className="text-xs text-muted-foreground">New</span>
                <p className="font-semibold text-green-600">
                  {preview.newRows}
                </p>
              </div>
              <div className="rounded-md border bg-card px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Duplicates
                </span>
                <p className="font-semibold text-yellow-600">
                  {preview.duplicateRows}
                </p>
              </div>
              <div className="rounded-md border bg-card px-3 py-2">
                <span className="text-xs text-muted-foreground">Rejected</span>
                <p className="font-semibold text-red-600">
                  {preview.rejectedRows}
                </p>
              </div>
              <div className="rounded-md border bg-card px-3 py-2">
                <span className="text-xs text-muted-foreground">Filtered</span>
                <p className="font-semibold text-muted-foreground">
                  {preview.filteredRows}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {preview.newRows} new transactions, {preview.duplicateRows}{" "}
              duplicates, {preview.rejectedRows} rejected,{" "}
              {preview.filteredRows} filtered out of {preview.totalRows} total
              rows
            </p>

            {/* Parse errors */}
            {preview.parseErrors.length > 0 && (
              <div className="space-y-1 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                <p className="text-xs font-medium text-yellow-700">
                  Parse Warnings ({preview.parseErrors.length})
                </p>
                <ul className="space-y-0.5 text-xs text-yellow-600">
                  {preview.parseErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {preview.parseErrors.length > 5 && (
                    <li>
                      ...and {preview.parseErrors.length - 5} more warnings
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Sample table */}
            {preview.sample.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">SIC</th>
                      <th className="pb-2 pr-4 font-medium">Industry</th>
                      <th className="pb-2 pr-4 text-right font-medium">
                        Revenue
                      </th>
                      <th className="pb-2 pr-4 text-right font-medium">
                        EBITDA
                      </th>
                      <th className="pb-2 pr-4 text-right font-medium">
                        MVIC/EBITDA
                      </th>
                      <th className="pb-2 font-medium">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.slice(0, 15).map((row, i) => (
                      <tr key={i} className="border-b border-muted last:border-0">
                        <td className="py-1.5 pr-4">{row.sicCode ?? "--"}</td>
                        <td className="max-w-[180px] truncate py-1.5 pr-4">
                          {row.industry ?? "--"}
                        </td>
                        <td className="py-1.5 pr-4 text-right">
                          {formatCurrency(row.revenue)}
                        </td>
                        <td className="py-1.5 pr-4 text-right">
                          {formatCurrency(row.ebitda)}
                        </td>
                        <td className="py-1.5 pr-4 text-right">
                          {formatMultiple(row.mvicEbitdaMultiple)}
                        </td>
                        <td className="py-1.5">{row.state ?? "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Confirm button */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming || preview.newRows === 0}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConfirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirm Import ({preview.newRows} rows)
            </button>
          </div>
        )}

        {/* Import result */}
        {importResult && (
          <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Import successful</p>
              <p className="text-xs">
                {importResult.rowsImported} transactions imported,{" "}
                {importResult.rowsDuplicate} duplicates skipped,{" "}
                {importResult.rowsRejected} rejected
              </p>
            </div>
          </div>
        )}

        {/* Import history */}
        {history && history.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">
              Import History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Source</th>
                    <th className="pb-2 pr-4 font-medium">File</th>
                    <th className="pb-2 pr-4 text-right font-medium">
                      Imported
                    </th>
                    <th className="pb-2 pr-4 text-right font-medium">
                      Duplicates
                    </th>
                    <th className="pb-2 text-right font-medium">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 10).map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-muted last:border-0"
                    >
                      <td className="py-1.5 pr-4">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="py-1.5 pr-4">{entry.sourceDatabase}</td>
                      <td className="max-w-[160px] truncate py-1.5 pr-4">
                        {entry.fileName}
                      </td>
                      <td className="py-1.5 pr-4 text-right">
                        {entry.rowsImported}
                      </td>
                      <td className="py-1.5 pr-4 text-right">
                        {entry.rowsDuplicate}
                      </td>
                      <td className="py-1.5 text-right">
                        {entry.rowsRejected}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
