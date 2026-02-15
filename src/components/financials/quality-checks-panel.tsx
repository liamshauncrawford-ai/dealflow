"use client";

import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { runQualityChecks, type QualityCheck } from "@/lib/financial/quality-checks";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface QualityChecksPanelProps {
  periods: any[];
}

const SEVERITY_CONFIG = {
  error: {
    icon: AlertCircle,
    bg: "bg-red-50 dark:bg-red-900/10",
    border: "border-red-200 dark:border-red-800",
    iconColor: "text-red-600 dark:text-red-400",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 dark:bg-amber-900/10",
    border: "border-amber-200 dark:border-amber-800",
    iconColor: "text-amber-600 dark:text-amber-400",
    label: "Warning",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 dark:bg-blue-900/10",
    border: "border-blue-200 dark:border-blue-800",
    iconColor: "text-blue-600 dark:text-blue-400",
    label: "Info",
  },
};

function CheckItem({ check }: { check: QualityCheck }) {
  const config = SEVERITY_CONFIG[check.severity];
  const Icon = config.icon;

  return (
    <div className={`flex gap-2.5 rounded-md border p-3 ${config.bg} ${config.border}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.iconColor}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{check.title}</p>
        <p className="text-xs text-muted-foreground">{check.message}</p>
      </div>
    </div>
  );
}

export function QualityChecksPanel({ periods }: QualityChecksPanelProps) {
  const checks = runQualityChecks(periods);

  const errorCount = checks.filter((c) => c.severity === "error").length;
  const warningCount = checks.filter((c) => c.severity === "warning").length;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold text-sm">Quality Checks</h3>
        <div className="flex items-center gap-2 text-xs">
          {errorCount > 0 && (
            <span className="text-red-600 dark:text-red-400">{errorCount} error{errorCount > 1 ? "s" : ""}</span>
          )}
          {warningCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400">{warningCount} warning{warningCount > 1 ? "s" : ""}</span>
          )}
          {errorCount === 0 && warningCount === 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">All clear</span>
          )}
        </div>
      </div>
      <div className="p-4 space-y-2">
        {checks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No issues found.</p>
        ) : (
          checks.map((check) => <CheckItem key={check.id} check={check} />)
        )}
      </div>
    </div>
  );
}
