# Layer 2: Target Detail Enrichment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add deal structure calculator (3 SBA scenarios + sensitivity sliders), BVR market data import (DealStats + BizComps), and A/B/C outreach templates to DealFlow.

**Architecture:** Three independently shippable features built in priority order. Deal calculator is pure client-side math using existing `pmt()` from `valuation-engine.ts`. BVR import uses native Next.js FormData parsing with `xlsx` library for Excel/CSV. Outreach extends existing Claude-powered `outreach-draft.ts` with template-specific prompt strategies.

**Tech Stack:** Next.js 16, TypeScript, Prisma/PostgreSQL, TanStack Query, Tailwind CSS, `xlsx` (SheetJS), Claude API (via existing `callClaude`)

**Design doc:** `docs/plans/2026-04-08-layer2-target-detail-enrichment-design.md`

---

## Phase A: Deal Structure Calculator

### Task 1: Add `earningsType` Field to Schema

**Files:**
- Modify: `prisma/schema.prisma` — Listing model, after `hasKeyManInsurance` field (~line 135)

**Step 1: Add field to schema**

In `prisma/schema.prisma`, find this block inside the Listing model:

```prisma
  hasKeyManInsurance    Boolean? @default(true) // lapse = disqualifier #8
```

Add after it:

```prisma
  // ── Deal Structure Fields ─────────────────
  earningsType String? // "SDE" | "EBITDA" | "OwnerBenefit" | "Unknown"
```

**Step 2: Push schema to database**

Run:
```bash
npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema."

**Step 3: Regenerate Prisma client**

Run:
```bash
npx prisma generate
```

Expected: "Generated Prisma Client"

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add earningsType field to Listing model"
```

---

### Task 2: Add Test Framework (Vitest)

The project has no unit test runner. We need one for the calculation engine.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` — add vitest scripts and devDependency
- Modify: `tsconfig.json` — add vitest types if needed

**Step 1: Install vitest**

Run:
```bash
npm install -D vitest @vitest/coverage-v8
```

**Step 2: Create vitest config**

Create `vitest.config.ts` in project root:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 3: Add test script to package.json**

In `package.json`, add to the `"scripts"` section:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**Step 4: Verify vitest runs**

Run:
```bash
npm test
```

Expected: "No test files found" (no error — vitest is configured correctly)

**Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest test framework"
```

---

### Task 3: Build Deal Structure Calculator Engine — Tests

**Files:**
- Create: `src/lib/financial/deal-structure-calculator.test.ts`

**Step 1: Write tests for the calculator**

Create `src/lib/financial/deal-structure-calculator.test.ts`:

```typescript
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
      expect(result.adjustedEbitda).toBe(205_000); // 300k - 95k
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
      // Purchase price = 1.5M × 0.90 = 1.35M
      // Capital = 1.35M + 20k + working capital
      expect(s1.name).toBe("All Cash");
      expect(s1.purchasePrice).toBe(1_350_000);
      expect(s1.transactionCosts).toBe(20_000);
      expect(s1.annualDebtService).toBe(0);
      expect(s1.netAnnualCashFlow).toBe(350_000);
      expect(s1.dscr).toBeNull(); // No debt = no DSCR
    });

    it("calculates PMS bridge months correctly", () => {
      const result = calculateDealStructure(baseInput());
      const s1 = result.scenarios[0];
      // PMS months = (350k / 12) / 28583 ≈ 1.02
      expect(s1.pmsBridgeMonths).toBeCloseTo(1.02, 1);
    });
  });

  describe("Scenario 2: SBA 7(a) + Seller Note", () => {
    it("splits financing correctly (90/10)", () => {
      const result = calculateDealStructure(baseInput());
      const s2 = result.scenarios[1];
      expect(s2.name).toBe("SBA 7(a) + Seller Note");
      expect(s2.downPayment).toBe(135_000); // 10% of 1.35M
      expect(s2.sbaLoanAmount).toBeCloseTo(1_080_000, 0); // 80% of 1.35M
      expect(s2.sellerNoteAmount).toBeCloseTo(135_000, 0); // 10% of 1.35M
    });

    it("computes DSCR and flags when below 1.25", () => {
      const result = calculateDealStructure(baseInput());
      const s2 = result.scenarios[1];
      expect(s2.dscr).toBeGreaterThan(0);
      // DSCR = 350k / annual debt service
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
      expect(s3.earnoutAmount).toBeGreaterThan(0);
      // Earnout = 15% of 1.35M = 202,500
      expect(s3.earnoutAmount).toBeCloseTo(202_500, 0);
    });

    it("has lower monthly payments than Scenario 2", () => {
      const result = calculateDealStructure(baseInput());
      const s2 = result.scenarios[1];
      const s3 = result.scenarios[2];
      expect(s3.monthlyDebtService).toBeLessThan(s2.monthlyDebtService);
    });

    it("has better DSCR than Scenario 2", () => {
      const result = calculateDealStructure(baseInput());
      const s2 = result.scenarios[1];
      const s3 = result.scenarios[2];
      expect(s3.dscr!).toBeGreaterThan(s2.dscr!);
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
      const s1 = result.scenarios[0];
      expect(s1.workingCapitalReserve).toBe(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test
```

