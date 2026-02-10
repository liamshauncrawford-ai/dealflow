"use client";

import {
  FolderOpen,
  FileText,
  FileSpreadsheet,
  FileCheck,
  FileWarning,
  BarChart3,
} from "lucide-react";

type DealDoc = {
  id: string;
  fileName: string;
  fileSize: number | null;
  category: string;
  fileType: string;
};

interface DocumentsSectionProps {
  documents: DealDoc[];
}

const CATEGORY_ORDER = ["CIM", "FINANCIAL_MODEL", "FINANCIAL_STATEMENT", "TAX_RETURN", "LOI", "NDA", "VALUATION", "OTHER"];
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

export function DocumentsSection({ documents }: DocumentsSectionProps) {
  if (!documents || documents.length === 0) return null;

  const grouped: Record<string, DealDoc[]> = {};
  for (const doc of documents) {
    const cat = doc.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(doc);
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <FolderOpen className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold">Deal Documents</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {documents.length}
        </span>
      </div>
      <div className="p-4">
        <div className="space-y-4">
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
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{doc.fileName}</span>
                      </div>
                      <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
                        {doc.fileSize
                          ? doc.fileSize < 1024
                            ? `${doc.fileSize} B`
                            : doc.fileSize < 1024 * 1024
                            ? `${(doc.fileSize / 1024).toFixed(1)} KB`
                            : `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
