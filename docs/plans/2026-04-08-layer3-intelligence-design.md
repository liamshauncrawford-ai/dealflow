# Layer 3: Intelligence & Deal Analysis — Design Document

**Date:** 2026-04-08
**Status:** Approved
**Depends on:** Layer 1 (scoring, thesis config), Layer 2 (deal calculator, BVR import, outreach templates) — deployed

---

## Overview

Layer 3 adds four features to DealFlow, built in ascending complexity:

1. **BVR Query Assistant** — reference panel in existing BVR import settings
2. **Due Diligence Checklists** — stage-gated interactive checklists per listing
3. **Market Data Dashboard** — Recharts-powered BVR analytics in market intel section
4. **Priority A Fast-Track** — auto-generated deal packages for Tier A targets (on-screen + PDF)

---

## Feature 1: BVR Query Assistant

### Purpose

Guide the user through searching BVR databases (DealStats and BizComps) with the right SIC/NAICS codes and filters for each target rank, so imported data is relevant and complete.

### Architecture

No new pages, models, or API routes. Adds a collapsible reference panel to the existing `BvrImportSection` component at `src/components/settings/bvr-import-section.tsx`.

### UI

Collapsible "Query Guide" panel above the file upload area with 4 tabs (one per rank):

**Per tab (e.g., "Rank 1 — MSP"):**
- Recommended SIC codes with descriptions:
  - 7376 — Computer Facilities Management Services
  - 7379 — Computer Related Services, NEC
  - 7374 — Computer Processing & Data Preparation
- Recommended NAICS codes with descriptions:
  - 541512 — Computer Systems Design Services
  - 541513 — Computer Facilities Management Services
  - 541519 — Other Computer Related Services
  - 518210 — Data Processing, Hosting, and Related Services
- Revenue filter range: from `AcquisitionThesisConfig.softFilterRevenueLow` to `softFilterRevenueHigh`
- Date range recommendation: "Last 3–5 years for statistical significance"
- Step-by-step instructions:
  1. Log into DealStats (or BizComps)
  2. Search → SIC Code → Enter codes listed above
  3. Filter Revenue to $X–$Y range
  4. Filter to last 3–5 years
  5. Export to Excel
  6. Upload using the import form below

### Data Source

`GET /api/settings/acquisition-thesis` — already exists, returns all 4 AcquisitionThesisConfig rows with sicCodes, naicsCodes, and soft filter ranges.

SIC/NAICS descriptions are hardcoded in a lookup table within the component (stable, rarely changes).

---

## Feature 2: Due Diligence Checklists

### Purpose

Provide stage-appropriate due diligence tasks that unlock as a target progresses through the pipeline. Hardcoded defaults with per-listing customization.

### New Schema Model

```prisma
model DueDiligenceItem {
  id        String  @id @default(cuid())
  listingId String
  listing   Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  stage       String    // "PRE_NDA" | "POST_NDA" | "LOI_DD"
  itemText    String
  order       Int
  isCompleted Boolean   @default(false)
  completedAt DateTime?
  notes       String?   @db.Text
  isCustom    Boolean   @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([listingId])
  @@index([stage])
}
```

Add relation to Listing model:
```prisma
dueDiligenceItems DueDiligenceItem[]
```

### Default Items (24 total, seeded per listing)

**Pre-NDA (6 items) — unlocks when opportunity exists (any stage):**
1. Verify listing is still active
2. Confirm geographic location within Denver metro
3. Identify owner name and contact information
4. Check for public records of litigation
5. Check if owner is active on LinkedIn
6. Cross-reference with BVR comparable transactions

**Post-NDA (10 items) — unlocks at NDA_SIGNED stage:**
1. Request 3 years of tax returns / P&L statements
2. Verify MRR by reviewing active contracts
3. Confirm client concentration (no single client > 15%)
4. Request technician org chart
5. Verify Colorado licensing
6. Request accounts receivable aging report
7. Confirm SBA eligibility
8. Obtain key employee list and tenure
9. Understand owner's transition timeline
10. Request list of top 10 clients with revenue per client

