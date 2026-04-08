import { describe, it, expect } from "vitest";
import {
  calculateDealStructure,
  type DealStructureInput,
} from "./deal-structure-calculator";

/** Helper: build a baseline input. Override fields as needed. */
function baseInput(overrides: Partial<DealStructureInput> = {}): DealStructureInput {
  return {
    askingPrice: 1_500_000,
    ebitda: 350_000,
    earningsType: "EBITDA",
    revenue: 2_000_000,
    purchasePriceAdj: 0.90,
    sbaInterestRate: 0.085,
    sbaLoanTermYears: 10,
    sellerNoteRate: 0.06,
    sellerNoteTermYears: 5,
    earnoutPct: 0.15,
    transactionCosts: 20_000,
    workingCapitalMonths: 3,
    monthlyOperatingExpense: null,
    ownerReplacementSalary: 95_000,
    pmsBurnRate: 28_583,
    ...overrides,
  };
}

describe("calculateDealStructure", () => {
  describe("SDE adjustment", () => {
    it("deducts owner salary when earningsType is SDE", () => {
      const result = calculateDealStructure(
        baseInput({ ebitda: 300_000, earningsType: "SDE" }),
      );
      expect(result.adjustedEbitda).toBe(205_000);
      expect(result.earningsAdjustment).not.toBeNull();
      expect(result.earningsAdjustment!.original).toBe(300_000);
      expect(result.earningsAdjustment!.deduction).toBe(95_000);
    });

    it("deducts owner salary when earningsType is OwnerBenefit", () => {
      const result = calculateDealStructure(
        baseInput({ ebitda: 250_000, earningsType: "OwnerBenefit" }),
      );
      expect(result.adjustedEbitda).toBe(155_000);
    });

    it("does NOT deduct when earningsType is EBITDA", () => {
      const result = calculateDealStructure(
        baseInput({ ebitda: 350_000, earningsType: "EBITDA" }),
      );
      expect(result.adjustedEbitda).toBe(350_000);
      expect(result.earningsAdjustment).toBeNull();
    });

    it("does NOT deduct when earningsType is Unknown", () => {
      const result = calculateDealStructure(
        baseInput({ ebitda: 350_000, earningsType: "Unknown" }),
      );
      expect(result.adjustedEbitda).toBe(350_000);
    });
  });

  describe("Scenario 1: All Cash", () => {
    it("calculates capital deployed correctly", () => {
      const result = calculateDealStructure(baseInput());
      const s1 = result.scenarios[0];
      expect(s1.name).toBe("All Cash");
      expect(s1.purchasePrice).toBe(1_350_000);
      expect(s1.transactionCosts).toBe(20_000);
      expect(s1.annualDebtService).toBe(0);
      expect(s1.netAnnualCashFlow).toBe(350_000);
      expect(s1.dscr).toBeNull();
    });

    it("calculates PMS bridge months correctly", () => {
      const result = calculateDealStructure(baseInput());
      const s1 = result.scenarios[0];
      expect(s1.pmsBridgeMonths).toBeCloseTo(1.02, 1);
    });
  });

  describe("Scenario 2: SBA 7(a) + Seller Note", () => {
    it("splits financing correctly (80/10/10)", () => {
      const result = calculateDealStructure(baseInput());
      const s2 = result.scenarios[1];
      expect(s2.name).toBe("SBA 7(a) + Seller Note");
      expect(s2.downPayment).toBe(135_000);
      expect(s2.sbaLoanAmount).toBeCloseTo(1_080_000, 0);
      expect(s2.sellerNoteAmount).toBeCloseTo(135_000, 0);
    });

    it("computes DSCR", () => {
      const result = calculateDealStructure(baseInput());
      const s2 = result.scenarios[1];
      expect(s2.dscr).toBeGreaterThan(0);
      expect(typeof s2.dscrPassing).toBe("boolean");
    });

    it("computes positive monthly debt service", () => {
      const result = calculateDealStructure(baseInput());
      const s2 = result.scenarios[1];
      expect(s2.monthlyDebtService).toBeGreaterThan(0);
      expect(s2.annualDebtService).toBeCloseTo(s2.monthlyDebtService * 12, 0);
    });
  });

  describe("Scenario 3: SBA + Seller Note + Earnout", () => {
    it("reduces SBA loan by earnout percentage", () => {
      const result = calculateDealStructure(baseInput());
      const s2 = result.scenarios[1];
      const s3 = result.scenarios[2];
      expect(s3.name).toBe("SBA + Seller Note + Earnout");
      expect(s3.sbaLoanAmount).toBeLessThan(s2.sbaLoanAmount);
      expect(s3.earnoutAmount).toBeCloseTo(202_500, 0);
    });

    it("has lower monthly payments than Scenario 2", () => {
      const result = calculateDealStructure(baseInput());
      expect(result.scenarios[2].monthlyDebtService).toBeLessThan(result.scenarios[1].monthlyDebtService);
    });

    it("has better DSCR than Scenario 2", () => {
      const result = calculateDealStructure(baseInput());
      expect(result.scenarios[2].dscr!).toBeGreaterThan(result.scenarios[1].dscr!);
    });
  });

  describe("Sensitivity", () => {
    it("higher interest rate reduces DSCR", () => {
      const low = calculateDealStructure(baseInput({ sbaInterestRate: 0.065 }));
      const high = calculateDealStructure(baseInput({ sbaInterestRate: 0.105 }));
      expect(high.scenarios[1].dscr!).toBeLessThan(low.scenarios[1].dscr!);
    });

    it("lower purchase price improves DSCR", () => {
      const full = calculateDealStructure(baseInput({ purchasePriceAdj: 1.0 }));
      const disc = calculateDealStructure(baseInput({ purchasePriceAdj: 0.8 }));
      expect(disc.scenarios[1].dscr!).toBeGreaterThan(full.scenarios[1].dscr!);
    });

    it("returns 3 scenarios always", () => {
      const result = calculateDealStructure(baseInput());
      expect(result.scenarios).toHaveLength(3);
    });
  });

  describe("Edge cases", () => {
    it("handles zero interest rate without division by zero", () => {
      const result = calculateDealStructure(
        baseInput({ sbaInterestRate: 0 }),
      );
      expect(result.scenarios[1].monthlyDebtService).toBeGreaterThan(0);
      expect(Number.isFinite(result.scenarios[1].dscr!)).toBe(true);
    });

    it("handles null revenue gracefully", () => {
      const result = calculateDealStructure(
        baseInput({ revenue: null }),
      );
      expect(result.scenarios).toHaveLength(3);
    });

    it("handles null monthlyOperatingExpense by defaulting working capital to 0", () => {
      const result = calculateDealStructure(
        baseInput({ monthlyOperatingExpense: null, workingCapitalMonths: 3 }),
      );
      expect(result.scenarios[0].workingCapitalReserve).toBe(0);
    });
  });
});
