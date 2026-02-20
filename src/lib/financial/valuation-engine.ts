/**
 * Client-side valuation engine — pure math, no API calls.
 * Used by the Valuation Calculator and Roll-Up Model pages.
 */

// ─────────────────────────────────────────────
// Core Financial Functions
// ─────────────────────────────────────────────

/** PMT — periodic payment for a loan (same as Excel PMT). Returns positive number. */
export function pmt(rate: number, nper: number, pv: number): number {
  if (rate === 0) return pv / nper;
  const factor = Math.pow(1 + rate, nper);
  return (pv * rate * factor) / (factor - 1);
}

/** Compound growth: FV = PV × (1 + rate)^periods */
export function compoundGrowth(
  pv: number,
  rate: number,
  periods: number,
): number {
  return pv * Math.pow(1 + rate, periods);
}

/** Remaining loan balance after `periodsElapsed` payments. */
export function remainingBalance(
  rate: number,
  totalPeriods: number,
  pv: number,
  periodsElapsed: number,
): number {
  if (periodsElapsed >= totalPeriods) return 0;
  if (rate === 0) return pv * (1 - periodsElapsed / totalPeriods);
  const payment = pmt(rate, totalPeriods, pv);
  const factor = Math.pow(1 + rate, periodsElapsed);
  return pv * factor - payment * ((factor - 1) / rate);
}

/**
 * IRR via Newton-Raphson iteration.
 * cashFlows[0] is typically negative (initial investment).
 * Returns annualized rate or null if no convergence.
 */
export function calculateIRR(
  cashFlows: number[],
  guess: number = 0.1,
  maxIterations: number = 100,
  tolerance: number = 1e-7,
): number | null {
  let rate = guess;
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const denom = Math.pow(1 + rate, t);
      npv += cashFlows[t] / denom;
      dnpv -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(dnpv) < 1e-12) return null;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tolerance) return newRate;
    rate = newRate;
  }
  return null;
}

// ─────────────────────────────────────────────
// Valuation Input / Output Types
// ─────────────────────────────────────────────

export interface ValuationInputs {
  // Target Company
  target_revenue: number;
  target_ebitda: number;
  target_ebitda_margin: number; // auto-calculated but user can override
  revenue_growth_rate: number;

  // Valuation
  entry_multiple: number;

  // Capital Structure
  equity_pct: number;
  bank_debt_pct: number;
  seller_note_pct: number;
  bank_interest_rate: number;
  bank_term_years: number;
  seller_note_rate: number;
  seller_note_term: number;

  // Operating Assumptions
  owner_salary: number;
  existing_owner_excess_comp: number;
  one_time_adjustments: number;
  capex_annual: number;
  working_capital_pct: number;
  tax_rate: number;

  // Growth / Synergy
  year_2_bolt_on_revenue: number;
  year_2_bolt_on_cost: number;
  synergy_sg_a_savings: number;
  synergy_procurement: number;
  synergy_cross_sell_pct: number;

  // Exit
  exit_year: number;
  exit_multiple: number;
}

export const DEFAULT_INPUTS: ValuationInputs = {
  target_revenue: 0,
  target_ebitda: 0,
  target_ebitda_margin: 0,
  revenue_growth_rate: 0.05,
  entry_multiple: 4.0,
  equity_pct: 0.25,
  bank_debt_pct: 0.60,
  seller_note_pct: 0.15,
  bank_interest_rate: 0.085,
  bank_term_years: 10,
  seller_note_rate: 0.06,
  seller_note_term: 5,
  owner_salary: 200_000,
  existing_owner_excess_comp: 0,
  one_time_adjustments: 0,
  capex_annual: 0,
  working_capital_pct: 0.10,
  tax_rate: 0.25,
  year_2_bolt_on_revenue: 0,
  year_2_bolt_on_cost: 0,
  synergy_sg_a_savings: 0,
  synergy_procurement: 0,
  synergy_cross_sell_pct: 0,
  exit_year: 7,
  exit_multiple: 7.0,
};

export interface DealStructure {
  enterprise_value: number;
  equity_check: number;
  bank_debt: number;
  seller_note: number;
}

export interface DebtService {
  bank_annual_payment: number;
  seller_annual_payment: number;
  total_annual_debt_service: number;
  bank_monthly_payment: number;
  seller_monthly_payment: number;
}

export interface CashFlowSummary {
  adjusted_ebitda: number;
  pre_tax_cash_flow: number;
  after_tax_cash_flow: number;
  dscr: number;
}