**LOI/DD (8 items) — unlocks at LOI_STAGE:**
1. Engage M&A attorney
2. Engage CPA for Quality of Earnings review
3. SBA lender pre-approval confirmation
4. Environmental/title on any real property
5. Employment agreement review
6. Client contract assignability review
7. Non-compete agreement drafted
8. Key employee retention plan

### Seeding Logic

When the GET endpoint is called and no items exist for a listing, auto-seed the 24 defaults. This lazy-seeding approach avoids needing a migration to backfill existing listings.

### Stage-Gating

Items render for all stages but locked items (checkbox disabled, grayed out) until the opportunity reaches the required stage:

| Checklist | Unlocks at | Also visible at |
|-----------|-----------|-----------------|
| PRE_NDA | Any stage (opportunity exists) | All stages |
| POST_NDA | NDA_SIGNED | DUE_DILIGENCE, LOI_STAGE, CLOSED |
| LOI_DD | LOI_STAGE | DUE_DILIGENCE, CLOSED |

If no opportunity exists for the listing, show "Promote to pipeline to enable due diligence tracking."

### UI Component

`src/components/listings/due-diligence-panel.tsx` — placed on listing detail page after market comps panel.

- Collapsible panel with three sections
- Each section: header with completion progress bar ("Pre-NDA: 4/6 complete")
- Each item: checkbox + text + expandable notes field
- Locked items: grayed out with lock icon, tooltip "Unlocks at [Stage Name]"
- "Add Custom Item" button per section (opens inline text input)
- Custom items marked with a subtle badge

### API Routes

- `GET /api/listings/[id]/due-diligence` — returns all items; seeds defaults if none exist. Includes opportunity stage for gating logic.
- `PATCH /api/listings/[id]/due-diligence/[itemId]` — toggle `isCompleted`, update `notes`, set `completedAt`
- `POST /api/listings/[id]/due-diligence` — add custom item (body: `{ stage, itemText }`)
- `DELETE /api/listings/[id]/due-diligence/[itemId]` — remove custom items only (reject if `isCustom === false`)

---

## Feature 3: Market Data Dashboard

### Purpose

Visualize BVR comparable transaction data across all four target ranks — multiples distributions, market trends, deal structure patterns, and revenue concentration.

### Architecture

New page integrated into existing Market Intel section at `/market-intel/comparables`. Uses Recharts for all charts. Single API endpoint returns all dashboard data per rank to minimize round-trips.

### New Dependency

`recharts` — React charting library (~200KB). Install as production dependency.

### Page Layout

**Navigation:** Add "Comparables" link to market intel nav alongside existing Overview and Map links.

**Structure:**
```
┌─────────────────────────────────────────────────────┐
│  [MSP] [UCaaS] [Security] [Cabling]    ← rank tabs  │
├─────────────────────────────────────────────────────┤
│  Revenue: [====slider====]  Date: [1yr|3yr|5yr|All] │
├─────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  │ N txn│ │Med   │ │Med   │ │Date  │  ← summary    │
│  │      │ │EBITDA│ │Rev   │ │Range │    cards       │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
├─────────────────────────────────────────────────────┤
│  EBITDA Multiple  │ Revenue Multiple │ SDE Multiple  │
│  [histogram]      │ [histogram]      │ [histogram]   │
│  min|P25|med|P75  │ min|P25|med|P75  │ min|P25|med   │
├─────────────────────────────────────────────────────┤
│  Market Trend (line chart)        │ Deal Structure  │
│  Avg EBITDA mult by year          │ (bar chart)     │
│  + volume overlay                 │ cash|note|earn  │
├─────────────────────────────────────────────────────┤
│  Revenue Size Distribution (bar chart)              │
│  <500K | 500K-1M | 1M-2M | 2M-3M | 3M+            │
└─────────────────────────────────────────────────────┘
```