Expected: FAIL — `Cannot find module './deal-structure-calculator'`

**Step 3: Commit failing tests**

```bash
git add src/lib/financial/deal-structure-calculator.test.ts
git commit -m "test: add deal structure calculator tests (red)"
```

---

### Task 4: Build Deal Structure Calculator Engine — Implementation

**Files:**
- Create: `src/lib/financial/deal-structure-calculator.ts`

**Step 1: Implement the calculator**

Create `src/lib/financial/deal-structure-calculator.ts`:

```typescript
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

  // Configurable with defaults
  purchasePriceAdj: number;       // 0.80–1.00 of asking price
  sbaInterestRate: number;         // annual (e.g. 0.085)
  sbaLoanTermYears: number;        // default 10
  sellerNoteRate: number;          // annual (e.g. 0.06)
  sellerNoteTermYears: number;     // default 5
  earnoutPct: number;              // fraction of purchase price (e.g. 0.15)
  transactionCosts: number;        // flat amount (default 20_000)
  workingCapitalMonths: number;    // months of opex reserve
  monthlyOperatingExpense: number | null;

  // Constants from config
  ownerReplacementSalary: number;  // $95,000
  pmsBurnRate: number;             // $28,583/mo
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
```

**Step 2: Run tests**

Run:
```bash
npm test
```

Expected: All tests PASS.

**Step 3: Commit**

```bash
git add src/lib/financial/deal-structure-calculator.ts
git commit -m "feat: deal structure calculator engine with 3 SBA scenarios"
```

---

### Task 5: Build Deal Structure Panel UI

**Files:**
- Create: `src/components/listings/deal-structure-panel.tsx`

**Step 1: Build the panel component**

Create `src/components/listings/deal-structure-panel.tsx`.

This is a large client component. Key requirements:

- **"use client"** directive
- Imports: `useState`, `useMemo` from React; `calculateDealStructure` + types from calculator
- **Props**: `askingPrice: number | null`, `ebitda: number | null`, `earningsType: string | null`, `revenue: number | null`, `pmsBurnRate: number`, `ownerReplacementSalary: number`
- **State**: `interestRate` (default 8.5), `priceAdj` (default 90, represents %)
- **Layout**: Full-width card with:
  - Header: "Deal Structure Calculator" with collapse toggle
  - SDE adjustment banner (conditional, yellow background): "SDE $X → Adjusted EBITDA $Y (−$95K owner replacement)"
  - Slider row: Interest Rate slider (6.5%–10.5%, step 0.25%) + Purchase Price slider (80%–100%, step 5%)
  - Three-column grid: one card per scenario
  - Each scenario card shows: Purchase Price, Down Payment/Capital, Monthly Debt Service, Annual Debt Service, DSCR badge (green/yellow/red), Net Annual Cash Flow, PMS Bridge Runway (months)
- **DSCR colors**: `≥1.25` = green (`text-green-700 bg-green-50`), `1.0–1.24` = yellow (`text-yellow-700 bg-yellow-50`), `<1.0` = red (`text-red-700 bg-red-50`)
- **Number formatting**: Use `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })` for dollar values
- **Null guard**: If `askingPrice` or `ebitda` is null, show empty state: "Financial data required to run deal structure analysis."
- **Recalculate on slider change** via `useMemo` — pure client-side, instant

**Step 2: Verify it renders** (manual — open a listing detail page in browser)

**Step 3: Commit**

```bash
git add src/components/listings/deal-structure-panel.tsx
git commit -m "feat: deal structure panel UI with sliders and 3-column layout"
```

---

### Task 6: Wire Deal Structure Panel Into Detail Page

**Files:**
- Modify: `src/app/(dashboard)/listings/[id]/page.tsx`

**Step 1: Add import**

At the top of the file, add:

```typescript
import { DealStructurePanel } from "@/components/listings/deal-structure-panel";
```

**Step 2: Add panel after AcquisitionScorePanel**

Find the `<AcquisitionScorePanel` JSX (around line 555). After its closing tag, add:

```tsx
{/* Deal Structure Calculator */}
<DealStructurePanel
  askingPrice={listing.askingPrice ? Number(listing.askingPrice) : null}
  ebitda={
    listing.ebitda
      ? Number(listing.ebitda)
      : listing.inferredEbitda
        ? Number(listing.inferredEbitda)
        : null
  }
  earningsType={listing.earningsType}
  revenue={listing.revenue ? Number(listing.revenue) : null}
  pmsBurnRate={28583}
  ownerReplacementSalary={95000}
/>
```

