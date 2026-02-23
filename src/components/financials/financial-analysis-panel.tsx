"use client";

import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Lightbulb,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

export interface FinancialAnalysis {
  summary: string;
  qualityScore: number;
  insights: string[];
  redFlags: string[];
  growthAnalysis: string;
  marginAnalysis: string;
  recommendations: string[];
}

interface FinancialAnalysisPanelProps {
  analysis: FinancialAnalysis;
  isLoading?: boolean;
}

function QualityBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : score >= 5
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}/10
    </span>
  );
}

export function FinancialAnalysisPanel({ analysis, isLoading }: FinancialAnalysisPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          <p className="text-sm text-muted-foreground">Analyzing financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between border-b px-4 py-3 text-left hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">AI Financial Analysis</h3>
          <QualityBadge score={analysis.qualityScore} />
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Executive Summary */}
          <div className="rounded-md bg-muted/30 p-3">
            <p className="text-sm leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Insights + Red Flags side by side */}
          <div className="grid gap-4 sm:grid-cols-2">
            {analysis.insights.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb className="h-3.5 w-3.5 text-blue-500" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Key Insights
                  </h4>
                </div>
                <ul className="space-y-1.5">
                  {analysis.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.redFlags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Red Flags
                  </h4>
                </div>
                <ul className="space-y-1.5">
                  {analysis.redFlags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Growth + Margin Analysis */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Growth Analysis
                </h4>
              </div>
              <p className="text-sm leading-relaxed">{analysis.growthAnalysis}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-violet-500" />
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Margin Analysis
                </h4>
              </div>
              <p className="text-sm leading-relaxed">{analysis.marginAnalysis}</p>
            </div>
          </div>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="rounded-md border bg-primary/5 p-3">
              <h4 className="text-xs font-medium text-primary uppercase tracking-wide mb-2">
                Recommendations
              </h4>
              <ul className="space-y-1.5">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5 shrink-0">{i + 1}.</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
