"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";

interface HistoricPnlUploadProps {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
  /** Compact mode shows just a button; full mode shows a large dropzone */
  compact?: boolean;
}

export function HistoricPnlUpload({
  onFileSelected,
  isUploading,
  compact = false,
}: HistoricPnlUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const lower = file.name.toLowerCase();
      if (
        !lower.endsWith(".xlsx") &&
        !lower.endsWith(".xls") &&
        !lower.endsWith(".xlsm") &&
        !lower.endsWith(".csv")
      ) {
        return; // Silently ignore unsupported files
      }
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so re-uploading the same file triggers onChange
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  // Hidden file input (shared between compact and full modes)
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".xlsx,.xls,.xlsm,.csv"
      onChange={handleInputChange}
      className="hidden"
    />
  );

  if (compact) {
    return (
      <>
        {fileInput}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isUploading ? "Uploading…" : "Upload P&L"}
        </button>
      </>
    );
  }

  // Full dropzone
  return (
    <>
      {fileInput}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed
          px-8 py-16 text-center transition-colors cursor-pointer
          ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/30"
          }
          ${isUploading ? "opacity-60 cursor-not-allowed" : ""}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="text-sm font-medium text-foreground">
              Parsing spreadsheet…
            </p>
          </>
        ) : (
          <>
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium text-foreground">
              Drop your P&L spreadsheet here
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or click to browse files
            </p>
            <p className="mt-3 text-xs text-muted-foreground/70">
              Supports: .xlsx, .xls, .csv
            </p>
          </>
        )}
      </div>
    </>
  );
}