Note: `pmsBurnRate` and `ownerReplacementSalary` are hardcoded here for simplicity. They could be loaded from the scoring config, but these values change rarely and are already documented in the spec.

**Step 3: Verify in browser**

Open a listing with financial data. Confirm:
- Panel renders below acquisition score
- Sliders adjust values in real-time
- Three scenario columns display correctly
- DSCR badges show correct colors

**Step 4: Commit**

```bash
git add src/app/\\(dashboard\\)/listings/\\[id\\]/page.tsx
git commit -m "feat: wire deal structure panel into listing detail page"
```

---

### Task 7: Add `earningsType` to Listing Edit Form

**Files:**
- Modify: `src/app/(dashboard)/listings/[id]/page.tsx` — the edit modal/form section

**Step 1: Find the financial edit fields**

In the listing detail page, locate the edit form section where `ebitda`, `sde`, `revenue` fields are editable (likely in an inline edit or modal pattern). Add an `earningsType` dropdown near the EBITDA/SDE fields.

**Step 2: Add select field**

Add a select/dropdown with options:
- "Unknown" (default)
- "EBITDA"
- "SDE (Seller's Discretionary Earnings)"
- "Owner Benefit"

Wire the value to the listing update mutation (the `useUpdateListing` hook already sends PATCH to `/api/listings/[id]`).

**Step 3: Add `earningsType` to the listings API PATCH handler**

Check `src/app/api/listings/[id]/route.ts` — the PATCH handler likely uses an allowlist of updateable fields. Add `"earningsType"` to that list.

**Step 4: Verify in browser**

Edit a listing, change earnings type, save, reload — value persists.

**Step 5: Commit**

```bash
git add src/app/\\(dashboard\\)/listings/\\[id\\]/page.tsx src/app/api/listings/\\[id\\]/route.ts
git commit -m "feat: add earningsType dropdown to listing edit form"
```

---

## Phase B: BVR Market Data Import

### Task 8: Add BVR Schema Models

**Files:**
- Modify: `prisma/schema.prisma` — add BvrTransaction and BvrImportHistory models

**Step 1: Add models to schema**

At the end of `prisma/schema.prisma` (before any closing comments), add:

```prisma
// ─────────────────────────────────────────────
// BVR MARKET DATA
// ─────────────────────────────────────────────

model BvrTransaction {
  id String @id @default(cuid())

  // Source tracking
  sourceDatabase String // "DealStats" | "BizComps"
  importId       String
  import         BvrImportHistory @relation(fields: [importId], references: [id], onDelete: Cascade)

  // Industry classification
  sicCode   String?
  naicsCode String?
  industry  String?

  // Transaction details
  transactionDate DateTime?
  mvic            Decimal?  @db.Decimal(15, 2)
  revenue         Decimal?  @db.Decimal(15, 2)
  ebitda          Decimal?  @db.Decimal(15, 2)
  sde             Decimal?  @db.Decimal(15, 2)
  ebitdaMarginPct Float?

  // Multiples
  mvicEbitdaMultiple  Float?
  mvicRevenueMultiple Float?
  mvicSdeMultiple     Float?

  // Deal structure
  pctCashAtClose      Float?
  sellerNoteAmount    Decimal? @db.Decimal(15, 2)
  sellerNoteTermYears Float?
  sellerNoteRate      Float?
  earnoutAmount       Decimal? @db.Decimal(15, 2)

  // Company profile
  employeeCount   Int?
  yearsInBusiness Int?
  state           String?

  // Mapped target rank (derived from SIC/NAICS)
  targetRank Int?

  createdAt DateTime @default(now())

  @@index([sourceDatabase])
  @@index([sicCode])
  @@index([naicsCode])
  @@index([targetRank])
  @@index([transactionDate])
  @@index([revenue])
  @@index([mvic])
}

model BvrImportHistory {
  id String @id @default(cuid())

  sourceDatabase String // "DealStats" | "BizComps"
  fileName       String
  rowsTotal      Int
  rowsImported   Int
  rowsDuplicate  Int
  rowsRejected   Int
  sicCodesUsed   String[]
  naicsCodesUsed String[]

  transactions BvrTransaction[]

  createdAt DateTime @default(now())

  @@index([sourceDatabase])
  @@index([createdAt])
}
```

**Step 2: Push schema**

Run:
```bash
cd /Users/liamcrawford/dealflow && npx prisma db push
```

**Step 3: Regenerate client**

Run:
```bash
npx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add BvrTransaction and BvrImportHistory models"
```

---

### Task 9: Install xlsx Library

**Files:**
- Modify: `package.json`

**Step 1: Install xlsx**

