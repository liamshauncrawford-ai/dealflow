import { NextRequest, NextResponse } from "next/server";
import { dscrInputSchema } from "@/lib/validations/financials";

/**
 * DSCR (Debt Service Coverage Ratio) computation endpoint.
 *
 * Pure math — no database access needed. Computes loan amortization,
 * DSCR ratio, max debt capacity, and cash flow waterfall.
 */

interface DSCRResult {
  purchasePrice: number;
  equityRequired: number;
  loanAmount: number;
  monthlyPayment: number;
  annualDebtService: number;
  dscr: number;
  maxLoanAtTargetDSCR: number;
  targetDSCR: number;
  cashFlowWaterfall: {
    adjustedCashFlow: number;
    lessDebtService: number;
    lessManagementSalary: number;
    lessCapexReserve: number;
    freeCashFlow: number;
    freeCashFlowMargin: number;
  };
  scenarios: ScenarioResult[];
}

interface ScenarioResult {
  label: string;
  rate: number;
  termYears: number;
  equityPct: number;
  monthlyPayment: number;
  annualDebtService: number;
  dscr: number;
  maxLoan: number;
}

/**
 * Standard loan amortization: M = P * [r(1+r)^n] / [(1+r)^n - 1]
 */
function computeMonthlyPayment(
  principal: number,
  annualRate: number,
  termYears: number
): number {
  if (principal <= 0 || annualRate <= 0 || termYears <= 0) return 0;

  const monthlyRate = annualRate / 12;
  const totalPayments = termYears * 12;
  const factor = Math.pow(1 + monthlyRate, totalPayments);

  return principal * (monthlyRate * factor) / (factor - 1);
}

/**
 * Max loan amount at a target DSCR given cash flow and loan terms.
 */
function computeMaxLoan(
  annualCashFlow: number,
  targetDSCR: number,
  annualRate: number,
  termYears: number
): number {
  if (annualCashFlow <= 0 || targetDSCR <= 0 || annualRate <= 0 || termYears <= 0) return 0;

  const maxAnnualDebtService = annualCashFlow / targetDSCR;
  const maxMonthlyPayment = maxAnnualDebtService / 12;

  const monthlyRate = annualRate / 12;
  const totalPayments = termYears * 12;
  const factor = Math.pow(1 + monthlyRate, totalPayments);

  return maxMonthlyPayment * (factor - 1) / (monthlyRate * factor);
}

// Pre-built scenarios
const DEFAULT_SCENARIOS = [
  { label: "SBA 7(a)", rate: 0.1025, termYears: 10, equityPct: 0.10 },
  { label: "Conventional", rate: 0.075, termYears: 7, equityPct: 0.20 },
  { label: "Seller Note", rate: 0.06, termYears: 5, equityPct: 0.10 },
];

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = dscrInputSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      cashFlow,
      purchasePrice,
      equityInjectionPct,
      interestRate,
      termYears,
      managementSalary = 0,
      capexReserve = 0,
    } = parsed.data;

    const equityRequired = purchasePrice * equityInjectionPct;
    const loanAmount = purchasePrice - equityRequired;

    const monthlyPayment = computeMonthlyPayment(loanAmount, interestRate, termYears);
    const annualDebtService = monthlyPayment * 12;

    const dscr = annualDebtService > 0 ? cashFlow / annualDebtService : Infinity;

    const targetDSCR = 1.25; // SBA standard
    const maxLoanAtTargetDSCR = computeMaxLoan(cashFlow, targetDSCR, interestRate, termYears);

    const freeCashFlow = cashFlow - annualDebtService - managementSalary - capexReserve;

    // Compute scenarios
    const scenarios: ScenarioResult[] = DEFAULT_SCENARIOS.map((s) => {
      const sLoan = purchasePrice * (1 - s.equityPct);
      const sMonthly = computeMonthlyPayment(sLoan, s.rate, s.termYears);
      const sAnnual = sMonthly * 12;
      const sDscr = sAnnual > 0 ? cashFlow / sAnnual : Infinity;
      const sMaxLoan = computeMaxLoan(cashFlow, targetDSCR, s.rate, s.termYears);

      return {
        label: s.label,
        rate: s.rate,
        termYears: s.termYears,
        equityPct: s.equityPct,
        monthlyPayment: Math.round(sMonthly * 100) / 100,
        annualDebtService: Math.round(sAnnual * 100) / 100,
        dscr: Math.round(sDscr * 100) / 100,
        maxLoan: Math.round(sMaxLoan),
      };
    });

    const result: DSCRResult = {
      purchasePrice,
      equityRequired: Math.round(equityRequired),
      loanAmount: Math.round(loanAmount),
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      annualDebtService: Math.round(annualDebtService * 100) / 100,
      dscr: Math.round(dscr * 100) / 100,
      maxLoanAtTargetDSCR: Math.round(maxLoanAtTargetDSCR),
      targetDSCR,
      cashFlowWaterfall: {
        adjustedCashFlow: cashFlow,
        lessDebtService: Math.round(annualDebtService * 100) / 100,
        lessManagementSalary: managementSalary,
        lessCapexReserve: capexReserve,
        freeCashFlow: Math.round(freeCashFlow * 100) / 100,
        freeCashFlowMargin: cashFlow > 0
          ? Math.round((freeCashFlow / cashFlow) * 10000) / 10000
          : 0,
      },
      scenarios,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to compute DSCR:", error);
    return NextResponse.json(
      { error: "Failed to compute DSCR" },
      { status: 500 }
    );
  }
}
