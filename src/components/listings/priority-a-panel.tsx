"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValuationScenario {
  multiple: number;
  impliedPrice: number;
}

interface ValuationSnapshot {
  adjustedEbitda: number | null;
  earningsType: string | null;
  conservative: ValuationScenario | null;
  target: ValuationScenario | null;
  stretch: ValuationScenario | null;
  comparableCount: number;
}

interface PriorityAPackageData {
  id: string;
  listingId: string;
  executiveSummary: string;
  acquisitionThesis: string;
  valuationSnapshot: ValuationSnapshot | string;
  generatedAt: string;
}

interface ThesisResult {
  thesis: string;
  keyRisks?: string[];
  recommendedTimeline?: string;
}

interface PriorityAPanelProps {
  listingId: string;
  acquisitionTier: string | null;
  listingTitle: string;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PriorityAPanel({
  listingId,
  acquisitionTier,
  listingTitle,
}: PriorityAPanelProps) {
  const queryClient = useQueryClient();

  // Collapsible section state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    summary: true,
    thesis: true,
    valuation: true,
    actions: false,
  });

  // Store full thesis result from POST response
  const [thesisResult, setThesisResult] = useState<ThesisResult | null>(null);

  // PDF download state
  const [downloading, setDownloading] = useState(false);

  // ── Render guard ──
  if (acquisitionTier !== "A") return null;

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Data fetching ──
  const packageQuery = useQuery({
    queryKey: ["priority-a-package", listingId],
    queryFn: async () => {
      const res = await fetch(`/api/listings/${listingId}/priority-a-package`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch package");
      return res.json() as Promise<{
        package: PriorityAPackageData;
        isStale: boolean;
      }>;
    },
    enabled: acquisitionTier === "A",
  });

  // ── Generate mutation ──
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/listings/${listingId}/priority-a-package`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to generate package");
      return res.json() as Promise<{
        package: PriorityAPackageData;
        thesis: ThesisResult;
      }>;
    },
    onSuccess: (data) => {
      setThesisResult(data.thesis);
      queryClient.invalidateQueries({
        queryKey: ["priority-a-package", listingId],
      });
    },
  });

  // ── PDF download ──
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/listings/${listingId}/priority-a-package/pdf`,
      );
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Priority-A-${listingTitle.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  // ── Parse valuation snapshot ──
  const parseValuation = (
    raw: ValuationSnapshot | string | undefined,
  ): ValuationSnapshot | null => {
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw;
  };

  const pkg = packageQuery.data?.package ?? null;
  const isStale = packageQuery.data?.isStale ?? false;
  const isGenerating = generateMutation.isPending;
  const valuation = pkg ? parseValuation(pkg.valuationSnapshot) : null;

  // ── Render ──
  return (
    <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50/30 p-5">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          <h2 className="text-lg font-semibold">Priority A Package</h2>
        </div>
        <div className="flex items-center gap-2">
          {pkg && (
            <>
              <span className="text-xs text-muted-foreground">
                Generated{" "}
                {new Date(pkg.generatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {isStale && (
                <span className="rounded-full bg-yellow-200 text-yellow-800 px-2 py-0.5 text-xs font-medium">
                  Stale
                </span>
              )}
              <button
                onClick={downloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-1 rounded-md border bg-white px-2.5 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Download PDF
              </button>
              <button
                onClick={() => generateMutation.mutate()}
                disabled={isGenerating}
                className="inline-flex items-center gap-1 rounded-md border bg-white px-2.5 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      {/* Loading state */}
      {packageQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading package...
        </div>
      )}

      {/* Generating state */}
      {isGenerating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating deal package...
        </div>
      )}

      {/* No package state */}
      {!packageQuery.isLoading && !pkg && !isGenerating && (
        <div className="text-center py-6">
          <Sparkles className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Auto-generates executive summary, acquisition thesis, valuation
            scenarios, and due diligence checklist.
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-md bg-yellow-500 text-white px-4 py-2 text-sm font-medium hover:bg-yellow-600 transition-colors"
          >
            <Star className="h-4 w-4" />
            Generate Deal Package
          </button>
        </div>
      )}

      {/* Package content — 4 collapsible sections */}
      {pkg && !isGenerating && (
        <div className="space-y-3">
          {/* Section 1: Executive Summary */}
          <CollapsibleSection
            title="Executive Summary"
            isOpen={openSections.summary}
            onToggle={() => toggleSection("summary")}
          >
            <div className="bg-white rounded-lg p-4">
              <div className="space-y-1 text-sm">
                {pkg.executiveSummary.split("\n").map((line, i) => {
                  // Lines wrapped in ** should render bold
                  const boldMatch = line.match(/^\*\*(.+)\*\*$/);
                  if (boldMatch) {
                    return (
                      <p key={i} className="font-semibold">
                        {boldMatch[1]}
                      </p>
                    );
                  }
                  // Lines containing **text** inline
                  if (line.includes("**")) {
                    const parts = line.split(/\*\*(.+?)\*\*/g);
                    return (
                      <p key={i}>
                        {parts.map((part, j) =>
                          j % 2 === 1 ? (
                            <strong key={j}>{part}</strong>
                          ) : (
                            <span key={j}>{part}</span>
                          ),
                        )}
                      </p>
                    );
                  }
                  return line ? (
                    <p key={i}>{line}</p>
                  ) : (
                    <div key={i} className="h-2" />
                  );
                })}
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 2: Acquisition Thesis */}
          <CollapsibleSection
            title="Acquisition Thesis"
            isOpen={openSections.thesis}
            onToggle={() => toggleSection("thesis")}
          >
            <div className="bg-white rounded-lg p-4 space-y-3">
              {pkg.acquisitionThesis
                .split("\n\n")
                .filter(Boolean)
                .map((paragraph, i) => (
                  <p key={i} className="text-sm leading-relaxed">
                    {paragraph}
                  </p>
                ))}

              {/* Thesis metadata from POST response */}
              {thesisResult?.keyRisks && thesisResult.keyRisks.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Key Risks
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {thesisResult.keyRisks.map((risk, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {thesisResult?.recommendedTimeline && (
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-medium">
                    Timeline: {thesisResult.recommendedTimeline}
                  </span>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Section 3: Valuation Summary */}
          <CollapsibleSection
            title="Valuation Summary"
            isOpen={openSections.valuation}
            onToggle={() => toggleSection("valuation")}
          >
            <div className="bg-white rounded-lg p-4">
              {valuation &&
              valuation.adjustedEbitda &&
              (valuation.conservative ||
                valuation.target ||
                valuation.stretch) ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    {/* Conservative */}
                    <div className="text-center p-3 rounded-lg bg-gray-50">
                      <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
                        Conservative
                      </p>
                      {valuation.conservative ? (
                        <>
                          <p className="text-lg font-bold">
                            {valuation.conservative.multiple.toFixed(1)}x EBITDA
                          </p>
                          <p className="text-sm font-medium text-muted-foreground">
                            {fmt.format(valuation.conservative.impliedPrice)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">N/A</p>
                      )}
                    </div>

                    {/* Target */}
                    <div className="text-center p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                      <p className="text-xs font-medium uppercase text-yellow-700 mb-2">
                        Target
                      </p>
                      {valuation.target ? (
                        <>
                          <p className="text-lg font-bold text-yellow-700">
                            {valuation.target.multiple.toFixed(1)}x EBITDA
                          </p>
                          <p className="text-sm font-medium text-yellow-600">
                            {fmt.format(valuation.target.impliedPrice)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">N/A</p>
                      )}
                    </div>

                    {/* Stretch */}
                    <div className="text-center p-3 rounded-lg bg-gray-50">
                      <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
                        Stretch
                      </p>
                      {valuation.stretch ? (
                        <>
                          <p className="text-lg font-bold">
                            {valuation.stretch.multiple.toFixed(1)}x EBITDA
                          </p>
                          <p className="text-sm font-medium text-muted-foreground">
                            {fmt.format(valuation.stretch.impliedPrice)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">N/A</p>
                      )}
                    </div>
                  </div>
                  {valuation.comparableCount > 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      Based on {valuation.comparableCount} comparable
                      transaction{valuation.comparableCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </>
              ) : !valuation?.adjustedEbitda ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Financial data needed for valuation
                </p>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Import BVR data for market-based valuation
                </p>
              )}
            </div>
          </CollapsibleSection>

          {/* Section 4: Quick Actions */}
          <CollapsibleSection
            title="Quick Actions"
            isOpen={openSections.actions}
            onToggle={() => toggleSection("actions")}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={downloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download PDF
              </button>
              <button
                onClick={() => {
                  const dd = document.getElementById("due-diligence-panel");
                  if (dd) dd.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
              >
                View Due Diligence Checklist
              </button>
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section helper
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left py-1"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold">{title}</span>
      </button>
      {isOpen && <div className="mt-2 ml-6">{children}</div>}
    </div>
  );
}
