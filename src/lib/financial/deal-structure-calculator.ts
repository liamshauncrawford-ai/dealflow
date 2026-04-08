/**
 * Deal Structure Calculator — 3-scenario SBA financing model.
 *
 * Pure math, no API calls, no database access.
 * Builds on pmt() from valuation-engine.ts.
 *
 * Scenarios:
 *   1. All Cash — full capital deployment, no debt
 *   2. SBA 7(a) + Seller Note — 10% down, 80% SBA, 10% seller note
 *   3. SBA + Seller Note + Earnout — reduces SBA by earnout %
 */

import { pmt } from "./valuation-engine";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type EarningsType = "SDE" | "EBITDA" | "OwnerBenefit" | "Unknown";

export interface DealStructureInput {
  askingPrice: number;
  ebitda: number;
  earningsType: EarningsType;
  revenue: number | null;
  purchasePriceAdj: number;
  sbaInterestRate: number;
  sbaLoanTermYears: number;
  sellerNoteRate: number;
  sellerNoteTermYears: number;
  earnoutPct: number;
  transactionCosts: number;
  workingCapitalMonths: number;
  monthlyOperatingExpense: number | null;
  ownerReplacementSalary: number;
  pmsBurnRate: number;
}

export interface EarningsAdjustment {
  original: number;
  adjusted: number;
  deduction: number;
}

export interface DealScenario {
  name: string;
  purchasePrice: number;
  capitalDeployed: number;
  totalOutOfPocket: number;
  downPayment: number;
  sbaLoanAmount: number;
  monthlyDebtService: number;
  annualDebtService: number;
  sellerNoteAmount: number;
  earnoutAmount: number;
  dscr: number | null;
  dscrPassing: boolean;
  netAnnualCashFlow: number;
  pmsBridgeMonths: number;
  workingCapitalReserve: number;
  transactionCosts: number;
}

export interface DealStructureResult {
  adjustedEbitda: number;
  earningsAdjustment: EarningsAdjustment | null;
  scenarios: DealScenario[];
}

// ─────────────────────────────────────────────
// SDE types that require owner salary deduction
// ─────────────────────────────────────────────

const SDE_TYPES: Set<string> = new Set(["SDE", "OwnerBenefit"]);

// ─────────────────────────────────────────────
// Calculator
// ─────────────────────────────────────────────

export function calculateDealStructure(
  input: DealStructureInput,
): DealStructureResult {
  // ── SDE → EBITDA adjustment ──
  let adjustedEbitda = input.ebitda;
  let earningsAdjustment: EarningsAdjustment | null = null;

  if (SDE_TYPES.has(input.earningsType)) {
    adjustedEbitda = input.ebitda - input.ownerReplacementSalary;
    earningsAdjustment = {
      original: input.ebitda,
      adjusted: adjustedEbitda,
      deduction: input.ownerReplacementSalary,
    };
  }

  const purchasePrice = input.askingPrice * input.purchasePriceAdj;
  const workingCapitalReserve =
    input.monthlyOperatingExpense !== null
      ? input.monthlyOperatingExpense * input.workingCapitalMonths
      : 0;

  // ── Scenario 1: All Cash ──
  const s1Capital = purchasePrice + input.transactionCosts + workingCapitalReserve;
  const s1: DealScenario = {
    name: "All Cash",
    purchasePrice,
    capitalDeployed: s1Capital,
    totalOutOfPocket: s1Capital,
    downPayment: purchasePrice,
    sbaLoanAmount: 0,
    monthlyDebtService: 0,
    annualDebtService: 0,
    sellerNoteAmount: 0,
    earnoutAmount: 0,
    dscr: null,
    dscrPassing: true,
    netAnnualCashFlow: adjustedEbitda,
    pmsBridgeMonths: adjustedEbitda > 0
      ? (adjustedEbitda / 12) / input.pmsBurnRate
      : 0,
    workingCapitalReserve,
    transactionCosts: input.transactionCosts,
  };

  // ── Scenario 2: SBA 7(a) + Seller Note ──
  const s2Down = purchasePrice * 0.10;
  const s2SBA = purchasePrice * 0.80;
  const s2Note = purchasePrice * 0.10;

  const s2MonthlySBA = pmt(
    input.sbaInterestRate / 12,
    input.sbaLoanTermYears * 12,
    s2SBA,
  );
  const s2MonthlyNote = pmt(
    input.sellerNoteRate / 12,
    input.sellerNoteTermYears * 12,
    s2Note,
  );
  const s2MonthlyTotal = s2MonthlySBA + s2MonthlyNote;
  const s2AnnualDebt = s2MonthlyTotal * 12;
  const s2DSCR = s2AnnualDebt > 0 ? adjustedEbitda / s2AnnualDebt : null;
  const s2Net = adjustedEbitda - s2AnnualDebt;

  const s2: DealScenario = {
    name: "SBA 7(a) + Seller Note",
    purchasePrice,
    capitalDeployed: purchasePrice + input.transactionCosts + workingCapitalReserve,
    totalOutOfPocket: s2Down + input.transactionCosts + workingCapitalReserve,
    downPayment: s2Down,
    sbaLoanAmount: s2SBA,
    monthlyDebtService: s2MonthlyTotal,
    annualDebtService: s2AnnualDebt,
    sellerNoteAmount: s2Note,
    earnoutAmount: 0,
    dscr: s2DSCR,
    dscrPassing: s2DSCR !== null && s2DSCR >= 1.25,
    netAnnualCashFlow: s2Net,
    pmsBridgeMonths: s2Net > 0 ? (s2Net / 12) / input.pmsBurnRate : 0,
    workingCapitalReserve,
    transactionCosts: input.transactionCosts,
  };

  // ── Scenario 3: SBA + Seller Note + Earnout ──
  const s3Earnout = purchasePrice * input.earnoutPct;
  const s3Down = purchasePrice * 0.10;
  const s3SBA = purchasePrice * (0.80 - input.earnoutPct);
  const s3Note = purchasePrice * 0.10;

  const s3MonthlySBA = pmt(
    input.sbaInterestRate / 12,
    input.sbaLoanTermYears * 12,
    s3SBA,
  );
  const s3MonthlyNote = pmt(
    input.sellerNoteRate / 12,
    input.sellerNoteTermYears * 12,
    s3Note,
  );
  const s3MonthlyTotal = s3MonthlySBA + s3MonthlyNote;
  const s3AnnualDebt = s3MonthlyTotal * 12;
  const s3DSCR = s3AnnualDebt > 0 ? adjustedEbitda / s3AnnualDebt : null;
  const s3Net = adjustedEbitda - s3AnnualDebt;

  const s3: DealScenario = {
    name: "SBA + Seller Note + Earnout",
    purchasePrice,
    capitalDeployed: purchasePrice + input.transactionCosts + workingCapitalReserve,
    totalOutOfPocket: s3Down + input.transactionCosts + workingCapitalReserve,
    downPayment: s3Down,
    sbaLoanAmount: s3SBA,
    monthlyDebtService: s3MonthlyTotal,
    annualDebtService: s3AnnualDebt,
    sellerNoteAmount: s3Note,
    earnoutAmount: s3Earnout,
    dscr: s3DSCR,
    dscrPassing: s3DSCR !== null && s3DSCR >= 1.25,
    netAnnualCashFlow: s3Net,
    pmsBridgeMonths: s3Net > 0 ? (s3Net / 12) / input.pmsBurnRate : 0,
    workingCapitalReserve,
    transactionCosts: input.transactionCosts,
  };

  return {
    adjustedEbitda,
    earningsAdjustment,
    scenarios: [s1, s2, s3],
  };
}