Run:
```bash
cd /Users/liamcrawford/dealflow && npm install xlsx
```

**Step 2: Verify import works**

Run:
```bash
cd /Users/liamcrawford/dealflow && node -e "const XLSX = require('xlsx'); console.log('xlsx version:', XLSX.version)"
```

Expected: prints xlsx version number.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add xlsx (SheetJS) for BVR data import"
```

---

### Task 10: Build BVR Column Mappers

**Files:**
- Create: `src/lib/bvr/types.ts`
- Create: `src/lib/bvr/dealstats-mapper.ts`
- Create: `src/lib/bvr/bizcomps-mapper.ts`
- Create: `src/lib/bvr/rank-matcher.ts`

**Step 1: Create shared types**

Create `src/lib/bvr/types.ts`:

```typescript
/**
 * BVR import types — shared across DealStats and BizComps mappers.
 */

export interface BvrRawRow {
  [key: string]: string | number | null | undefined;
}

export interface BvrParsedTransaction {
  sicCode: string | null;
  naicsCode: string | null;
  industry: string | null;
  transactionDate: Date | null;
  mvic: number | null;
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  ebitdaMarginPct: number | null;
  mvicEbitdaMultiple: number | null;
  mvicRevenueMultiple: number | null;
  mvicSdeMultiple: number | null;
  pctCashAtClose: number | null;
  sellerNoteAmount: number | null;
  sellerNoteTermYears: number | null;
  sellerNoteRate: number | null;
  earnoutAmount: number | null;
  employeeCount: number | null;
  yearsInBusiness: number | null;
  state: string | null;
  targetRank: number | null;
}

export interface MapperResult {
  transactions: BvrParsedTransaction[];
  unmappedColumns: string[];
  parseErrors: Array<{ row: number; field: string; error: string }>;
}
```

**Step 2: Create DealStats mapper**

Create `src/lib/bvr/dealstats-mapper.ts`:

Maps DealStats Excel column headers to `BvrParsedTransaction` fields. DealStats is MVIC/EBITDA-centric.

Key column mappings (case-insensitive, trimmed):
- "SIC Code" / "SIC" → `sicCode`
- "NAICS Code" / "NAICS" → `naicsCode`
- "Sale Date" / "Transaction Date" / "Close Date" → `transactionDate`
- "MVIC" / "Market Value of Invested Capital" / "Sale Price" → `mvic`
- "Revenue" / "Net Revenue" / "Sales" / "Net Sales" → `revenue`
- "EBITDA" → `ebitda`
- "SDE" / "Seller's Discretionary Earnings" → `sde`
- "EBITDA Margin" / "EBITDA Margin %" → `ebitdaMarginPct`
- "MVIC/EBITDA" / "MVIC / EBITDA" → `mvicEbitdaMultiple`
- "MVIC/Revenue" / "MVIC / Revenue" / "MVIC/Sales" → `mvicRevenueMultiple`
- "MVIC/SDE" / "MVIC / SDE" → `mvicSdeMultiple`
- "% Cash" / "Cash at Close" / "Pct Cash at Close" → `pctCashAtClose`
- "Seller Note" / "Seller Note Amount" → `sellerNoteAmount`
- "Note Term" / "Seller Note Term" → `sellerNoteTermYears`
- "Note Rate" / "Seller Note Rate" → `sellerNoteRate`
- "Earnout" / "Earnout Amount" → `earnoutAmount`
- "Employees" / "Employee Count" / "# Employees" → `employeeCount`
- "Years" / "Years in Business" / "Age of Business" → `yearsInBusiness`
- "State" → `state`

Implement as a dictionary of `{ normalizedHeader: fieldName }` with a `mapRow(headers: string[], row: (string|number|null)[])` function. Parse dates with `new Date()` fallback. Parse numbers stripping `$`, `,`, `%`. Return `MapperResult`.

**Step 3: Create BizComps mapper**

Create `src/lib/bvr/bizcomps-mapper.ts`:

Similar structure to DealStats but BizComps uses different column names and is SDE-centric. Key differences:
- "Gross Revenue" instead of "Revenue"
- "Total Price" or "Selling Price" instead of "MVIC"
- "Disc. Earnings" or "SDE" instead of dedicated EBITDA field
- "Price/Disc. Earnings" instead of "MVIC/SDE"
- "Price/Gross" instead of "MVIC/Revenue"
- "Down Payment %" instead of "% Cash at Close"

Same `mapRow()` pattern, returns `MapperResult`.

**Step 4: Create rank matcher**

Create `src/lib/bvr/rank-matcher.ts`:

```typescript
/**
 * Match a SIC/NAICS code to a target rank (1-4).
 * Uses the same SIC/NAICS codes defined in AcquisitionThesisConfig.
 */