**Empty state per tab:** "No BVR data imported for [rank label]. Import comparable transactions in Settings → Thesis → Market Data."

### API Route

`GET /api/market-intel/bvr-dashboard?rank=1&revenueMin=X&revenueMax=Y&dateRange=3yr`

Returns a single JSON payload:

```typescript
interface BvrDashboardData {
  summary: {
    transactionCount: number;
    medianEbitdaMultiple: number | null;
    medianRevenueMultiple: number | null;
    dateRange: { earliest: string; latest: string } | null;
  };
  ebitdaHistogram: Array<{ bucket: string; count: number }>;
  revenueMultipleHistogram: Array<{ bucket: string; count: number }>;
  sdeMultipleHistogram: Array<{ bucket: string; count: number }>;
  ebitdaStats: { min: number; p25: number; median: number; p75: number; max: number; mean: number } | null;
  revenueStats: { min: number; p25: number; median: number; p75: number; max: number; mean: number } | null;
  sdeStats: { min: number; p25: number; median: number; p75: number; max: number; mean: number } | null;
  trendByYear: Array<{ year: string; avgEbitdaMultiple: number; count: number }>;
  dealStructure: {
    avgPctCashAtClose: number | null;
    avgSellerNotePct: number | null;
    pctWithEarnout: number | null;
    avgSellerNoteTermYears: number | null;
  };
  revenueDistribution: Array<{ bucket: string; count: number }>;
}
```

### Chart Components

All charts use Recharts:
- **Histograms:** `<BarChart>` with bucket labels on X-axis, count on Y-axis, `<ReferenceLine>` for median
- **Trend line:** `<ComposedChart>` with `<Line>` for avg multiple + `<Bar>` for volume
- **Deal structure:** `<BarChart>` horizontal with % values
- **Revenue distribution:** `<BarChart>` with bucket labels

Charts are Tailwind-themed: use CSS variables for colors matching the app's design system.

---

## Feature 4: Priority A Fast-Track Package

### Purpose

Auto-generate a comprehensive deal package for listings scoring ≥80 (Tier A). Provides instant decision support: what this target is, why it fits, what it's worth, and what to do next. Available as on-screen collapsible section AND downloadable PDF.

### New Schema Model

