"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Building2,
  Users,
  FileText,
  Shield,
  TrendingUp,
  UserPlus,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAnalyzeCIM, useApplyCIMResults } from "@/hooks/use-ai";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CIMAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  documentId: string;
  documentName: string;
}

interface CIMFinancialYear {
  year: number | null;
  revenue: number | null;
  ebitda: number | null;
  ebitdaMargin: number | null;
  sde: number | null;
  grossProfit: number | null;
  grossMargin: number | null;
  netIncome: number | null;
}

interface CIMResult {
  businessName: string | null;
  dbaName: string | null;
  description: string | null;
  industry: string | null;
  subIndustry: string | null;
  yearEstablished: number | null;
  city: string | null;
  state: string | null;
  askingPrice: number | null;
  financials: CIMFinancialYear[];
  latestRevenue: number | null;
  latestEbitda: number | null;
  latestEbitdaMargin: number | null;
  latestSde: number | null;
  employees: number | null;
  recurringRevenuePct: number | null;
  serviceLines: string[];
  keyClients: string[];
  customerConcentrationPct: number | null;
  certifications: string[];
  ownerName: string | null;
  ownerRole: string | null;
  ownerEmail: string | null;
  brokerName: string | null;
  brokerCompany: string | null;
  brokerEmail: string | null;
  reasonForSale: string | null;
  riskFlags: string[];
  dealStructureSummary: string;
  thesisFitAssessment: string;
  confidence: number;
  fieldsExtracted: string[];
}

// ─────────────────────────────────────────────
// Field group definitions for apply step
// ─────────────────────────────────────────────

const FIELD_GROUPS = [
  {
    id: "financials",
    label: "Financials",
    description: "Revenue, EBITDA, margin, asking price",
    icon: DollarSign,
    default: true,
  },
  {
    id: "business_details",
    label: "Business Details",
    description: "Description, employees",
    icon: Building2,
    default: true,
  },
  {
    id: "deal_structure",
    label: "Deal Structure",
    description: "Summary narrative (matches PMS/AES format)",
    icon: FileText,
    default: true,
  },
  {
    id: "risk_indicators",
    label: "Risk Indicators",
    description: "Customer concentration, risk flags",
    icon: Shield,
    default: true,
  },
  {
    id: "revenue_trend",
    label: "Revenue Trend",
    description: "Growing / Stable / Declining from multi-year data",
    icon: TrendingUp,
    default: true,
  },
  {
    id: "thesis_fit",
    label: "Thesis Fit Assessment",
    description: "Acquisition thesis fit analysis",
    icon: Sparkles,
    default: false,
  },
  {
    id: "contact",
    label: "Create Contact",
    description: "Add broker or owner as contact on this opportunity",
    icon: UserPlus,
    default: true,
  },
] as const;