// Hardcoded from thesis config (same values seeded in Layer 1)
const RANK_SIC_CODES: Record<number, Set<string>> = {
  1: new Set(["7376", "7379", "7374"]),           // MSP
  2: new Set(["4813", "7372", "7379", "4899"]),   // UCaaS
  3: new Set(["7382", "7381", "1731", "5065"]),   // Security
  4: new Set(["1731", "1799", "1711"]),            // Cabling
};

const RANK_NAICS_CODES: Record<number, Set<string>> = {
  1: new Set(["541512", "541513", "541519", "518210"]),
  2: new Set(["517312", "517911", "541512", "519190"]),
  3: new Set(["561621", "238210", "423690"]),
  4: new Set(["238210", "238290", "561990"]),
};

export function matchTargetRank(
  sicCode: string | null,
  naicsCode: string | null,
): number | null {
  // Try SIC first (more specific), then NAICS
  // Return lowest rank number (highest priority) if multiple match
  const matches: number[] = [];

  for (const [rank, codes] of Object.entries(RANK_SIC_CODES)) {
    if (sicCode && codes.has(sicCode.trim())) {
      matches.push(Number(rank));
    }
  }
  for (const [rank, codes] of Object.entries(RANK_NAICS_CODES)) {
    if (naicsCode && codes.has(naicsCode.trim())) {
      matches.push(Number(rank));
    }
  }

  return matches.length > 0 ? Math.min(...matches) : null;
}
```

**Step 5: Commit**

```bash
git add src/lib/bvr/
git commit -m "feat: BVR column mappers for DealStats and BizComps"
```

---

### Task 11: Build BVR Import API Route

**Files:**
- Create: `src/app/api/settings/bvr-import/route.ts`

**Step 1: Implement the import route**

Create `src/app/api/settings/bvr-import/route.ts`:

**GET handler**: Returns import history from `BvrImportHistory` ordered by `createdAt` desc.

**POST handler**:
1. Parse FormData: `file` (File), `sourceDatabase` ("DealStats" | "BizComps"), `selectedRanks` (JSON string array of rank numbers like `[1,2,3,4]`)
2. Validate: file must be .xlsx or .csv, sourceDatabase must be valid
3. Convert file to `Buffer`, then parse with `xlsx`:
   ```typescript
   import * as XLSX from "xlsx";
   const buffer = Buffer.from(await file.arrayBuffer());
   const workbook = XLSX.read(buffer, { type: "buffer" });
   const sheet = workbook.Sheets[workbook.SheetNames[0]];
   const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
   ```
4. Select mapper based on `sourceDatabase`
5. Map each row → `BvrParsedTransaction`, call `matchTargetRank()` to set `targetRank`
6. Load AcquisitionThesisConfig for selected ranks, get their SIC/NAICS codes
7. Filter: keep only transactions whose SIC or NAICS matches selected target types
8. Deduplicate: check existing BvrTransaction for matching `mvic + revenue + transactionDate + sourceDatabase`
9. If request has `?preview=true` query param, return preview:
   ```json
   { "newRows": 45, "duplicateRows": 3, "rejectedRows": 12, "preview": [...first20] }
   ```
10. If no preview param (confirm step), write transactions + import history record:
    ```typescript
    const importRecord = await prisma.bvrImportHistory.create({
      data: {
        sourceDatabase,
        fileName: file.name,
        rowsTotal: rows.length,
        rowsImported: newTransactions.length,
        rowsDuplicate: dupes,
        rowsRejected: rejected,
        sicCodesUsed: [...sicFilter],
        naicsCodesUsed: [...naicsFilter],
        transactions: {
          createMany: { data: newTransactions },
        },
      },
    });
    ```
11. Return `{ importId, rowsImported, rowsDuplicate, rowsRejected }`

**Step 2: Add route to middleware bypass if needed**

Check `src/middleware.ts` — BVR import is under `/api/settings/` which may already be behind auth. If using session auth (not CRON_SECRET), it should work through normal middleware. No bypass needed.

**Step 3: Commit**

```bash
git add src/app/api/settings/bvr-import/
git commit -m "feat: BVR import API route with preview/confirm flow"
```

---

### Task 12: Build BVR Comps API Route

**Files:**
- Create: `src/app/api/bvr/comps/route.ts`

**Step 1: Implement the comps endpoint**

Create `src/app/api/bvr/comps/route.ts`:

**GET handler**: Query params: `listingId` (required)

1. Fetch listing to get `targetRank` and `revenue`
2. If no `targetRank`, return empty: `{ transactions: [], stats: null, count: 0 }`
3. Query `BvrTransaction` where:
   - `targetRank` matches listing's rank
   - `revenue` within ±50% of listing's revenue (if revenue is not null)
4. Calculate summary stats from matching transactions:
   ```typescript
   interface CompsStats {
     count: number;
     confidence: "low" | "moderate" | "high"; // <10, 10-30, >30
     ebitdaMultiple: { median: number; p25: number; p75: number; min: number; max: number } | null;
     revenueMultiple: { median: number; p25: number; p75: number; min: number; max: number } | null;
     sdeMultiple: { median: number; p25: number; p75: number; min: number; max: number } | null;
     dealStructure: {
       avgPctCashAtClose: number | null;
       avgSellerNoteTermYears: number | null;
       pctWithEarnout: number | null;
     };
     volumeByYear: Record<string, number>; // { "2023": 12, "2024": 8, ... }
   }
   ```
5. Use helper functions for median/percentile calculation (sort array, pick index)
6. Return `{ stats, transactions: first50sorted, count }`

**Step 2: Commit**

```bash
git add src/app/api/bvr/comps/
git commit -m "feat: BVR comps API with percentile stats and confidence rating"
```

---

### Task 13: Build Market Comps Panel UI

**Files:**
- Create: `src/components/listings/market-comps-panel.tsx`

**Step 1: Build the component**

Create `src/components/listings/market-comps-panel.tsx`:

- **"use client"** directive
- Fetches from `/api/bvr/comps?listingId=X` via TanStack Query
- **Props**: `listingId: string`, `targetRank: number | null`, `targetRankLabel: string | null`
- **Layout**:
  - Header: "Market Comparables" with confidence badge and transaction count
  - If no data: empty state with import instructions + SIC codes for the rank
  - Stats grid (3 columns): EBITDA Multiple card, Revenue Multiple card, SDE Multiple card
    - Each shows: median (large), IQR range (25th–75th), min–max
  - Deal structure row: avg % cash at close, avg seller note term, % deals with earnout
  - Volume by year: simple horizontal bar display (no charting library needed — use Tailwind width percentages)

**Step 2: Commit**

```bash
git add src/components/listings/market-comps-panel.tsx
git commit -m "feat: market comps panel with percentile stats and deal structure"
```

---

### Task 14: Wire Market Comps Panel Into Detail Page

**Files:**
- Modify: `src/app/(dashboard)/listings/[id]/page.tsx`

**Step 1: Add import and render panel**

After the `DealStructurePanel`, add:

```tsx
import { MarketCompsPanel } from "@/components/listings/market-comps-panel";