export interface ProjectionYear {
  year: number;
  revenue: number;
  ebitda_margin: number;
  ebitda: number;
  synergies: number;
  adjusted_ebitda: number;
  debt_service: number;
  capex: number;
  pre_tax_cf: number;
  taxes: number;
  free_cash_flow: number;
  cumulative_fcf: number;
  remaining_debt: number;
  implied_ev: number;
  equity_value: number;
  moic: number;
}

export interface ExitAnalysis {
  exit_revenue: number;
  exit_ebitda: number;
  exit_ev: number;
  remaining_debt_at_exit: number;
  equity_to_buyer: number;
  cumulative_fcf: number;
  total_return: number;
  moic: number;
  irr: number | null;
}

export interface ValuationOutputs {
  deal: DealStructure;
  debt: DebtService;
  cashFlow: CashFlowSummary;
  projection: ProjectionYear[];
  exit: ExitAnalysis;
}

// ─────────────────────────────────────────────
// Main Calculation Engine
// ─────────────────────────────────────────────

export function calculateValuation(inputs: ValuationInputs): ValuationOutputs {
  // Deal Structure
  const enterprise_value = inputs.target_ebitda * inputs.entry_multiple;
  const equity_check = enterprise_value * inputs.equity_pct;
  const bank_debt = enterprise_value * inputs.bank_debt_pct;
  const seller_note = enterprise_value * inputs.seller_note_pct;

  const deal: DealStructure = {
    enterprise_value,
    equity_check,
    bank_debt,
    seller_note,
  };

  // Debt Service
  const bank_annual = bank_debt > 0
    ? pmt(inputs.bank_interest_rate, inputs.bank_term_years, bank_debt)
    : 0;
  const seller_annual = seller_note > 0
    ? pmt(inputs.seller_note_rate, inputs.seller_note_term, seller_note)
    : 0;

  const debt: DebtService = {
    bank_annual_payment: bank_annual,
    seller_annual_payment: seller_annual,
    total_annual_debt_service: bank_annual + seller_annual,
    bank_monthly_payment: bank_annual / 12,
    seller_monthly_payment: seller_annual / 12,
  };

  // Adjusted EBITDA (Year 1)
  const adjusted_ebitda =
    inputs.target_ebitda +
    inputs.existing_owner_excess_comp +
    inputs.one_time_adjustments -
    inputs.owner_salary;
  const pre_tax_cf = adjusted_ebitda - debt.total_annual_debt_service - inputs.capex_annual;
  const after_tax_cf = pre_tax_cf * (1 - inputs.tax_rate);
  const dscr = debt.total_annual_debt_service > 0
    ? adjusted_ebitda / debt.total_annual_debt_service
    : Infinity;

  const cashFlow: CashFlowSummary = {
    adjusted_ebitda,
    pre_tax_cash_flow: pre_tax_cf,
    after_tax_cash_flow: after_tax_cf,
    dscr,
  };

  // 5-Year+ Projection
  const projection = generateProjection(inputs, deal, debt);

  // Exit Analysis
  const exitYear = projection.find((p) => p.year === inputs.exit_year);
  const exit_revenue = exitYear?.revenue ?? compoundGrowth(
    inputs.target_revenue,
    inputs.revenue_growth_rate,
    inputs.exit_year,
  );
  const margin = inputs.target_ebitda_margin + (inputs.exit_year >= 3 ? 0.02 : 0);
  const exit_ebitda = exitYear?.adjusted_ebitda ?? exit_revenue * margin;
  const exit_ev = exit_ebitda * inputs.exit_multiple;
  const remaining_debt_at_exit =
    remainingBalance(inputs.bank_interest_rate, inputs.bank_term_years, bank_debt, inputs.exit_year) +
    remainingBalance(inputs.seller_note_rate, inputs.seller_note_term, seller_note, inputs.exit_year);
  const cumulative_fcf = exitYear?.cumulative_fcf ?? 0;
  const equity_to_buyer = exit_ev - remaining_debt_at_exit;
  const total_return = equity_to_buyer + cumulative_fcf;
  const moic = equity_check > 0 ? total_return / equity_check : 0;

  // IRR: cash flows = [-equity_check, FCF_y1, FCF_y2, ..., FCF_yN + equity_at_exit]
  const irrFlows: number[] = [-equity_check];
  for (let y = 0; y < Math.min(inputs.exit_year, projection.length); y++) {
    const isExitYear = y === inputs.exit_year - 1;
    const fcf = projection[y]?.free_cash_flow ?? 0;
    irrFlows.push(isExitYear ? fcf + equity_to_buyer : fcf);
  }
  const irr = calculateIRR(irrFlows);

  const exit: ExitAnalysis = {
    exit_revenue,
    exit_ebitda,
    exit_ev,
    remaining_debt_at_exit,
    equity_to_buyer,
    cumulative_fcf,
    total_return,
    moic,
    irr,
  };

  return { deal, debt, cashFlow, projection, exit };
}

