"use client";

import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface FinancialsLinkCardProps {
  opportunityId: string;
  latestFinancials: any | null;
  financialPeriodCount: number;
}

export function FinancialsLinkCard({
  opportunityId,
  latestFinancials,
  financialPeriodCount,
}: FinancialsLinkCardProps) {
  const hasData = latestFinancials && financialPeriodCount > 0;

  return (
    <Link
      href={`/pipeline/${opportunityId}/financials`}
      className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Financials</h3>
          {hasData && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              {financialPeriodCount} period{financialPeriodCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>

      {hasData ? (
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="font-medium tabular-nums">
              {formatCurrency(latestFinancials.totalRevenue ? Number(latestFinancials.totalRevenue) : null)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Adj. EBITDA</p>
            <p className="font-medium tabular-nums">
              {formatCurrency(latestFinancials.adjustedEbitda ? Number(latestFinancials.adjustedEbitda) : null)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">SDE</p>
            <p className="font-medium tabular-nums">
              {formatCurrency(latestFinancials.sde ? Number(latestFinancials.sde) : null)}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Add P&L data, add-backs, and DSCR analysis
        </p>
      )}
    </Link>
  );
}