{/* Market Comparables */}
<MarketCompsPanel
  listingId={listing.id}
  targetRank={listing.targetRank}
  targetRankLabel={listing.targetRankLabel}
/>
```

**Step 2: Commit**

```bash
git add src/app/\\(dashboard\\)/listings/\\[id\\]/page.tsx
git commit -m "feat: wire market comps panel into listing detail page"
```

---

### Task 15: Add BVR Import UI to Settings Page

**Files:**
- Modify: `src/app/(dashboard)/settings/thesis/page.tsx`

**Step 1: Add BVR Import section**

After the `TargetTypesSection` component, add a new `BvrImportSection` (can be inline or a separate component).

**Section contents:**
- Header: "Market Data Imports" with database icon
- File upload area: drag-and-drop or click to select (.xlsx, .csv)
- Source database selector: radio buttons "DealStats" / "BizComps"
- Target type filter: 4 checkboxes (MSP, UCaaS, Security, Cabling) — all checked by default
- "Preview Import" button → calls `POST /api/settings/bvr-import?preview=true`
- Preview table: shows new/duplicate/rejected counts + first 20 rows
- "Confirm Import" button → calls `POST /api/settings/bvr-import` (no preview param)
- Import history table below: date, source, filename, rows imported (from GET endpoint)
- Total transaction counts per target type (query BvrTransaction grouped by targetRank)

**Step 2: Verify in browser**

Navigate to Settings → Thesis. Confirm BVR section renders. Test with a sample file if available.

**Step 3: Commit**

```bash
git add src/app/\\(dashboard\\)/settings/thesis/page.tsx
git commit -m "feat: BVR import UI with preview/confirm flow in settings"
```

---

## Phase C: Outreach Templates

### Task 16: Add Template System to Outreach Engine

**Files:**
- Modify: `src/lib/ai/outreach-draft.ts`

**Step 1: Add template types and configs**

Add to the file, before the existing `generateOutreachDraft` function:

```typescript
export type OutreachTemplateType = "direct_owner" | "broker_listed" | "cpa_referral";

export interface OutreachTemplateConfig {
  type: OutreachTemplateType;
  label: string;
  description: string;
  systemPromptAddendum: string;
}

