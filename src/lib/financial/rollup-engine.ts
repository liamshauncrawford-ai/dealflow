/**
 * Roll-Up Model engine — models combined entity across multiple acquisitions.
 * Platform + bolt-on strategy with synergy engine and multiple arbitrage.
 */

import { pmt, remainingBalance, compoundGrowth, calculateIRR } from "./valuation-engine";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RollupCompany {
  id: string;
  name: string;
  revenue: number;
  ebitda: number;
  entry_multiple: number;
  close_year: number; // 1 = platform year, 2+ = bolt-ons
}

export interface RollupSynergies {
  sg_a_savings_per_bolton: number;
  procurement_savings_per_bolton: number;
  cross_sell_uplift_pct: number;
  recurring_revenue_conversion_pct: number;
  margin_expansion_pct: number;
}

export interface RollupExitAssumptions {
  exit_year: number;
  exit_multiple: number;
}

export interface RollupFinancing {
  equity_pct: number;
  bank_debt_pct: number;
  seller_note_pct: number;
  bank_interest_rate: number;
  bank_term_years: number;
  seller_note_rate: number;
  seller_note_term: number;
  revenue_growth_rate: number;
  owner_salary: number;
  tax_rate: number;
}

export interface RollupInputs {
  platform: RollupCompany;
  boltOns: RollupCompany[];
  synergies: RollupSynergies;
  exit: RollupExitAssumptions;
  financing: RollupFinancing;
}

export const DEFAULT_ROLLUP_INPUTS: RollupInputs = {
  platform: {
    id: "platform",
    name: "Platform Company",
    revenue: 0,
    ebitda: 0,
    entry_multiple: 4.0,
    close_year: 1,
  },
  boltOns: [],
  synergies: {
    sg_a_savings_per_bolton: 200_000,
    procurement_savings_per_bolton: 100_000,
    cross_sell_uplift_pct: 0.10,
    recurring_revenue_conversion_pct: 0.10,
    margin_expansion_pct: 0.02,
  },
  exit: {
    exit_year: 7,
    exit_multiple: 8.0,
  },
  financing: {
    equity_pct: 0.25,
    bank_debt_pct: 0.60,
    seller_note_pct: 0.15,
    bank_interest_rate: 0.085,
    bank_term_years: 10,
    seller_note_rate: 0.06,
    seller_note_term: 5,
    revenue_growth_rate: 0.05,
    owner_salary: 200_000,
    tax_rate: 0.25,
  },
};

// ─────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────

export interface RollupAcquisitionSummary {
  company: string;
  revenue: number;
  ebitda: number;
  ev: number;
  equity: number;
  debt: number;
  multiple: number;
}

export interface RollupProjectionYear {
  year: number;
  combined_revenue: number;
  combined_ebitda: number;
  synergies: number;
  adjusted_ebitda: number;
  debt_service: number;
  free_cash_flow: number;
  cumulative_fcf: number;
  remaining_debt: number;
  companies_count: number;
}

export interface ValueBridge {
  entry_value: number;
  organic_growth_value: number;
  synergy_value: number;
  multiple_expansion_value: number;
  exit_value: number;
}

export interface RollupOutputs {
  acquisitions: RollupAcquisitionSummary[];
  total_capital_deployed: number;
  total_equity_invested: number;
  total_debt: number;
  weighted_entry_multiple: number;
  projection: RollupProjectionYear[];
  valueBridge: ValueBridge;
  exit_ev: number;
  remaining_debt_at_exit: number;
  cumulative_fcf: number;
  total_return: number;
  moic: number;
  irr: number | null;
}

// ─────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────

