"use client";

import { useState, useEffect } from "react";
import { Calculator } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useComputeDSCR } from "@/hooks/use-financials";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DSCRPanelProps {
  opportunityId: string;
  period: any;
}

const SCENARIOS = [
  { label: "SBA 7(a)", rate: 10.25, term: 10, equity: 10 },
  { label: "Conventional", rate: 7.5, term: 7, equity: 20 },
  { label: "Seller Note", rate: 6.0, term: 5, equity: 10 },
  { label: "Custom", rate: 8.0, term: 10, equity: 15 },
];

function dscrColor(dscr: number): string {
  if (dscr >= 1.5) return "text-emerald-600 dark:text-emerald-400";
  if (dscr >= 1.25) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function DSCRPanel({ opportunityId, period }: DSCRPanelProps) {
  const computeDSCR = useComputeDSCR(opportunityId);

  const adjustedEbitda = Number(period.adjustedEbitda ?? period.ebitda ?? 0);

  const [activeTab, setActiveTab] = useState(0);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [rate, setRate] = useState(SCENARIOS[0].rate);
  const [term, setTerm] = useState(SCENARIOS[0].term);
  const [equity, setEquity] = useState(SCENARIOS[0].equity);
  const [mgmtSalary, setMgmtSalary] = useState("120000");
  const [capexReserve, setCapexReserve] = useState("25000");
  const [result, setResult] = useState<any>(null);

  // Auto-estimate purchase price from Adj EBITDA * 4x
  useEffect(() => {
    if (!purchasePrice && adjustedEbitda > 0) {
      setPurchasePrice(String(Math.round(adjustedEbitda * 4)));
    }
  }, [adjustedEbitda, purchasePrice]);

  // Update scenario params when tab changes
  useEffect(() => {
    if (activeTab < 3) {
      setRate(SCENARIOS[activeTab].rate);
      setTerm(SCENARIOS[activeTab].term);
      setEquity(SCENARIOS[activeTab].equity);
    }
  }, [activeTab]);

  async function handleCompute() {
    const pp = parseFloat(purchasePrice);
    if (!pp || adjustedEbitda <= 0) return;

    const res = await computeDSCR.mutateAsync({
      cashFlow: adjustedEbitda,
      purchasePrice: pp,
      equityInjectionPct: equity / 100,
      interestRate: rate / 100,
      termYears: term,
      managementSalary: parseFloat(mgmtSalary) || 0,
      capexReserve: parseFloat(capexReserve) || 0,
    });
    setResult(res);
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          <Calculator className="h-4 w-4" />
          DSCR Calculator
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Scenario Tabs */}
        <div className="flex gap-1 rounded-md border p-0.5">
          {SCENARIOS.map((s, idx) => (
            <button
              key={s.label}
              onClick={() => setActiveTab(idx)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                activeTab === idx
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Cash Flow (Adj. EBITDA)</label>
            <div className="rounded-md border bg-muted/50 px-3 py-1.5 text-sm tabular-nums">
              {formatCurrency(adjustedEbitda)}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Purchase Price</label>
            <input
              type="number"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              placeholder="$3,000,000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Interest Rate (%)</label>
            <input
              type="number"
              value={rate}
              onChange={(e) => { setRate(parseFloat(e.target.value)); setActiveTab(3); }}
              step={0.25}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Term (Years)</label>
            <input
              type="number"
              value={term}
              onChange={(e) => { setTerm(parseInt(e.target.value)); setActiveTab(3); }}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Equity (%)</label>
            <input
              type="number"
              value={equity}
              onChange={(e) => { setEquity(parseFloat(e.target.value)); setActiveTab(3); }}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Mgmt Salary</label>
            <input
              type="number"
              value={mgmtSalary}
              onChange={(e) => setMgmtSalary(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleCompute}
          disabled={computeDSCR.isPending || !purchasePrice}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {computeDSCR.isPending ? "Computing..." : "Calculate DSCR"}
        </button>

        {/* Results */}
        {result && (
          <div className="space-y-3 rounded-md border p-3">
            {/* DSCR headline */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Debt Service Coverage Ratio</p>
              <p className={`text-3xl font-bold tabular-nums ${dscrColor(result.dscr)}`}>
                {result.dscr === Infinity ? "N/A" : `${result.dscr.toFixed(2)}x`}
              </p>
              <p className="text-xs text-muted-foreground">
                {result.dscr >= 1.25 ? "Meets SBA 1.25x threshold" : "Below SBA 1.25x threshold"}
              </p>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Loan Amount</span>
                <p className="font-medium tabular-nums">{formatCurrency(result.loanAmount)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Equity Required</span>
                <p className="font-medium tabular-nums">{formatCurrency(result.equityRequired)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Monthly Payment</span>
                <p className="font-medium tabular-nums">{formatCurrency(result.monthlyPayment)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Max Loan @ 1.25x</span>
                <p className="font-medium tabular-nums">{formatCurrency(result.maxLoanAtTargetDSCR)}</p>
              </div>
            </div>

            {/* Cash Flow Waterfall */}
            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Cash Flow Waterfall</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Adj. EBITDA</span>
                  <span className="tabular-nums">{formatCurrency(result.cashFlowWaterfall.adjustedCashFlow)}</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>− Debt Service</span>
                  <span className="tabular-nums">({formatCurrency(result.cashFlowWaterfall.lessDebtService)})</span>
                </div>
                {result.cashFlowWaterfall.lessManagementSalary > 0 && (
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>− Mgmt Salary</span>
                    <span className="tabular-nums">({formatCurrency(result.cashFlowWaterfall.lessManagementSalary)})</span>
                  </div>
                )}
                {result.cashFlowWaterfall.lessCapexReserve > 0 && (
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>− Capex Reserve</span>
                    <span className="tabular-nums">({formatCurrency(result.cashFlowWaterfall.lessCapexReserve)})</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Free Cash Flow</span>
                  <span className={`tabular-nums ${result.cashFlowWaterfall.freeCashFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {formatCurrency(result.cashFlowWaterfall.freeCashFlow)}
                  </span>
                </div>
              </div>
            </div>

            {/* Pre-built scenarios comparison */}
            {result.scenarios && result.scenarios.length > 0 && (
              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Scenario Comparison</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-1 text-left font-medium text-muted-foreground">Scenario</th>
                        <th className="pb-1 text-right font-medium text-muted-foreground">DSCR</th>
                        <th className="pb-1 text-right font-medium text-muted-foreground">Monthly</th>
                        <th className="pb-1 text-right font-medium text-muted-foreground">Max Loan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.scenarios.map((s: any) => (
                        <tr key={s.label} className="border-b last:border-0">
                          <td className="py-1">{s.label}</td>
                          <td className={`py-1 text-right tabular-nums font-medium ${dscrColor(s.dscr)}`}>
                            {s.dscr.toFixed(2)}x
                          </td>
                          <td className="py-1 text-right tabular-nums">{formatCurrency(s.monthlyPayment)}</td>
                          <td className="py-1 text-right tabular-nums">{formatCurrency(s.maxLoan)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