const TEMPLATE_CONFIGS: Record<OutreachTemplateType, OutreachTemplateConfig> = {
  direct_owner: {
    type: "direct_owner",
    label: "Direct Owner Outreach",
    description: "Warm outreach to unlisted business owner",
    systemPromptAddendum: `
TEMPLATE: Direct Owner (Unlisted Business)
- Subject format: "Confidential Inquiry — [Company Name]"
- Position as fellow Colorado operator building commercial tech platform
- Tone: Warm, peer-to-peer, genuine — NOT corporate or PE
- Emphasize: Growth partnership, legacy continuation, employee retention
- Mention: Acquiring PMS AV division as initial platform, seeking complementary [target type] partner
- CTA: 20-minute confidential call
- Do NOT use words: "portfolio", "roll-up", "platform acquisition", "strategic buyer"
`,
  },
  broker_listed: {
    type: "broker_listed",
    label: "Broker / Listed Response",
    description: "Professional buyer inquiry for listed businesses",
    systemPromptAddendum: `
TEMPLATE: Broker / Listed Business Response
- Subject format: "Buyer Inquiry — [Listing Name or Business Name]"
- Position as qualified, ready buyer: $1–2M capital available, SBA pre-qualified
- Tone: Professional, efficient, buyer-qualification focused
- Emphasize: Aligned timeline, operator background (not absentee), deal readiness
- Include buyer qualifications: EMBA, industry relationships, operational experience
- CTA: Schedule a call to discuss, request CIM/additional financials
- Keep concise — brokers are busy, show you're serious and ready
`,
  },
  cpa_referral: {
    type: "cpa_referral",
    label: "CPA / Attorney Referral",
    description: "Request for introductions from professional advisors",
    systemPromptAddendum: `
TEMPLATE: CPA / Attorney Referral Request
- Subject format: "Introduction to Technology Business Owners — Confidential"
- Position as professional request for introductions to business owners considering exit
- Tone: Respectful, discrete, professional peer-to-peer
- Emphasize: Succession planning conversations, no broker process, confidential
- Value prop: Discrete buyer with aligned interests, no disruption to client relationships
- CTA: Introductions to clients in IT services / commercial tech considering retirement or sale
- Frame as partnership: you help their clients plan succession, they maintain the advisory relationship
`,
  },
};

export { TEMPLATE_CONFIGS };
```

**Step 2: Update OutreachInput interface**

Add new fields to the existing `OutreachInput` interface:

```typescript
export interface OutreachInput {
  // Existing fields (keep all)
  ownerName: string | null;
  estimatedAge: string | null;
  companyName: string;
  yearsInBusiness: number | null;
  primaryTrade: string | null;
  city: string | null;
  state: string | null;
  revenue: string | null;
  knownProjects: string | null;
  certifications: string[];
  additionalContext: string | null;

  // New fields
  templateType: OutreachTemplateType;
  targetRankLabel: string | null;
  brokerName: string | null;
  brokerCompany: string | null;
  askingPrice: string | null;
  listingTitle: string | null;
  referralContactName: string | null;
}
```

**Step 3: Update generateOutreachDraft to use template**

Modify the function to append the template-specific prompt addendum to the system prompt, and include new fields in the user message details.

In the `generateOutreachDraft` function, change the `system` parameter:

```typescript
const templateConfig = TEMPLATE_CONFIGS[input.templateType];
const fullSystemPrompt = OUTREACH_SYSTEM_PROMPT + "\n\n" + templateConfig.systemPromptAddendum;
```

And add template-specific fields to the `details` array:

```typescript
input.targetRankLabel ? `Target Type: ${input.targetRankLabel}` : null,
input.brokerName ? `Broker: ${input.brokerName}` : null,
input.brokerCompany ? `Brokerage: ${input.brokerCompany}` : null,
input.askingPrice ? `Asking Price: ${input.askingPrice}` : null,
input.listingTitle ? `Listing: ${input.listingTitle}` : null,
input.referralContactName ? `Referral Contact: ${input.referralContactName}` : null,
```

Then pass `fullSystemPrompt` in the `callClaude` call.

**Step 4: Commit**

```bash
git add src/lib/ai/outreach-draft.ts
git commit -m "feat: A/B/C outreach template system with template-specific prompts"
```

---

### Task 17: Update Outreach Panel UI

**Files:**
- Modify: `src/components/ai/outreach-draft-panel.tsx`

**Step 1: Add template selector**

At the top of the panel (before the "Generate" button), add a template type selector with 3 cards/tabs:

- **Direct Owner** — icon: user, description: "Warm outreach to unlisted business owner"
- **Broker Response** — icon: briefcase, description: "Professional buyer inquiry for listed business"
- **CPA Referral** — icon: building, description: "Request introductions from professional advisors"

Default selection: "direct_owner" if no broker info exists on the listing, "broker_listed" if broker fields are populated.

**Step 2: Auto-populate new fields from listing data**

When template type changes, auto-fill the relevant fields:
- `targetRankLabel` from listing
- `brokerName` / `brokerCompany` from listing (for broker template)
- `askingPrice` formatted from listing
- `listingTitle` from listing title

For CPA referral, show an additional text input for `referralContactName` (manual entry).

**Step 3: Pass templateType to the generation function**

The generate button should pass `templateType` in the `OutreachInput` to the API.

**Step 4: Commit**

```bash
git add src/components/ai/outreach-draft-panel.tsx
git commit -m "feat: outreach panel with A/B/C template selector and auto-populate"
```

---

### Task 18: Add "Mark as Sent" Flow

**Files:**
- Modify: `src/components/ai/outreach-draft-panel.tsx`
- Create or modify: `src/app/api/listings/[id]/outreach-sent/route.ts`

**Step 1: Add "Mark as Sent" button to outreach panel**

After the generated draft textarea, add:
- "Copy to Clipboard" button — copies subject + body to clipboard
- "Mark as Sent" button — calls a new API endpoint
- Notes textarea — for call details and follow-up notes
- Next action date picker — date input

**Step 2: Create outreach-sent API route**

Create `src/app/api/listings/[id]/outreach-sent/route.ts`:

```typescript
// POST /api/listings/[id]/outreach-sent
// Body: { templateType, subject, notes, nextActionDate }

