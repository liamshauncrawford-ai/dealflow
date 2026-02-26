"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  Shield,
  DollarSign,
  Users,
  ArrowRight,
  Mail,
} from "lucide-react";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { DeepDiveResult } from "@/lib/ai/deep-dive";

interface DeepDivePanelProps {
  analysis: DeepDiveResult | null;
  createdAt?: string;
  isLoading: boolean;
  onRunAnalysis: () => void;
  onReAnalyze: () => void;
  cached: boolean;
}

const RATING_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  B: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  C: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  D: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  F: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-blue-600 dark:text-blue-400",
};

export function DeepDivePanel({
  analysis,
  createdAt,
  isLoading,
  onRunAnalysis,
  onReAnalyze,
  cached,
}: DeepDivePanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["executive_summary", "thesis_fit"])
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div>
            <p className="font-medium">Claude is analyzing this company...</p>
            <p className="text-sm text-muted-foreground">
              This typically takes 10-20 seconds
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-primary/10 p-3">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">AI Deep Dive Available</p>
            <p className="text-sm text-muted-foreground">
              Generate a comprehensive investment memo for this target
            </p>
          </div>
          <button
            onClick={onRunAnalysis}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            🤖 Run AI Deep Dive
          </button>
        </div>
      </div>
    );
  }

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rating = analysis.thesis_fit_assessment.overall_rating;

  return (
    <div className="space-y-4">
      {/* Header with rating badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold",
              RATING_COLORS[rating] ?? RATING_COLORS.C
            )}
          >
            {rating}
          </span>
          <div>
            <p className="font-semibold">AI Investment Memo</p>
            <p className="text-xs text-muted-foreground">
              Score: {analysis.thesis_fit_assessment.composite_score}/100
              {createdAt && (
                <> &middot; Generated {formatRelativeDate(createdAt)}</>
              )}
              {cached && <> &middot; Cached</>}
            </p>
          </div>
        </div>
        <button
          onClick={onReAnalyze}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Re-analyze
        </button>
      </div>

      {/* Sections */}
      <Section
        title="Executive Summary"
        sectionKey="executive_summary"
        expanded={expandedSections}
        onToggle={toggleSection}
        icon={<TrendingUp className="h-4 w-4" />}
      >
        <p className="text-sm leading-relaxed">{analysis.executive_summary}</p>
      </Section>

      <Section
        title="Thesis Fit Assessment"
        sectionKey="thesis_fit"
        expanded={expandedSections}
        onToggle={toggleSection}
        icon={<CheckCircle2 className="h-4 w-4" />}
      >
        <div className="space-y-3">
          <p className="text-sm">{analysis.thesis_fit_assessment.strategic_rationale}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Strengths</p>
              <ul className="space-y-1">
                {analysis.thesis_fit_assessment.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Weaknesses</p>
              <ul className="space-y-1">
                {analysis.thesis_fit_assessment.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Preliminary Valuation"
        sectionKey="valuation"
        expanded={expandedSections}
        onToggle={toggleSection}
        icon={<DollarSign className="h-4 w-4" />}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniStat label="Est. Revenue" value={analysis.preliminary_valuation.estimated_revenue} />
            <MiniStat label="Est. EBITDA" value={analysis.preliminary_valuation.estimated_ebitda} />
            <MiniStat label="EBITDA Margin" value={analysis.preliminary_valuation.estimated_ebitda_margin} />
            <MiniStat label="Multiple Range" value={analysis.preliminary_valuation.recommended_multiple_range} />
            <MiniStat label="Implied EV" value={analysis.preliminary_valuation.implied_ev_range} />
          </div>
          <p className="text-sm text-muted-foreground">{analysis.preliminary_valuation.valuation_rationale}</p>
          {analysis.preliminary_valuation.comparable_transactions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Comparable Transactions</p>
              <ul className="space-y-0.5">
                {analysis.preliminary_valuation.comparable_transactions.map((ct, i) => (
                  <li key={i} className="text-sm text-muted-foreground">- {ct}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Deal Structure Suggestion"
        sectionKey="deal_structure"
        expanded={expandedSections}
        onToggle={toggleSection}
        icon={<DollarSign className="h-4 w-4" />}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MiniStat label="Total EV" value={analysis.deal_structure_suggestion.total_ev} />
          <MiniStat label="Equity Required" value={analysis.deal_structure_suggestion.equity_required} />
          <MiniStat label="Bank Debt" value={analysis.deal_structure_suggestion.bank_debt} />
          <MiniStat label="Seller Note" value={analysis.deal_structure_suggestion.seller_note} />
          <MiniStat label="Monthly Debt Service" value={analysis.deal_structure_suggestion.monthly_debt_service_estimate} />
          <MiniStat label="DSCR" value={analysis.deal_structure_suggestion.debt_service_coverage_ratio} />
          <MiniStat label="Year 1 FCF" value={analysis.deal_structure_suggestion.estimated_free_cash_flow_year_1} />
          {analysis.deal_structure_suggestion.earnout_component && (
            <MiniStat label="Earnout" value={analysis.deal_structure_suggestion.earnout_component} />
          )}
        </div>
      </Section>

      <Section
        title="Synergy Analysis"
        sectionKey="synergies"
        expanded={expandedSections}
        onToggle={toggleSection}
        icon={<Users className="h-4 w-4" />}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Revenue Synergies</p>
              <ul className="space-y-0.5">
                {analysis.synergy_analysis.revenue_synergies.map((s, i) => (
                  <li key={i} className="text-sm">+ {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Cost Synergies</p>
              <ul className="space-y-0.5">
                {analysis.synergy_analysis.cost_synergies.map((s, i) => (
                  <li key={i} className="text-sm">- {s}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-sm">
            <span className="font-medium">Annual Value:</span>{" "}
            {analysis.synergy_analysis.estimated_annual_synergy_value}
          </p>
          <p className="text-sm text-muted-foreground">{analysis.synergy_analysis.synergy_timeline}</p>
        </div>
      </Section>

      <Section
        title="Platform Value Creation"
        sectionKey="platform"
        expanded={expandedSections}
        onToggle={toggleSection}
        icon={<TrendingUp className="h-4 w-4" />}
      >
        <div className="space-y-2">
          <p className="text-sm">{analysis.platform_value_creation.how_this_fits_the_platform}</p>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <InfoRow label="GC Relationship Value" value={analysis.platform_value_creation.gc_relationship_value} />
            <InfoRow label="Market Pipeline Access" value={analysis.platform_value_creation.market_pipeline_access} />
            <InfoRow label="Customer Overlap" value={analysis.platform_value_creation.customer_overlap} />
          </div>
          {analysis.platform_value_creation.cross_sell_opportunities.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Cross-sell Opportunities</p>
              <ul className="space-y-0.5">
                {analysis.platform_value_creation.cross_sell_opportunities.map((o, i) => (
                  <li key={i} className="text-sm">- {o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Risk Assessment"
        sectionKey="risks"
        expanded={expandedSections}
        onToggle={toggleSection}
        icon={<Shield className="h-4 w-4" />}
      >
        <div className="space-y-3">
          {analysis.risk_assessment.key_risks.map((risk, i) => (
            <div key={i} className="rounded-md bg-muted/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "text-xs font-medium uppercase",
                    SEVERITY_COLORS[risk.severity]
                  )}
                >
                  {risk.severity}
                </span>
                <span className="text-sm font-medium">{risk.risk}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Mitigation: {risk.mitigation}
              </p>
            </div>
          ))}
          {analysis.risk_assessment.deal_breakers &&
            analysis.risk_assessment.deal_breakers.length > 0 && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                  Potential Deal Breakers
                </p>
                <ul className="space-y-0.5">
                  {analysis.risk_assessment.deal_breakers.map((db, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      {db}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          {analysis.risk_assessment.information_gaps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Information Gaps to Resolve
              </p>
              <ul className="space-y-0.5">
                {analysis.risk_assessment.information_gaps.map((gap, i) => (
                  <li key={i} className="text-sm text-muted-foreground">? {gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Recommended Next Steps"
        sectionKey="next_steps"
        expanded={expandedSections}
        onToggle={toggleSection}
        icon={<ArrowRight className="h-4 w-4" />}
      >
        <ol className="space-y-1.5">
          {analysis.recommended_next_steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary flex-shrink-0">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title="Outreach Strategy"
        sectionKey="outreach"
        expanded={expandedSections}
        onToggle={toggleSection}
        icon={<Mail className="h-4 w-4" />}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {analysis.outreach_strategy.approach.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm italic">
            &ldquo;{analysis.outreach_strategy.suggested_opening}&rdquo;
          </p>
          <p className="text-sm text-muted-foreground">
            {analysis.outreach_strategy.timing_considerations}
          </p>
        </div>
      </Section>
    </div>
  );
}

// ─── Helper Components ───

function Section({
  title,
  sectionKey,
  expanded,
  onToggle,
  icon,
  children,
}: {
  title: string;
  sectionKey: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const isOpen = expanded.has(sectionKey);
  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => onToggle(sectionKey)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{title}</span>
      </button>
      {isOpen && <div className="border-t px-4 py-3">{children}</div>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium">{label}:</span>{" "}
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}
