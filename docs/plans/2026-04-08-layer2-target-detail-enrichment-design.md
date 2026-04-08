# Layer 2: Target Detail Enrichment — Design Document

**Date:** 2026-04-08
**Status:** Approved
**Depends on:** Layer 1 (foundation scoring, thesis config, rank system) — deployed

---

## Overview

Layer 2 adds three analytical and operational capabilities to DealFlow:

1. **Deal Structure Calculator** — 3-scenario SBA financing model with sensitivity analysis
2. **BVR Market Data Import** — dual-database Excel/CSV import with market intelligence panel
3. **Outreach Templates** — A/B/C prompt-driven outreach via existing Claude engine

Priority order: Calculator → BVR → Outreach (each is independently shippable).

---

## Component 1: Deal Structure Calculator

### Purpose

Evaluate whether an acquisition target's cash flow can sustain SBA debt service while funding PMS's $28,583/mo operating loss. This is the core go/no-go financial tool.

### Calculation Engine

**Location:** `src/lib/financial/deal-structure-calculator.ts`

Pure TypeScript, client-side math, no API calls. Builds on existing `valuation-engine.ts` which already provides `pmt()`, `compoundGrowth()`, `remainingBalance()`, and `calculateIRR()`.

#### Inputs

```typescript
interface DealStructureInput {
  // From listing
  askingPrice: number;
  ebitda: number;           // Raw reported EBITDA or SDE
  earningsType: EarningsType; // "SDE" | "EBITDA" | "OwnerBenefit" | "Unknown"
  revenue: number | null;

  // Configurable (with defaults)
  purchasePriceAdj: number;     // 0.80–1.00 of asking (default 0.90)
  sbaInterestRate: number;       // annual rate (default 0.085)
  sbaLoanTermYears: number;      // default 10
  sellerNoteRate: number;        // default 0.06
  sellerNoteTermYears: number;   // default 5
  earnoutPct: number;            // default 0.15
  transactionCosts: number;      // default 20_000
  workingCapitalMonths: number;  // default 3
  monthlyOperatingExpense: number | null; // for working capital calc

  // Hardcoded constants (from config)
  ownerReplacementSalary: number; // $95,000
  pmsBurnRate: number;            // $28,583/mo
}
```

#### SDE → EBITDA Auto-Adjustment

```
If earningsType ∈ {"SDE", "OwnerBenefit"}:
  adjustedEbitda = ebitda - ownerReplacementSalary ($95,000)
Else:
  adjustedEbitda = ebitda
```

Both original and adjusted figures displayed for transparency.

#### Three Scenarios

**Scenario 1: All Cash**
- `capitalDeployed = purchasePrice + transactionCosts + workingCapital`
- `annualDebtService = 0`
- `netAnnualCashFlow = adjustedEbitda`
- `pmsBridgeMonths = (adjustedEbitda / 12) / pmsBurnRate`
- `totalOutOfPocket = capitalDeployed`

**Scenario 2: SBA 7(a) + Seller Note**
- `downPayment = purchasePrice × 0.10`
- `sbaLoanAmount = purchasePrice × 0.90`
- `monthlyPaymentSBA = pmt(sbaRate/12, termYears×12, sbaLoanAmount)`
- `annualSBAService = monthlyPaymentSBA × 12`
- Seller note: 10% of purchase price, separate amortization
- `totalAnnualDebtService = annualSBAService + annualSellerNoteService`
- `dscr = adjustedEbitda / totalAnnualDebtService` (red flag if < 1.25)
- `netAfterDebt = adjustedEbitda - totalAnnualDebtService`
- `pmsBridgeMonths = (netAfterDebt / 12) / pmsBurnRate`
- `totalOutOfPocket = downPayment + transactionCosts + workingCapital`

**Scenario 3: SBA + Seller Note + Earnout**
- Same as Scenario 2 but `earnoutAmount = purchasePrice × earnoutPct`
- Reduces SBA loan: `sbaLoanAmount = purchasePrice × (0.90 - earnoutPct)`
- Earnout is contingent (deferred, not debt service)
- Lower monthly payments, higher total cost if performance met

#### Sensitivity Controls (client-side sliders)

- **Interest rate:** ±2% from base rate, step 0.25% (range 6.5%–10.5% at default)
- **Purchase price:** 80%–100% of asking price, step 5%
- Both update all three scenarios in real-time
- Display DSCR changes at each rate/price combination

#### Output

```typescript
interface DealStructureResult {
  adjustedEbitda: number;
  earningsAdjustment: { original: number; adjusted: number; deduction: number } | null;
  scenarios: DealScenario[];  // length 3
}

interface DealScenario {
  name: string;              // "All Cash", "SBA 7(a) + Seller Note", "SBA + Note + Earnout"
  purchasePrice: number;
  capitalDeployed: number;
  totalOutOfPocket: number;
  downPayment: number;
  sbaLoanAmount: number;
  monthlyDebtService: number;
  annualDebtService: number;
  sellerNoteAmount: number;
  earnoutAmount: number;
  dscr: number | null;       // null for all-cash
  dscrPassing: boolean;
  netAnnualCashFlow: number;
  pmsBridgeMonths: number;
  workingCapitalReserve: number;
  transactionCosts: number;
}
```