```prisma
model PriorityAPackage {
  id        String  @id @default(cuid())
  listingId String  @unique
  listing   Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  executiveSummary  String   @db.Text
  acquisitionThesis String   @db.Text
  valuationSnapshot Json
  generatedAt       DateTime @default(now())

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Add relation to Listing model:
```prisma
priorityAPackage PriorityAPackage?
```

### Package Contents (5 sections)

**1. Executive Summary** (computed from listing data, no AI):
- Company name, location, target rank label
- Key financials: revenue, EBITDA, asking price, implied EBITDA multiple
- Acquisition score + sub-score breakdown
- Disqualifiers (if any)
- One-line AI-generated synopsis (from thesis)

**2. Acquisition Thesis** (AI-generated):
- New engine: `src/lib/ai/acquisition-thesis-generator.ts`
- Calls Claude with: listing profile fields, rank description, synergy notes from AcquisitionThesisConfig, scoring breakdown, BVR comps summary stats
- Generates 2-3 paragraphs: why this rank matters for PMS, how Liam's background fills the operational gap, key risks and mitigations, recommended timeline
- Cached in `PriorityAPackage.acquisitionThesis`

**3. Valuation Summary** (computed from BVR comps + deal calculator):
- Three columns: Conservative (BVR P25 multiple), Target (BVR median), Stretch (BVR P75)
- Each column: EBITDA multiple, implied price, deal structure recommendation
- SDE adjustment if applicable
- PMS bridge runway per scenario
- Stored as JSON in `PriorityAPackage.valuationSnapshot`

**4. Due Diligence Status** (references Feature 2):
- Shows Pre-NDA checklist with current completion status
- "Complete X remaining items to advance to NDA"
- Link to full checklist

**5. Outreach Draft** (references Layer 2):
- Auto-selects Template A (direct owner) or B (broker) based on listing context
- "Generate & Copy" button to create personalized draft

### Generation Triggers

1. **Auto-trigger:** When `acquisitionScore` is updated via the scoring endpoint and result is ≥80, check if package exists. If not, generate asynchronously.
2. **Manual trigger:** "Generate Package" button on any Tier A listing detail page.
3. **Regeneration:** "Regenerate" button if listing `updatedAt` > package `generatedAt` (stale indicator).

### API Routes

- `POST /api/listings/[id]/priority-a-package` — generate/regenerate package
  - Fetches listing, BVR comps stats, thesis config
  - Calls AI for acquisition thesis
  - Computes valuation scenarios from BVR percentiles
  - Upserts PriorityAPackage record
  - Returns generated package
- `GET /api/listings/[id]/priority-a-package` — return cached package (404 if not generated)
- `GET /api/listings/[id]/priority-a-package/pdf` — generate PDF and return as download
  - Uses `@react-pdf/renderer` to convert package data into formatted PDF
  - Filename: `Priority-A-[CompanyName]-[YYYY-MM-DD].pdf`

### PDF Generation

`@react-pdf/renderer` — React components that render to PDF server-side. Installed as production dependency.

PDF layout:
- Letter size (8.5" × 11")
- Header: "PRIORITY A — DEAL PACKAGE" + company name + date
- 5 sections matching on-screen layout
- Formatted tables for valuation scenarios
- Checklist with ☑/☐ symbols
- Footer: "Generated by DealFlow — Confidential"

### UI Component

`src/components/listings/priority-a-panel.tsx`

- Only renders when `listing.acquisitionTier === "A"`
- Collapsible panel on listing detail page (after due diligence panel)
- Header: "Priority A Package" with generation date + "Download PDF" button + "Regenerate" button
- 5 collapsible sections matching package contents
- Stale indicator: yellow badge "Data changed since generation — click Regenerate"
- Loading state during AI generation (with progress: "Generating thesis..." → "Computing valuation..." → "Done")

### New Dependencies

- `@react-pdf/renderer` — PDF generation from React components

---

## Implementation Sequence

### Phase A: BVR Query Assistant
1. Add query guide reference data (SIC/NAICS descriptions) and UI to BvrImportSection

### Phase B: Due Diligence Checklists
2. Add DueDiligenceItem model to schema + migrate
3. Build due diligence API routes (GET/PATCH/POST/DELETE with lazy seeding)
4. Build due diligence panel UI with stage-gating
5. Wire into listing detail page

### Phase C: Market Data Dashboard
6. Install Recharts
7. Build BVR dashboard API (aggregation + histogram bucketing)
8. Build dashboard page with rank tabs + filters
9. Build chart components (histograms, trend line, deal structure, revenue distribution)
10. Add navigation link to market intel section

### Phase D: Priority A Fast-Track
11. Add PriorityAPackage model to schema + migrate
12. Install @react-pdf/renderer
13. Build acquisition thesis AI generator
14. Build Priority A package generation API (orchestrates AI + BVR + valuation)
15. Build Priority A panel UI (5-section collapsible)
16. Build PDF renderer
17. Wire auto-generation into scoring endpoint
18. Wire panel into listing detail page

---

## Technical Notes

- **Recharts bundle size:** ~200KB. Only loaded on dashboard and comps pages. Next.js dynamic import with `ssr: false` for chart components to avoid SSR hydration issues.
- **@react-pdf/renderer:** Runs server-side in API route. Does NOT affect client bundle.
- **AI cost per Priority A package:** ~$0.03–0.05 (Sonnet 4, ~3K tokens input, ~1K output). Cached after generation — only regenerated on demand.
- **Lazy seeding of DD items:** Avoids a migration to backfill all 119 existing listings. Items created on first access per listing.
- **Histogram bucketing:** Server-side computation — client receives pre-bucketed data, not raw transactions. Keeps response payload small regardless of BVR data volume.
