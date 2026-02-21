"use client";

import { useState } from "react";
import { X, Sparkles, Check, FileText, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ADD_BACK_CATEGORY_LABELS, CATEGORY_LABELS } from "@/lib/financial/canonical-labels";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface AIExtractionModalProps {
  opportunityId: string;
  documents: any[];
  onClose: () => void;
  onApplied: () => void;
}

type Step = "select" | "extracting" | "preview" | "applying" | "done";

export function AIExtractionModal({
  opportunityId,
  documents,
  onClose,
  onApplied,
}: AIExtractionModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [divisionFilter, setDivisionFilter] = useState("");
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [selectedPeriods, setSelectedPeriods] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const textDocs = documents.filter(
    (d: any) => d.extractedText || d.fileName?.endsWith(".pdf") || d.fileName?.endsWith(".txt")
  );

  async function handleExtract() {
    if (!selectedDocId) return;
    setStep("extracting");
    setError(null);

    try {
      const res = await fetch(`/api/pipeline/${opportunityId}/financials/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocId,
          ...(divisionFilter.trim() ? { divisionFilter: divisionFilter.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Extraction failed");
      }

      const data = await res.json();
      setExtractionResult(data);
      setAnalysisId(data.analysisId);
      // Auto-select all periods
      setSelectedPeriods(new Set(data.periods?.map((_: any, i: number) => i) ?? []));
      setStep("preview");
    } catch (err: any) {
      setError(err.message);
      setStep("select");
    }
  }

  async function handleApply() {
    if (!analysisId || selectedPeriods.size === 0) return;
    setStep("applying");

    try {
      const res = await fetch(`/api/pipeline/${opportunityId}/financials/apply-extraction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          selectedPeriods: Array.from(selectedPeriods),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to apply extraction");
      }

      setStep("done");
      setTimeout(() => {
        onApplied();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
      setStep("preview");
    }
  }

  function togglePeriod(idx: number) {
    setSelectedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">AI Financial Extraction</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Step: Select Document */}
          {step === "select" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a document to extract P&L data and add-backs from.
              </p>
              {textDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No documents with extractable text found. Upload a PDF first.
                </p>
              ) : (
                <div className="space-y-2">
                  {textDocs.map((doc: any) => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                        selectedDocId === doc.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.category} {doc.extractedText ? "— text available" : ""}
                        </p>
                      </div>
                      {selectedDocId === doc.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {/* Division / Segment Filter (optional) */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Division / Segment Filter{" "}
                  <span className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={divisionFilter}
                  onChange={(e) => setDivisionFilter(e.target.value)}
                  placeholder="e.g., North Office, Commercial Division"
                  className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/50"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  If the document contains multiple divisions, only data for this segment will be extracted.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleExtract}
                  disabled={!selectedDocId}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Extract Financials
                </button>
              </div>
            </div>
          )}

          {/* Step: Extracting */}
          {step === "extracting" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Extracting financial data with AI...</p>
              <p className="text-xs text-muted-foreground">This may take 10-30 seconds</p>
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && extractionResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Found {extractionResult.periods?.length ?? 0} financial period(s)
                </p>
                <span className="text-xs text-muted-foreground">
                  Confidence: {((extractionResult.confidence ?? 0) * 100).toFixed(0)}%
                </span>
              </div>

              {extractionResult.notes && (
                <p className="text-xs text-muted-foreground italic">{extractionResult.notes}</p>
              )}

              {/* Period cards */}
              <div className="space-y-3">
                {extractionResult.periods?.map((period: any, idx: number) => (
                  <div key={idx} className="rounded-md border p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPeriods.has(idx)}
                        onChange={() => togglePeriod(idx)}
                        className="rounded border-muted-foreground"
                      />
                      <span className="text-sm font-medium">
                        {period.periodType} {period.year}
                        {period.quarter ? ` Q${period.quarter}` : ""}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {period.lineItems?.length ?? 0} line items, {period.addBacks?.length ?? 0} add-backs
                      </span>
                    </label>

                    {selectedPeriods.has(idx) && (
                      <div className="mt-2 space-y-2 pl-6">
                        {/* Line items summary */}
                        <div className="text-xs space-y-0.5">
                          {period.lineItems?.slice(0, 8).map((li: any, i: number) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-muted-foreground truncate">
                                <span className="text-[10px] font-medium mr-1">
                                  {CATEGORY_LABELS[li.category as keyof typeof CATEGORY_LABELS] ?? li.category}
                                </span>
                                {li.rawLabel}
                              </span>
                              <span className="tabular-nums">{formatCurrency(li.amount)}</span>
                            </div>
                          ))}
                          {(period.lineItems?.length ?? 0) > 8 && (
                            <p className="text-muted-foreground">...and {period.lineItems.length - 8} more</p>
                          )}
                        </div>

                        {/* Add-backs */}
                        {period.addBacks?.length > 0 && (
                          <div className="mt-1 border-t pt-1">
                            <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Add-Backs</p>
                            {period.addBacks.map((ab: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-emerald-600 dark:text-emerald-400 truncate">
                                  {ADD_BACK_CATEGORY_LABELS[ab.category as keyof typeof ADD_BACK_CATEGORY_LABELS] ?? ab.category}: {ab.description}
                                </span>
                                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(ab.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setStep("select"); setExtractionResult(null); }}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                >
                  Back
                </button>
                <button
                  onClick={handleApply}
                  disabled={selectedPeriods.size === 0}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Apply {selectedPeriods.size} Period{selectedPeriods.size !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          )}

          {/* Step: Applying */}
          {step === "applying" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Creating financial periods...</p>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Check className="h-8 w-8 text-emerald-600" />
              <p className="text-sm font-medium">Financial data imported successfully!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