### UI Component

**Location:** `src/components/listings/deal-structure-panel.tsx`

- Full-width panel on deal detail page (below acquisition score panel)
- Three-column layout: one column per scenario
- SDE adjustment banner at top (shows original → adjusted with $95K deduction)
- Color-coded DSCR indicator: green ≥1.25, yellow 1.0–1.24, red <1.0
- PMS bridge runway displayed prominently with month count
- Two slider controls at top: interest rate + purchase price %
- Collapsible — expanded by default on first view

### Schema Changes

Add to Listing model:
```prisma
earningsType String? // "SDE" | "EBITDA" | "OwnerBenefit" | "Unknown"
```

One new field. The calculator is otherwise stateless (client-side math from listing data).

### API

No new API routes needed — the calculator runs entirely client-side using listing data already fetched by the detail page. The `pms.monthlyBurn` and `pms.ownerSalaryForSdeAdjustment` values come from the scoring config already loaded.

---

## Component 2: BVR Market Data Import

### Purpose

Import comparable transaction data from BVR's DealStats and BizComps databases to anchor valuations in real market data rather than rules of thumb.

### New Prisma Models

```prisma
model BvrTransaction {
  id String @id @default(cuid())

  // Source tracking
  sourceDatabase String   // "DealStats" | "BizComps"
  importId       String
  import         BvrImportHistory @relation(fields: [importId], references: [id], onDelete: Cascade)

  // Industry classification
  sicCode   String?
  naicsCode String?
  industry  String?

  // Transaction details
  transactionDate DateTime?
  mvic            Decimal?  @db.Decimal(15, 2) // Market Value of Invested Capital
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
  employeeCount Int?
  yearsInBusiness Int?
  state         String?

  // Mapped target rank (derived from SIC/NAICS match)
  targetRank Int? // 1-4 or null if no match

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

  sourceDatabase String   // "DealStats" | "BizComps"
  fileName       String
  rowsTotal      Int
  rowsImported   Int
  rowsDuplicate  Int
  rowsRejected   Int
  sicCodesUsed   String[] // SIC codes filtered during import
  naicsCodesUsed String[] // NAICS codes filtered during import

  transactions BvrTransaction[]

  createdAt DateTime @default(now())

  @@index([sourceDatabase])
  @@index([createdAt])
}
```

### Column Mapping

Two parsers, one per source database:

**DealStats mapper** (`src/lib/bvr/dealstats-mapper.ts`):
Maps DealStats Excel export columns → BvrTransaction fields. DealStats uses MVIC-centric fields with EBITDA multiples.

**BizComps mapper** (`src/lib/bvr/bizcomps-mapper.ts`):
Maps BizComps CSV export columns → BvrTransaction fields. BizComps is SDE-centric with smaller transaction sizes.

Both mappers normalize into the same `BvrTransaction` schema. Column mapping is configurable via a header-matching dictionary (handles minor column name variations between export versions).

### Import Flow

**API route:** `POST /api/settings/bvr-import`

1. Upload Excel (.xlsx) or CSV file + select source database (DealStats or BizComps)
2. Server parses file using `xlsx` library (handles both formats)
3. Auto-detect columns by matching headers against known column dictionaries
4. Apply SIC/NAICS filter: user selects which target types to include (checkboxes for Rank 1-4, each maps to its SIC/NAICS codes from AcquisitionThesisConfig)
5. Run deduplication: match on `mvic + revenue + transactionDate` within same source
6. Return preview: `{ newRows: N, duplicateRows: N, rejectedRows: N, preview: first20rows }`
7. User confirms → server writes BvrTransaction rows + BvrImportHistory record
8. Auto-derive `targetRank` for each transaction by matching SIC/NAICS against thesis config codes

**GET /api/settings/bvr-import** — returns import history

**GET /api/bvr/comps?listingId=X** — returns comparable transactions for a listing:
- Match by targetRank (same rank = same industry)
- Filter revenue within ±50% of listing's revenue
- Return summary stats + raw transactions

### Market Intelligence Panel

**Location:** `src/components/listings/market-comps-panel.tsx`

Displayed on deal detail page, below deal structure calculator.

**Data shown (filtered to target type + revenue range):**
- Transaction count ("Based on N comparable transactions")
- Median EBITDA multiple with IQR (25th–75th percentile)
- Median Revenue multiple
- Median SDE multiple
- Deal structure breakdown: avg % cash at close, avg seller note terms, % of deals with earnout
- Transaction volume by year (last 5 years, simple bar chart)
- Confidence indicator: <10 comps = "Low confidence", 10-30 = "Moderate", >30 = "High"

**Empty state:** "Import BVR market data to see comparable transactions. Use SIC codes [relevant codes] in DealStats/BizComps."

### Settings Page Addition

Add "Market Data" section to `/settings/thesis` page:
- Import button with file picker + source selector
- Import history table (date, source, rows imported, SIC filter)
- Total transaction counts per target type

---