function generateProjection(
  inputs: ValuationInputs,
  deal: DealStructure,
  debt: DebtService,
): ProjectionYear[] {
  const years: ProjectionYear[] = [];
  const maxYear = Math.max(inputs.exit_year, 10);

  for (let y = 1; y <= maxYear; y++) {
    const prev = y === 1 ? null : years[y - 2];

    const revenue =
      y === 1
        ? inputs.target_revenue
        : (prev?.revenue ?? 0) * (1 + inputs.revenue_growth_rate) +
          (y === 2 ? inputs.year_2_bolt_on_revenue : 0);

    // 2% margin expansion starting year 3
    const ebitda_margin = inputs.target_ebitda_margin + (y >= 3 ? 0.02 : 0);
    const ebitda = revenue * ebitda_margin;

    const synergies =
      y >= 2
        ? inputs.synergy_sg_a_savings +
          inputs.synergy_procurement +
          revenue * inputs.synergy_cross_sell_pct
        : 0;

    const adjusted_ebitda = ebitda + synergies - inputs.owner_salary;

    // Debt service (uses amortizing schedule)
    const bank_remaining = remainingBalance(
      inputs.bank_interest_rate,
      inputs.bank_term_years,
      deal.bank_debt,
      y - 1,
    );
    const seller_remaining = remainingBalance(
      inputs.seller_note_rate,
      inputs.seller_note_term,
      deal.seller_note,
      y - 1,
    );
    const bank_payment = bank_remaining > 0 ? debt.bank_annual_payment : 0;
    const seller_payment = seller_remaining > 0 ? debt.seller_annual_payment : 0;
    const debt_service = bank_payment + seller_payment;

    const capex = inputs.capex_annual;
    const pre_tax_cf = adjusted_ebitda - debt_service - capex;
    const taxes = Math.max(0, pre_tax_cf * inputs.tax_rate);
    const free_cash_flow = pre_tax_cf - taxes;
    const cumulative_fcf = (prev?.cumulative_fcf ?? 0) + free_cash_flow;

    const remaining_debt =
      remainingBalance(inputs.bank_interest_rate, inputs.bank_term_years, deal.bank_debt, y) +
      remainingBalance(inputs.seller_note_rate, inputs.seller_note_term, deal.seller_note, y);

    const implied_ev = adjusted_ebitda * inputs.exit_multiple;
    const equity_value = implied_ev - remaining_debt;
    const moic = deal.equity_check > 0
      ? (equity_value + cumulative_fcf) / deal.equity_check
      : 0;

    years.push({
      year: y,
      revenue,
      ebitda_margin,
      ebitda,
      synergies,
      adjusted_ebitda,
      debt_service,
      capex,
      pre_tax_cf,
      taxes,
      free_cash_flow,
      cumulative_fcf,
      remaining_debt,
      implied_ev,
      equity_value,
      moic,
    });
  }

  return years;
}

// ─────────────────────────────────────────────
// Sensitivity Analysis
// ─────────────────────────────────────────────

export interface SensitivityCell {
  rowLabel: string;
  colLabel: string;
  value: number;
}

/**
 * Generate a 2D sensitivity table.
 * Varies two input parameters across ranges and computes a target metric.
 */
export function generateSensitivityTable(
  baseInputs: ValuationInputs,
  rowParam: keyof ValuationInputs,
  rowValues: number[],
  colParam: keyof ValuationInputs,
  colValues: number[],
  metric: (outputs: ValuationOutputs) => number,
): { rows: string[]; cols: string[]; data: number[][] } {
  const data: number[][] = [];

  for (const rv of rowValues) {
    const row: number[] = [];
    for (const cv of colValues) {
      const tweaked = { ...baseInputs, [rowParam]: rv, [colParam]: cv };
      // Recalculate margin if revenue/ebitda changed
      if (
        (rowParam === "target_revenue" || rowParam === "target_ebitda" ||
         colParam === "target_revenue" || colParam === "target_ebitda") &&
        tweaked.target_revenue > 0
      ) {
        tweaked.target_ebitda_margin = tweaked.target_ebitda / tweaked.target_revenue;
      }
      const outputs = calculateValuation(tweaked);
      row.push(metric(outputs));
    }
    data.push(row);
  }

  return {
    rows: rowValues.map(String),
    cols: colValues.map(String),
    data,
  };
}