// ─────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return (value * 100).toFixed(1) + "%";
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function CIMAnalysisModal({
  open,
  onOpenChange,
  opportunityId,
  documentId,
  documentName,
}: CIMAnalysisModalProps) {
  const analyzeMutation = useAnalyzeCIM(opportunityId);
  const applyMutation = useApplyCIMResults(opportunityId);

  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [result, setResult] = useState<CIMResult | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    new Set(FIELD_GROUPS.filter((g) => g.default).map((g) => g.id)),
  );
  const [applied, setApplied] = useState(false);

  // Trigger analysis on open
  const handleAnalyze = () => {
    analyzeMutation.mutate(documentId, {
      onSuccess: (data) => {
        setAnalysisId(data.analysisId);
        setResult(data.result as unknown as CIMResult);
      },
    });
  };

  // Toggle a field group
  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Apply selected fields
  const handleApply = () => {
    if (!analysisId) return;
    applyMutation.mutate(
      { analysisId, selectedFields: Array.from(selectedGroups) },
      {
        onSuccess: () => {
          setApplied(true);
        },
      },
    );
  };

  // Reset state when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Small delay to allow animation
      setTimeout(() => {
        setAnalysisId(null);
        setResult(null);
        setApplied(false);
        setSelectedGroups(
          new Set(FIELD_GROUPS.filter((g) => g.default).map((g) => g.id)),
        );
        analyzeMutation.reset();
        applyMutation.reset();
      }, 200);
    }
    onOpenChange(isOpen);
  };

  const isAnalyzing = analyzeMutation.isPending;
  const hasResult = !!result;
  const isApplying = applyMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-500" />
            AI CIM Analysis
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {documentName}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0 space-y-4">
          {/* Pre-analysis: Start button */}
          {!hasResult && !isAnalyzing && !analyzeMutation.isError && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="rounded-full bg-amber-50 p-4 dark:bg-amber-900/20">
                <Sparkles className="h-8 w-8 text-amber-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">
                  Analyze this CIM with Claude Sonnet 4.5
                </p>
                <p className="text-xs text-muted-foreground">
                  Extracts financials, business details, contacts, and risk indicators.
                  <br />
                  Cost: ~$0.15-0.25 per document.
                </p>
              </div>
              <button
                onClick={handleAnalyze}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4" />
                Analyze CIM
              </button>
            </div>
          )}

          {/* Loading state */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Analyzing document with Claude Sonnet 4.5...
              </p>
              <p className="text-xs text-muted-foreground">
                This typically takes 10-30 seconds.
              </p>
            </div>
          )}

          {/* Error state */}
          {analyzeMutation.isError && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">
                {analyzeMutation.error.message}
              </p>
              <button
                onClick={handleAnalyze}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Results */}
          {hasResult && !applied && (
            <>
              {/* Confidence badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    result.confidence >= 0.7
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : result.confidence >= 0.4
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {result.confidence >= 0.7 ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {Math.round(result.confidence * 100)}% confidence
                </span>
                <span className="text-xs text-muted-foreground">
                  {result.fieldsExtracted.length} fields extracted
                </span>
              </div>

              {/* Deal Structure Summary */}
              {result.dealStructureSummary && (
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Deal Summary
                  </p>
                  <p className="text-sm">{result.dealStructureSummary}</p>
                </div>
              )}

              {/* Financials Table */}
              <div className="rounded-md border">
                <div className="border-b px-3 py-2 bg-muted/30">
                  <h3 className="text-xs font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3 w-3" />
                    Financials
                  </h3>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Asking Price</span>
                      <p className="font-medium">{formatCurrency(result.askingPrice)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Revenue</span>
                      <p className="font-medium">{formatCurrency(result.latestRevenue)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">EBITDA</span>
                      <p className="font-medium">{formatCurrency(result.latestEbitda)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">EBITDA Margin</span>
                      <p className="font-medium">{formatPercent(result.latestEbitdaMargin)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">SDE</span>
                      <p className="font-medium">{formatCurrency(result.latestSde)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Employees</span>
                      <p className="font-medium">{result.employees ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Recurring Rev %</span>
                      <p className="font-medium">{formatPercent(result.recurringRevenuePct)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Customer Conc.</span>
                      <p className="font-medium">{formatPercent(result.customerConcentrationPct)}</p>
                    </div>
                  </div>

                  {/* Multi-year financials table */}
                  {result.financials && result.financials.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Historical Financials
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b">
                              <th className="text-left py-1 pr-3">Year</th>
                              <th className="text-right py-1 px-2">Revenue</th>
                              <th className="text-right py-1 px-2">EBITDA</th>
                              <th className="text-right py-1 px-2">Margin</th>
                              <th className="text-right py-1 px-2">Gross Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.financials
                              .filter((f) => f.year)
                              .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
                              .map((f, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="py-1 pr-3 font-medium">{f.year}</td>
                                  <td className="text-right py-1 px-2">{formatCurrency(f.revenue)}</td>
                                  <td className="text-right py-1 px-2">{formatCurrency(f.ebitda)}</td>
                                  <td className="text-right py-1 px-2">{formatPercent(f.ebitdaMargin)}</td>
                                  <td className="text-right py-1 px-2">{formatCurrency(f.grossProfit)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Details */}
              <div className="rounded-md border">
                <div className="border-b px-3 py-2 bg-muted/30">
                  <h3 className="text-xs font-semibold flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" />
                    Business Details
                  </h3>
                </div>
                <div className="p-3 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Business</span>
                      <p className="font-medium">
                        {result.businessName || "—"}
                        {result.dbaName ? ` (DBA: ${result.dbaName})` : ""}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Location</span>
                      <p className="font-medium">
                        {[result.city, result.state].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Industry</span>
                      <p className="font-medium">
                        {[result.industry, result.subIndustry].filter(Boolean).join(" / ") || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Established</span>
                      <p className="font-medium">{result.yearEstablished ?? "—"}</p>
                    </div>
                  </div>

                  {result.serviceLines.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Service Lines</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.serviceLines.map((s, i) => (
                          <span
                            key={i}
                            className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.certifications.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Certifications</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.certifications.map((c, i) => (
                          <span
                            key={i}
                            className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.keyClients.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Key Clients</span>
                      <p className="text-sm">{result.keyClients.join(", ")}</p>
                    </div>
                  )}

                  {result.reasonForSale && (
                    <div>
                      <span className="text-xs text-muted-foreground">Reason for Sale</span>
                      <p className="text-sm">{result.reasonForSale}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              {(result.ownerName || result.brokerName) && (
                <div className="rounded-md border">
                  <div className="border-b px-3 py-2 bg-muted/30">
                    <h3 className="text-xs font-semibold flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      Contact Information
                    </h3>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-3 text-sm">
                    {result.ownerName && (
                      <div>
                        <span className="text-xs text-muted-foreground">Owner</span>
                        <p className="font-medium">{result.ownerName}</p>
                        {result.ownerRole && (
                          <p className="text-xs text-muted-foreground">{result.ownerRole}</p>
                        )}
                        {result.ownerEmail && (
                          <p className="text-xs">{result.ownerEmail}</p>
                        )}
                      </div>
                    )}
                    {result.brokerName && (
                      <div>
                        <span className="text-xs text-muted-foreground">Broker</span>
                        <p className="font-medium">{result.brokerName}</p>
                        {result.brokerCompany && (
                          <p className="text-xs text-muted-foreground">{result.brokerCompany}</p>
                        )}
                        {result.brokerEmail && (
                          <p className="text-xs">{result.brokerEmail}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Risk Flags */}
              {result.riskFlags.length > 0 && (
                <div className="rounded-md border border-amber-200 dark:border-amber-800">
                  <div className="border-b border-amber-200 dark:border-amber-800 px-3 py-2 bg-amber-50/50 dark:bg-amber-900/20">
                    <h3 className="text-xs font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      Risk Flags
                    </h3>
                  </div>
                  <div className="p-3 space-y-1">
                    {result.riskFlags.map((flag, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="text-amber-500 mt-0.5">!</span>
                        <span>{flag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Thesis Fit Assessment */}
              {result.thesisFitAssessment && (
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Thesis Fit Assessment
                  </p>
                  <p className="text-sm">{result.thesisFitAssessment}</p>
                </div>
              )}

              {/* Apply Selection */}
              <div className="rounded-md border bg-muted/10 p-3 space-y-3">
                <p className="text-xs font-medium">
                  Select fields to apply to this opportunity:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FIELD_GROUPS.map((group) => {
                    const Icon = group.icon;
                    const checked = selectedGroups.has(group.id);
                    // Hide contact option if no contact data
                    if (
                      group.id === "contact" &&
                      !result.ownerName &&
                      !result.brokerName
                    ) {
                      return null;
                    }
                    return (
                      <label
                        key={group.id}
                        className={`flex items-start gap-2 rounded-md border p-2 cursor-pointer transition-colors ${
                          checked
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-muted-foreground/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroup(group.id)}
                          className="mt-0.5 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <Icon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium">
                              {group.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {group.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Applied Success */}
          {applied && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm font-medium">
                CIM data applied successfully
              </p>
              <p className="text-xs text-muted-foreground">
                The opportunity has been updated with the selected fields.
              </p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {hasResult && !applied && (
          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-[10px] text-muted-foreground">
              {analyzeMutation.data?.inputTokens?.toLocaleString()} tokens in /{" "}
              {analyzeMutation.data?.outputTokens?.toLocaleString()} out
              {analyzeMutation.data?.cached && " (cached)"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenChange(false)}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={isApplying || selectedGroups.size === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {isApplying ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {isApplying ? "Applying..." : `Apply ${selectedGroups.size} Groups`}
              </button>
            </div>
          </div>
        )}

        {/* Close button when applied */}
        {applied && (
          <div className="flex justify-end pt-3 border-t">
            <button
              onClick={() => handleOpenChange(false)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