## Component 3: Outreach Templates

### Purpose

Three AI-generated outreach variants using the existing Claude outreach engine, each tuned for a different engagement scenario.

### Architecture

Extend `src/lib/ai/outreach-draft.ts` with template-specific prompt strategies. The existing `generateOutreachDraft()` function becomes the engine; new template configs steer it.

#### Template Definitions

```typescript
type OutreachTemplateType = "direct_owner" | "broker_listed" | "cpa_referral";

interface OutreachTemplateConfig {
  type: OutreachTemplateType;
  label: string;
  systemPromptAddendum: string; // Appended to base system prompt
  requiredFields: string[];     // Fields that must be non-null for this template
}
```

**Template A — Direct Owner (Unlisted):**
- Subject: "Confidential Inquiry — [Company Name]"
- Positioning: Fellow Colorado operator building commercial tech platform
- Tone: Warm, peer-to-peer, no corporate/PE language
- Emphasis: Growth partnership, legacy continuation, employee retention
- CTA: 20-minute confidential call
- Auto-populate: company name, owner first name, target type label, city, years in business

**Template B — Broker/Listed Response:**
- Subject: "Buyer Inquiry — [Listing Title or Business Name]"
- Positioning: Qualified buyer with $1–2M capital, SBA pre-qualified
- Tone: Professional, efficient, buyer-qualification focused
- Emphasis: Aligned timeline, operator background, deal readiness
- CTA: Schedule a call, request CIM
- Auto-populate: listing name, broker name, asking price range, trade category

**Template C — CPA/Attorney Referral:**
- Subject: "Introduction to Technology Business Owners — Confidential"
- Positioning: Professional request for introductions
- Tone: Respectful, discrete
- Emphasis: Succession planning conversations, no broker process, confidential
- CTA: Introductions to clients considering exit/retirement
- Auto-populate: referral target professional's name (manual input)

### Updated Outreach Input

```typescript
interface OutreachInput {
  // Existing fields (preserved)
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
  targetRankLabel: string | null;    // "MSP", "UCaaS", etc.
  brokerName: string | null;
  brokerCompany: string | null;
  askingPrice: string | null;
  listingTitle: string | null;
  referralContactName: string | null; // For Template C
}
```

### UI Changes

Modify `src/components/ai/outreach-draft-panel.tsx`:

1. Add template type selector (3 cards/tabs: Direct Owner, Broker Response, CPA Referral)
2. Template selection auto-populates relevant fields from listing/opportunity data
3. "Generate Draft" button sends to Claude with template-specific prompt
4. Generated draft displayed in editable textarea
5. "Copy to Clipboard" button
6. "Mark as Sent" button → logs to outreach history:
   - Updates `Opportunity.outreachStatus` to `COLD_OUTREACH_SENT`
   - Creates a Note with template type, subject, timestamp
   - If opportunity doesn't exist, creates one with stage `CONTACTING`
7. Notes field for call details
8. Next action date picker

### Outreach Tracking

No new schema models needed — uses existing:
- `Opportunity.outreachStatus` (enum already has `COLD_OUTREACH_SENT`, `WARM_INTRO_MADE`, etc.)
- `Note` model for logging sent outreach + follow-up notes
- `Contact` model for storing who was contacted

---

## Implementation Sequence

### Phase A: Deal Structure Calculator
1. Add `earningsType` field to Listing schema + migrate
2. Build `deal-structure-calculator.ts` calculation engine
3. Build `deal-structure-panel.tsx` UI with 3-column layout + sliders
4. Wire into deal detail page
5. Write unit tests for calculation engine

### Phase B: BVR Market Data Import
6. Add `BvrTransaction` + `BvrImportHistory` models to schema + migrate
7. Build DealStats column mapper
8. Build BizComps column mapper
9. Build import API route with preview/confirm flow
10. Build comps API route (filtered by rank + revenue range)
11. Build market comps panel UI
12. Add import UI to settings page
13. Write tests for mappers and stats calculation

### Phase C: Outreach Templates
14. Add template type system to outreach-draft.ts (3 prompt strategies)
15. Update outreach panel UI with template selector
16. Add "Mark as Sent" flow (opportunity creation/update + note logging)
17. Add next action date picker and follow-up tracking
18. Write tests for template generation

---

## Technical Notes

- **xlsx dependency:** Add `xlsx` (SheetJS) for Excel parsing. Already a well-maintained library, handles .xlsx and .csv.
- **Client-side math:** Deal structure calculator runs entirely in the browser — no API round-trips for slider adjustments. Only the listing data fetch is server-side.
- **BVR data volume:** Expect 100–500 transactions per import after SIC filtering. PostgreSQL handles this easily; no special indexing beyond what's defined above.
- **Outreach AI costs:** Each generation costs ~$0.01–0.02 (Sonnet 4, ~2K tokens). Low volume — maybe 5–10 per week.
- **PMS constants:** `monthlyBurn` ($28,583) and `ownerSalaryForSdeAdjustment` ($95,000) are stored in the `acquisition_scoring_config` AppSetting's `pms` object, already seeded in Layer 1.
