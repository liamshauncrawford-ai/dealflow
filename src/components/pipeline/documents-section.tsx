"use client";

import { useRef, useState, useCallback } from "react";
import {
  FolderOpen,
  FileText,
  FileSpreadsheet,
  FileCheck,
  FileWarning,
  BarChart3,
  Plus,
  Upload,
  Eye,
  Download,
  PenLine,
  Trash2,
  Loader2,
  X,
  FileQuestion,
} from "lucide-react";
import { cn, formatRelativeDate } from "@/lib/utils";
import {
  useUploadDocument,
  useDeleteDocument,
  useUpdateDocument,
} from "@/hooks/use-documents";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DealDoc = {
  id: string;
  fileName: string;
  fileSize: number | null;
  category: string;
  fileType: string;
  mimeType: string | null;
  description: string | null;
  uploadedAt: string | null;
  importedAt: string;
};

interface DocumentsSectionProps {
  opportunityId: string;
  documents: DealDoc[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_ORDER = [
  "CIM",
  "FINANCIAL_MODEL",
  "FINANCIAL_STATEMENT",
  "TAX_RETURN",
  "LOI",
  "NDA",
  "VALUATION",
  "OTHER",
];
const CATEGORY_LABELS: Record<string, string> = {
  CIM: "CIM / Executive Summary",
  FINANCIAL_MODEL: "Financial Models",
  FINANCIAL_STATEMENT: "Financial Statements",
  TAX_RETURN: "Tax Returns",
  LOI: "Letters of Intent",
  NDA: "NDAs",
  VALUATION: "Valuation Reports",
  OTHER: "Other Documents",
};
const CATEGORY_ICONS: Record<string, typeof FileText> = {
  CIM: FileText,
  FINANCIAL_MODEL: FileSpreadsheet,
  FINANCIAL_STATEMENT: FileSpreadsheet,
  TAX_RETURN: FileCheck,
  LOI: FileWarning,
  NDA: FileCheck,
  VALUATION: BarChart3,
  OTHER: FileText,
};

const ACCEPTED_EXTENSIONS =
  ".pdf,.xlsx,.xls,.docx,.doc,.csv,.png,.jpg,.jpeg";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(
  mimeType: string | null,
): "pdf" | "image" | false {
  if (!mimeType) return false;
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return false;
}

function hasFileData(doc: DealDoc): boolean {
  return doc.uploadedAt !== null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentsSection({
  opportunityId,
  documents,
}: DocumentsSectionProps) {
  const uploadMutation = useUploadDocument(opportunityId);
  const deleteMutation = useDeleteDocument(opportunityId);
  const updateMutation = useUpdateDocument(opportunityId);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("OTHER");
  const [uploadDescription, setUploadDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<DealDoc | null>(null);

  // Inline edit state
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // ── File selection handling ──

  const validateAndSetFile = useCallback((file: File) => {
    setFileError(null);
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File exceeds 25 MB limit (${formatFileSize(file.size)})`);
      return;
    }
    setSelectedFile(file);
    setShowUpload(true);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSetFile(file);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [validateAndSetFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) validateAndSetFile(file);
    },
    [validateAndSetFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // ── Upload ──

  const handleUpload = useCallback(() => {
    if (!selectedFile) return;
    uploadMutation.mutate(
      {
        file: selectedFile,
        category: uploadCategory,
        description: uploadDescription || undefined,
      },
      {
        onSuccess: () => {
          setShowUpload(false);
          setSelectedFile(null);
          setUploadCategory("OTHER");
          setUploadDescription("");
          setFileError(null);
        },
      },
    );
  }, [selectedFile, uploadCategory, uploadDescription, uploadMutation]);

  const cancelUpload = useCallback(() => {
    setShowUpload(false);
    setSelectedFile(null);
    setUploadCategory("OTHER");
    setUploadDescription("");
    setFileError(null);
  }, []);

  // ── Delete ──

  const handleDelete = useCallback(
    (doc: DealDoc) => {
      if (!confirm(`Delete "${doc.fileName}"? This cannot be undone.`)) return;
      deleteMutation.mutate(doc.id);
    },
    [deleteMutation],
  );

  // ── Edit ──

  const startEdit = useCallback((doc: DealDoc) => {
    setEditingDocId(doc.id);
    setEditCategory(doc.category);
    setEditDescription(doc.description || "");
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingDocId) return;
    updateMutation.mutate(
      {
        documentId: editingDocId,
        data: {
          category: editCategory,
          description: editDescription || null,
        },
      },
      { onSuccess: () => setEditingDocId(null) },
    );
  }, [editingDocId, editCategory, editDescription, updateMutation]);

  // ── Preview ──

  const handlePreviewOrDownload = useCallback((doc: DealDoc) => {
    if (!hasFileData(doc)) return;
    const previewType = isPreviewable(doc.mimeType);
    if (previewType) {
      setPreviewDoc(doc);
    } else {
      // Non-previewable: trigger download
      window.open(`/api/documents/${doc.id}`, "_blank");
    }
  }, []);

  const handleDownload = useCallback((doc: DealDoc) => {
    window.open(`/api/documents/${doc.id}`, "_blank");
  }, []);

  // ── Grouped documents ──

  const grouped: Record<string, DealDoc[]> = {};
  for (const doc of documents) {
    if (!grouped[doc.category]) grouped[doc.category] = [];
    grouped[doc.category].push(doc);
  }

  const isEmpty = documents.length === 0;

  return (
    <>
      <div className="rounded-lg border bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold">Deal Documents</h2>
            {documents.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {documents.length}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setShowUpload(true);
              setSelectedFile(null);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" />
            Upload
          </button>
        </div>

        {/* Upload form */}
        {showUpload && (
          <div className="border-b p-4 space-y-3 bg-muted/20">
            {/* Drop zone */}
            {!selectedFile && (
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
                )}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <div className="text-sm text-muted-foreground text-center">
                  <span className="font-medium text-primary">
                    Click to browse
                  </span>{" "}
                  or drag and drop
                </div>
                <div className="text-xs text-muted-foreground">
                  PDF, Excel, Word, CSV, or images up to 25 MB
                </div>
              </div>
            )}

            {/* File error */}
            {fileError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {fileError}
              </div>
            )}

            {/* Selected file + category + description */}
            {selectedFile && (
              <>
                <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatFileSize(selectedFile.size)}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setFileError(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Category
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                    >
                      {CATEGORY_ORDER.map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="e.g. 2024 audited P&L"
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                      maxLength={1000}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={cancelUpload}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploadMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    {uploadMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    {uploadMutation.isPending ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* Document list */}
        {isEmpty && !showUpload ? (
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              setShowUpload(true);
              fileInputRef.current?.click();
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-8 cursor-pointer transition-colors",
              dragOver ? "bg-primary/5" : "hover:bg-muted/30",
            )}
          >
            <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
            <div className="text-sm text-muted-foreground text-center">
              No documents yet.{" "}
              <span className="font-medium text-primary">Upload a file</span>{" "}
              or drag and drop.
            </div>
            <div className="text-xs text-muted-foreground">
              NDA, CIM, P&L, Balance Sheet, DCF, Valuations, and more
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : documents.length > 0 ? (
          <div className="p-4 space-y-4">
            {CATEGORY_ORDER.map((cat) => {
              const docs = grouped[cat];
              if (!docs || docs.length === 0) return null;
              const CatIcon = CATEGORY_ICONS[cat] || FileText;

              return (
                <div key={cat}>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    <CatIcon className="h-3 w-3" />
                    {CATEGORY_LABELS[cat] || cat}
                  </div>
                  <div className="space-y-1">
                    {docs.map((doc) => {
                      const isEditing = editingDocId === doc.id;
                      const canPreview =
                        hasFileData(doc) && isPreviewable(doc.mimeType);
                      const canDownload = hasFileData(doc);

                      if (isEditing) {
                        return (
                          <div
                            key={doc.id}
                            className="rounded-md border bg-muted/20 p-3 space-y-2"
                          >
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground">
                                  Category
                                </label>
                                <select
                                  value={editCategory}
                                  onChange={(e) =>
                                    setEditCategory(e.target.value)
                                  }
                                  className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                                >
                                  {CATEGORY_ORDER.map((c) => (
                                    <option key={c} value={c}>
                                      {CATEGORY_LABELS[c]}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground">
                                  Description
                                </label>
                                <input
                                  type="text"
                                  value={editDescription}
                                  onChange={(e) =>
                                    setEditDescription(e.target.value)
                                  }
                                  className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                                  maxLength={1000}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => setEditingDocId(null)}
                                className="rounded border px-2 py-1 text-[10px] hover:bg-muted"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveEdit}
                                disabled={updateMutation.isPending}
                                className="rounded bg-primary px-2 py-1 text-[10px] text-white hover:bg-primary/90 disabled:opacity-50"
                              >
                                {updateMutation.isPending
                                  ? "Saving..."
                                  : "Save"}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={doc.id}
                          className="group flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="truncate font-medium">
                              {doc.fileName}
                            </span>
                            {doc.description && (
                              <span className="hidden sm:inline truncate text-xs text-muted-foreground">
                                — {doc.description}
                              </span>
                            )}
                            {!canDownload && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap">
                                Imported
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 ml-2">
                            {/* Meta */}
                            <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
                              {formatFileSize(doc.fileSize)}
                            </span>
                            <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
                              {formatRelativeDate(
                                doc.uploadedAt || doc.importedAt,
                              )}
                            </span>

                            {/* Actions — visible on hover */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canPreview && (
                                <button
                                  onClick={() =>
                                    handlePreviewOrDownload(doc)
                                  }
                                  title="Preview"
                                  className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {canDownload && (
                                <button
                                  onClick={() => handleDownload(doc)}
                                  title="Download"
                                  className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => startEdit(doc)}
                                title="Edit"
                                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                              >
                                <PenLine className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(doc)}
                                title="Delete"
                                disabled={deleteMutation.isPending}
                                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* ── Preview Modal ── */}
      <Dialog
        open={!!previewDoc}
        onOpenChange={(open) => {
          if (!open) setPreviewDoc(null);
        }}
      >
        <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {previewDoc?.mimeType?.startsWith("image/") ? (
                <Eye className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span className="truncate">{previewDoc?.fileName}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-0">
            {previewDoc &&
              (() => {
                const previewType = isPreviewable(previewDoc.mimeType);
                const url = `/api/documents/${previewDoc.id}?inline=true`;

                if (previewType === "pdf") {
                  return (
                    <iframe
                      src={url}
                      className="w-full h-[75vh] rounded border"
                      title={previewDoc.fileName}
                    />
                  );
                }

                if (previewType === "image") {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={previewDoc.fileName}
                      className="max-w-full max-h-[75vh] mx-auto rounded"
                    />
                  );
                }

                return (
                  <div className="flex flex-col items-center justify-center gap-3 py-12">
                    <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Preview not available for this file type
                    </p>
                    <button
                      onClick={() =>
                        window.open(
                          `/api/documents/${previewDoc.id}`,
                          "_blank",
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                    >
                      <Download className="h-4 w-4" />
                      Download File
                    </button>
                  </div>
                );
              })()}
          </div>

          {/* Footer: download button */}
          {previewDoc && isPreviewable(previewDoc.mimeType) && (
            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() =>
                  window.open(`/api/documents/${previewDoc.id}`, "_blank")
                }
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