// 1. Find or create Opportunity for this listing
// 2. Update Opportunity.outreachStatus to COLD_OUTREACH_SENT
// 3. Update Opportunity.contactedAt to now()
// 4. Create a Note on the opportunity:
//    title: "Outreach Sent — [Template Label]"
//    content: "Subject: [subject]\nTemplate: [type]\n\n[notes]"
// 5. If nextActionDate provided, create a Task:
//    title: "Follow up — [listing title]"
//    dueDate: nextActionDate
// 6. Return { opportunityId, noteId, taskId }
```

**Step 3: Wire button to API call**

When "Mark as Sent" is clicked:
1. Call the outreach-sent endpoint
2. Show success toast
3. Invalidate TanStack Query for the listing (to refresh opportunity status)

**Step 4: Commit**

```bash
git add src/components/ai/outreach-draft-panel.tsx src/app/api/listings/\\[id\\]/outreach-sent/
git commit -m "feat: mark outreach as sent with opportunity tracking and follow-up tasks"
```

---

## Final Steps

### Task 19: End-to-End Verification

**Step 1: Restart dev server**

```bash
cd /Users/liamcrawford/dealflow && npm run dev
```

**Step 2: Verify Deal Structure Calculator**

Open a listing with financial data. Confirm:
- [ ] SDE adjustment banner shows when earningsType is SDE
- [ ] Three scenario columns render with correct math
- [ ] Interest rate slider updates all scenarios in real-time
- [ ] Purchase price slider updates all scenarios
- [ ] DSCR badges show correct colors (green/yellow/red)
- [ ] PMS bridge months display correctly

**Step 3: Verify BVR Import** (if sample data available)

Navigate to Settings → Thesis → Market Data Imports. Confirm:
- [ ] File upload works for .xlsx and .csv
- [ ] Source database selector works
- [ ] Target type filter checkboxes work
- [ ] Preview shows row counts before confirm
- [ ] Confirm imports data
- [ ] Import history shows past imports

**Step 4: Verify Market Comps Panel**

Open a listing with targetRank set. Confirm:
- [ ] Panel shows comparable stats if BVR data imported
- [ ] Empty state shows with import instructions if no data
- [ ] Confidence rating matches transaction count

**Step 5: Verify Outreach Templates**

Open a listing and expand outreach panel. Confirm:
- [ ] Three template cards render
- [ ] Selecting a template auto-populates fields
- [ ] Generate produces template-appropriate draft
- [ ] Copy to clipboard works
- [ ] Mark as Sent creates opportunity + note
- [ ] Follow-up date creates task

**Step 6: Run tests**

```bash
npm test
```

Expected: All deal structure calculator tests pass.

**Step 7: Build check**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

**Step 8: Commit any final fixes**

```bash
git add -A
git commit -m "fix: address issues found during Layer 2 end-to-end verification"
```

---

### Task 20: Deploy to Production

**Step 1: Push to main**

```bash
git push origin main
```

Railway auto-deploys from main.

**Step 2: Run database migration on production**

The new schema models (BvrTransaction, BvrImportHistory, earningsType field) need to be applied. Railway runs `prisma generate` during build. If using `db push`, trigger via:

```bash
curl -X POST https://dealflow-production-0240.up.railway.app/api/admin/setup-acquisition \
  -H "Authorization: Bearer 6oiqA6QPPxQpeWLT133k0JfWBaj4oDJTV+w/2xEpMLA+dIU" \
  -H "Content-Type: application/json"
```

Or add a new migration endpoint for Layer 2 schema changes.

**Step 3: Verify production**

Open production URL and spot-check each new feature.
