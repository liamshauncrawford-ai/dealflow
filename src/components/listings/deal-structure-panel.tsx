"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  calculateDealStructure,
  type DealScenario,
  type EarningsType,
} from "@/lib/financial/deal-structure-calculator";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface DealStructurePanelProps {
  askingPrice: number | null;
  ebitda: number | null;
  earningsType: string | null;
  revenue: number | null;
  pmsBurnRate?: number;
  ownerReplacementSalary?: number;
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

function DscrBadge({ dscr }: { dscr: number | null }) {
  if (dscr === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
        N/A
      </span>
    );
  }

  const color =
    dscr >= 1.25
      ? "bg-green-100 text-green-800"
      : dscr >= 1.0
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", color)}>
      {dscr.toFixed(2)}x
    </span>
  );
}

function PmsBridge({ months }: { months: number }) {
  const color =
    months >= 6
      ? "text-green-700"
      : months >= 3
        ? "text-yellow-700"
        : "text-red-700";

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">PMS Bridge Runway</span>
      <span className={cn("text-lg font-bold tabular-nums", color)}>
        {months.toFixed(1)} months
      </span>
    </div>
  );
}

const scenarioColors: Record<number, string> = {
  0: "bg-blue-50",
  1: "bg-green-50",
  2: "bg-purple-50",
};

function ScenarioCard({ scenario, index }: { scenario: DealScenario; index: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className={cn("rounded-md px-3 py-2 mb-3 -mx-1 -mt-1", scenarioColors[index])}>
        <h4 className="text-sm font-semibold">{scenario.name}</h4>
      </div>

      <div className="space-y-0.5">
        <DataRow label="Purchase Price" value={fmt.format(scenario.purchasePrice)} />
        <DataRow
          label={index === 0 ? "Capital Required" : "Down Payment"}
          value={fmt.format(scenario.downPayment)}
        />
        {scenario.sbaLoanAmount > 0 && (
          <DataRow label="SBA Loan Amount" value={fmt.format(scenario.sbaLoanAmount)} />
        )}
        {scenario.sellerNoteAmount > 0 && (
          <DataRow label="Seller Note" value={fmt.format(scenario.sellerNoteAmount)} />
        )}
        {scenario.earnoutAmount > 0 && (
          <DataRow label="Earnout" value={fmt.format(scenario.earnoutAmount)} />
        )}

        <div className="border-t my-2" />

        <DataRow label="Monthly Debt Service" value={fmt.format(scenario.monthlyDebtService)} />
        <DataRow label="Annual Debt Service" value={fmt.format(scenario.annualDebtService)} />

        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-muted-foreground">DSCR</span>
          <DscrBadge dscr={scenario.dscr} />
        </div>

        <div className="border-t my-2" />

        <DataRow label="Net Annual Cash Flow" value={fmt.format(scenario.netAnnualCashFlow)} />
        <PmsBridge months={scenario.pmsBridgeMonths} />
        <DataRow label="Total Out-of-Pocket at Close" value={fmt.format(scenario.totalOutOfPocket)} />
      </div>
    </div>
  );
}

export function DealStructurePanel({
  askingPrice,
  ebitda,
  earningsType,
  revenue,
  pmsBurnRate = 28_583,
  ownerReplacementSalary = 95_000,
}: DealStructurePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [interestRate, setInterestRate] = useState(8.5);
  const [priceAdjPercent, setPriceAdjPercent] = useState(90);

  const result = useMemo(() => {
    if (askingPrice === null || ebitda === null) return null;

    return calculateDealStructure({
      askingPrice,
      ebitda,
      earningsType: (earningsType ?? "Unknown") as EarningsType,
      revenue,
      purchasePriceAdj: priceAdjPercent / 100,
      sbaInterestRate: interestRate / 100,
      sbaLoanTermYears: 10,
      sellerNoteRate: 0.06,
      sellerNoteTermYears: 5,
      earnoutPct: 0.15,
      transactionCosts: 25_000,
      workingCapitalMonths: 3,
      monthlyOperatingExpense: null,
      ownerReplacementSalary,
      pmsBurnRate,
    });
  }, [askingPrice, ebitda, earningsType, revenue, interestRate, priceAdjPercent, ownerReplacementSalary, pmsBurnRate]);

  if (askingPrice === null || ebitda === null) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Deal Structure Calculator
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">
          Financial data required to run deal structure analysis.
        </p>
      </div>
    );
  }

  const adjustedPrice = askingPrice * (priceAdjPercent / 100);

  return (
    <div className="rounded-lg border bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Deal Structure Calculator
        </h3>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {isExpanded && result && (
        <div className="mt-4 space-y-4">
          {/* SDE adjustment banner */}
          {result.earningsAdjustment && (
            <div className="rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              SDE {fmt.format(result.earningsAdjustment.original)} → Adjusted EBITDA{" "}
              {fmt.format(result.earningsAdjustment.adjusted)} (−
              {fmt.format(result.earningsAdjustment.deduction)} owner replacement salary)
            </div>
          )}

          {/* Slider row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <label className="text-muted-foreground">Interest Rate</label>
                <span className="font-medium tabular-nums">{interestRate.toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min={6.5}
                max={10.5}
                step={0.25}
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <label className="text-muted-foreground">Purchase Price</label>
                <span className="font-medium tabular-nums">
                  {priceAdjPercent}% ({fmt.format(adjustedPrice)})
                </span>
              </div>
              <input
                type="range"
                min={80}
                max={100}
                step={5}
                value={priceAdjPercent}
                onChange={(e) => setPriceAdjPercent(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </div>

          {/* Scenario cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.scenarios.map((scenario, i) => (
              <ScenarioCard key={scenario.name} scenario={scenario} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