export function calculateRollup(inputs: RollupInputs): RollupOutputs {
  const allCompanies = [inputs.platform, ...inputs.boltOns].filter(
    (c) => c.revenue > 0 || c.ebitda > 0,
  );

  // Per-acquisition summaries
  const acquisitions: RollupAcquisitionSummary[] = allCompanies.map((c) => {
    const ev = c.ebitda * c.entry_multiple;
    return {
      company: c.name,
      revenue: c.revenue,
      ebitda: c.ebitda,
      ev,
      equity: ev * inputs.financing.equity_pct,
      debt: ev * (inputs.financing.bank_debt_pct + inputs.financing.seller_note_pct),
      multiple: c.entry_multiple,
    };
  });

  const total_capital_deployed = acquisitions.reduce((s, a) => s + a.ev, 0);
  const total_equity_invested = acquisitions.reduce((s, a) => s + a.equity, 0);
  const total_debt = acquisitions.reduce((s, a) => s + a.debt, 0);

  // Weighted entry multiple
  const totalEbitda = acquisitions.reduce((s, a) => s + a.ebitda, 0);
  const weighted_entry_multiple =
    totalEbitda > 0 ? total_capital_deployed / totalEbitda : 0;

  // Year-by-year projection
  const maxYear = Math.max(inputs.exit.exit_year, 10);
  const projection: RollupProjectionYear[] = [];

  const totalRevenue = acquisitions.reduce((s, a) => s + a.revenue, 0);
  const baseMargin = totalEbitda > 0 && totalRevenue > 0
    ? totalEbitda / totalRevenue
    : 0.15;

  for (let y = 1; y <= maxYear; y++) {
    const prev = y === 1 ? null : projection[y - 2];

    // Companies active by this year
    const activeCompanies = allCompanies.filter((c) => c.close_year <= y);
    const activeBoltOns = inputs.boltOns.filter((c) => c.close_year <= y);

    // Combined revenue with growth
    let combined_revenue = 0;
    for (const c of activeCompanies) {
      const yearsActive = y - c.close_year;
      combined_revenue += compoundGrowth(c.revenue, inputs.financing.revenue_growth_rate, yearsActive);
    }

    // Margin with expansion
    const effectiveMargin = baseMargin + (y >= 3 ? inputs.synergies.margin_expansion_pct : 0);
    const combined_ebitda = combined_revenue * effectiveMargin;

    // Synergies
    const boltOnCount = activeBoltOns.length;
    const synergies =
      boltOnCount * inputs.synergies.sg_a_savings_per_bolton +
      boltOnCount * inputs.synergies.procurement_savings_per_bolton +
      combined_revenue * inputs.synergies.cross_sell_uplift_pct * (boltOnCount > 0 ? 1 : 0);

    const adjusted_ebitda = combined_ebitda + synergies - inputs.financing.owner_salary;

    // Debt service — each acquisition has its own debt schedule
    let debt_service = 0;
    let remaining_debt = 0;
    for (const c of activeCompanies) {
      const ev = c.ebitda * c.entry_multiple;
      const bank = ev * inputs.financing.bank_debt_pct;
      const seller = ev * inputs.financing.seller_note_pct;
      const yearsActive = y - c.close_year;

      const bankBal = remainingBalance(
        inputs.financing.bank_interest_rate,
        inputs.financing.bank_term_years,
        bank,
        yearsActive,
      );
      const sellerBal = remainingBalance(
        inputs.financing.seller_note_rate,
        inputs.financing.seller_note_term,
        seller,
        yearsActive,
      );
      remaining_debt += bankBal + sellerBal;

      if (bankBal > 0) {
        debt_service += pmt(inputs.financing.bank_interest_rate, inputs.financing.bank_term_years, bank);
      }
      if (sellerBal > 0) {
        debt_service += pmt(inputs.financing.seller_note_rate, inputs.financing.seller_note_term, seller);
      }
    }

    const pre_tax_cf = adjusted_ebitda - debt_service;
    const taxes = Math.max(0, pre_tax_cf * inputs.financing.tax_rate);
    const free_cash_flow = pre_tax_cf - taxes;
    const cumulative_fcf = (prev?.cumulative_fcf ?? 0) + free_cash_flow;

    projection.push({
      year: y,
      combined_revenue,
      combined_ebitda,
      synergies,
      adjusted_ebitda,
      debt_service,
      free_cash_flow,
      cumulative_fcf,
      remaining_debt,
      companies_count: activeCompanies.length,
    });
  }

  // Exit analysis
  const exitYearData = projection.find((p) => p.year === inputs.exit.exit_year);
  const exit_ebitda = exitYearData?.adjusted_ebitda ?? 0;
  const exit_ev = exit_ebitda * inputs.exit.exit_multiple;
  const remaining_debt_at_exit = exitYearData?.remaining_debt ?? 0;
  const cumulative_fcf = exitYearData?.cumulative_fcf ?? 0;

  const equity_at_exit = exit_ev - remaining_debt_at_exit;
  const total_return = equity_at_exit + cumulative_fcf;
  const moic = total_equity_invested > 0 ? total_return / total_equity_invested : 0;

  // IRR
  const irrFlows: number[] = [];
  for (let y = 0; y <= inputs.exit.exit_year; y++) {
    if (y === 0) {
      // Initial equity for platform
      const platformEV = inputs.platform.ebitda * inputs.platform.entry_multiple;
      irrFlows.push(-(platformEV * inputs.financing.equity_pct));
    } else {
      const yearData = projection[y - 1];
      let flow = yearData?.free_cash_flow ?? 0;

      // Subtract bolt-on equity injections
      const boltOnsThisYear = inputs.boltOns.filter((b) => b.close_year === y);
      for (const b of boltOnsThisYear) {
        flow -= b.ebitda * b.entry_multiple * inputs.financing.equity_pct;
      }

      // Add exit equity in exit year
      if (y === inputs.exit.exit_year) {
        flow += equity_at_exit;
      }

      irrFlows.push(flow);
    }
  }
  const irr = calculateIRR(irrFlows);

  // Value Creation Bridge
  const entry_value = total_capital_deployed;
  // Organic growth: exit revenue at entry margin × entry multiple - entry value
  const entryRevenue = acquisitions.reduce((s, a) => s + a.revenue, 0);
  const exitRevenue = exitYearData?.combined_revenue ?? entryRevenue;
  const organic_growth_value = (exitRevenue - entryRevenue) * baseMargin * weighted_entry_multiple;
  const total_synergies_at_exit = exitYearData?.synergies ?? 0;
  const synergy_value = total_synergies_at_exit * inputs.exit.exit_multiple;
  const multiple_expansion_value = exit_ev - entry_value - organic_growth_value - synergy_value;

  const valueBridge: ValueBridge = {
    entry_value,
    organic_growth_value: Math.max(0, organic_growth_value),
    synergy_value: Math.max(0, synergy_value),
    multiple_expansion_value: Math.max(0, multiple_expansion_value),
    exit_value: exit_ev,
  };

  return {
    acquisitions,
    total_capital_deployed,
    total_equity_invested,
    total_debt,
    weighted_entry_multiple,
    projection,
    valueBridge,
    exit_ev,
    remaining_debt_at_exit,
    cumulative_fcf,
    total_return,
    moic,
    irr,
  };
}
