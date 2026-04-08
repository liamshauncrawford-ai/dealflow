# Layer 3: Intelligence & Deal Analysis — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add BVR query assistant, due diligence checklists, market data dashboard, and Priority A fast-track package generator to DealFlow.

**Architecture:** Four features in ascending complexity. Query assistant extends existing BVR import UI. DD checklists add a new Prisma model with lazy-seeded defaults and stage-gating. Market dashboard uses Recharts for BVR data visualization in a new market-intel page. Priority A orchestrates AI + BVR + valuation into a cacheable deal package with PDF export.

**Tech Stack:** Next.js 16, TypeScript, Prisma/PostgreSQL, TanStack Query, Tailwind CSS, Recharts, @react-pdf/renderer, Claude API (via existing `callClaude`)

**Design doc:** `docs/plans/2026-04-08-layer3-intelligence-design.md`

---

## Phase A: BVR Query Assistant

### Task 1: Add Query Guide Panel to BVR Import Section

**Files:**
- Create: `src/lib/bvr/sic-naics-descriptions.ts`
- Modify: `src/components/settings/bvr-import-section.tsx`

**Step 1: Create SIC/NAICS description lookup**

Create `src/lib/bvr/sic-naics-descriptions.ts`:

```typescript
/**
 * SIC and NAICS code descriptions for BVR query guidance.
 * Organized by target rank.
 */

export interface CodeDescription {
  code: string;
  description: string;
}

export interface RankQueryGuide {
  rank: number;
  label: string;
  color: string; // Tailwind color class
  sicCodes: CodeDescription[];
  naicsCodes: CodeDescription[];
  dateRangeAdvice: string;
  searchTips: string[];
}

export const RANK_QUERY_GUIDES: RankQueryGuide[] = [
  {
    rank: 1,
    label: "MSP",
    color: "blue",
    sicCodes: [
      { code: "7376", description: "Computer Facilities Management Services" },
      { code: "7379", description: "Computer Related Services, NEC" },
      { code: "7374", description: "Computer Processing & Data Preparation" },
    ],
    naicsCodes: [
      { code: "541512", description: "Computer Systems Design Services" },
      { code: "541513", description: "Computer Facilities Management Services" },
      { code: "541519", description: "Other Computer Related Services" },
      { code: "518210", description: "Data Processing, Hosting & Related Services" },
    ],
    dateRangeAdvice: "Last 3–5 years for statistical significance",
    searchTips: [
      "In DealStats, search by SIC Code first — it yields the most relevant results",
      "Filter revenue to your soft target range to focus on comparable-sized deals",
      "Export all columns — the import module will filter to relevant fields",
    ],
  },
  {
    rank: 2,
    label: "UCaaS",
    color: "purple",
    sicCodes: [
      { code: "4813", description: "Telephone Communications (No Radiotelephone)" },
      { code: "7372", description: "Prepackaged Software" },
      { code: "7379", description: "Computer Related Services, NEC" },
      { code: "4899", description: "Communications Services, NEC" },
    ],
    naicsCodes: [
      { code: "517312", description: "Wireless Telecommunications Carriers" },
      { code: "517911", description: "Telecommunications Resellers" },
      { code: "541512", description: "Computer Systems Design Services" },
      { code: "519190", description: "All Other Information Services" },
    ],
    dateRangeAdvice: "Last 3–5 years for statistical significance",
    searchTips: [
      "UCaaS transactions may appear under telecom SIC codes — check 4813 and 4899",
      "BizComps may have more small UCaaS deals than DealStats",
      "Filter by employee count 5–50 to match your target size",
    ],
  },
  {
    rank: 3,
    label: "Security Integration",
    color: "amber",
    sicCodes: [
      { code: "7382", description: "Home Health Care Services / Security Systems" },
      { code: "7381", description: "Investigation & Security Services" },
      { code: "1731", description: "Electrical Work" },
      { code: "5065", description: "Electronic Parts & Equipment (Wholesale)" },
    ],
    naicsCodes: [
      { code: "561621", description: "Security Systems Services (except Locksmiths)" },
      { code: "238210", description: "Electrical Contractors & Other Wiring" },
      { code: "423690", description: "Other Electronic Parts & Equipment (Wholesale)" },
    ],
    dateRangeAdvice: "Last 3–5 years for statistical significance",
    searchTips: [
      "Security integration overlaps with alarm monitoring — check both 7382 and 561621",
      "Commercial-only deals may need manual filtering after export",
      "Look for 'monitoring contracts' or 'RMR' in deal descriptions for recurring revenue",
    ],
  },
  {
    rank: 4,
    label: "Structured Cabling",
    color: "emerald",
    sicCodes: [
      { code: "1731", description: "Electrical Work" },
      { code: "1799", description: "Special Trade Contractors, NEC" },
      { code: "1711", description: "Plumbing, Heating & Air-Conditioning" },
    ],
    naicsCodes: [
      { code: "238210", description: "Electrical Contractors & Other Wiring" },
      { code: "238290", description: "Other Building Equipment Contractors" },
      { code: "561990", description: "All Other Support Services" },
    ],
    dateRangeAdvice: "Last 5 years — cabling deals are less frequent",
    searchTips: [
      "Cabling is often categorized under general electrical (SIC 1731) — expect mixed results",
      "Filter by revenue $500K–$3M to match target range",
      "BizComps may have more cabling deals than DealStats due to smaller transaction sizes",
    ],
  },
];
```

**Step 2: Add query guide UI to BvrImportSection**

Read `src/components/settings/bvr-import-section.tsx` first. Add a collapsible "BVR Query Guide" panel above the file upload area. The panel should:

- Be collapsible with a toggle (default collapsed)
- Show 4 tabs (one per rank) using simple button-based tab switching
- Each tab displays: SIC codes table, NAICS codes table, revenue range (from thesis config if available), date range advice, search tips as bullet list
- Step-by-step instructions at the bottom:
  1. Log into DealStats (or BizComps)
  2. Navigate to Search → SIC Code
  3. Enter the codes listed above
  4. Set Revenue filter to recommended range
  5. Set Date Range to last 3–5 years
  6. Export to Excel (.xlsx)
  7. Upload using the form below

Import the `RANK_QUERY_GUIDES` from the descriptions file.

**Step 3: Commit**

```bash
git add src/lib/bvr/sic-naics-descriptions.ts src/components/settings/bvr-import-section.tsx
git commit -m "feat: BVR query guide panel with SIC/NAICS reference per rank"
```

---

## Phase B: Due Diligence Checklists

### Task 2: Add DueDiligenceItem Model to Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add model**

In `prisma/schema.prisma`, after the `BvrImportHistory` model (at the end of the BVR section), add:

```prisma
// ─────────────────────────────────────────────
// DUE DILIGENCE CHECKLISTS
// ─────────────────────────────────────────────

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

Also add the relation to the Listing model. Find the relations block in the Listing model (around line 162) and add:

```prisma
  dueDiligenceItems DueDiligenceItem[]
```

**Step 2: Push schema and regenerate**

```bash
cd /Users/liamcrawford/dealflow && npx prisma db push && npx prisma generate
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add DueDiligenceItem model with stage-gating"
```

---

### Task 3: Build Due Diligence Default Items and API

**Files:**
- Create: `src/lib/due-diligence/defaults.ts`
- Create: `src/app/api/listings/[id]/due-diligence/route.ts`
- Create: `src/app/api/listings/[id]/due-diligence/[itemId]/route.ts`

**Step 1: Create default items definition**

Create `src/lib/due-diligence/defaults.ts`:

```typescript
/**
 * Default due diligence checklist items, seeded per listing on first access.
 *
 * Stage gating maps to PipelineStage enum values:
 *   PRE_NDA  → visible when any opportunity exists
 *   POST_NDA → unlocks at SIGNED_NDA or later
 *   LOI_DD   → unlocks at OFFER_SENT or later
 */

export interface DefaultDDItem {
  stage: "PRE_NDA" | "POST_NDA" | "LOI_DD";
  itemText: string;
  order: number;
}

export const DEFAULT_DD_ITEMS: DefaultDDItem[] = [
  // Pre-NDA (6 items)
  { stage: "PRE_NDA", itemText: "Verify listing is still active", order: 1 },
  { stage: "PRE_NDA", itemText: "Confirm geographic location within Denver metro", order: 2 },
  { stage: "PRE_NDA", itemText: "Identify owner name and contact information", order: 3 },
  { stage: "PRE_NDA", itemText: "Check for public records of litigation", order: 4 },
  { stage: "PRE_NDA", itemText: "Check if owner is active on LinkedIn", order: 5 },
  { stage: "PRE_NDA", itemText: "Cross-reference with BVR comparable transactions", order: 6 },

  // Post-NDA (10 items)
  { stage: "POST_NDA", itemText: "Request 3 years of tax returns / P&L statements", order: 1 },
  { stage: "POST_NDA", itemText: "Verify MRR by reviewing active contracts", order: 2 },
  { stage: "POST_NDA", itemText: "Confirm client concentration (no single client >15%)", order: 3 },
  { stage: "POST_NDA", itemText: "Request technician org chart", order: 4 },
  { stage: "POST_NDA", itemText: "Verify Colorado licensing", order: 5 },
  { stage: "POST_NDA", itemText: "Request accounts receivable aging report", order: 6 },
  { stage: "POST_NDA", itemText: "Confirm SBA eligibility", order: 7 },
  { stage: "POST_NDA", itemText: "Obtain key employee list and tenure", order: 8 },
  { stage: "POST_NDA", itemText: "Understand owner's transition timeline", order: 9 },
  { stage: "POST_NDA", itemText: "Request list of top 10 clients with revenue per client", order: 10 },

  // LOI / Due Diligence (8 items)
  { stage: "LOI_DD", itemText: "Engage M&A attorney", order: 1 },
  { stage: "LOI_DD", itemText: "Engage CPA for Quality of Earnings review", order: 2 },
  { stage: "LOI_DD", itemText: "SBA lender pre-approval confirmation", order: 3 },
  { stage: "LOI_DD", itemText: "Environmental/title review on any real property", order: 4 },
  { stage: "LOI_DD", itemText: "Employment agreement review", order: 5 },
  { stage: "LOI_DD", itemText: "Client contract assignability review", order: 6 },
  { stage: "LOI_DD", itemText: "Non-compete agreement drafted", order: 7 },
  { stage: "LOI_DD", itemText: "Key employee retention plan", order: 8 },
];

/**
 * Stage unlock mapping: which PipelineStage values unlock each DD stage.
 * PRE_NDA: always visible when opportunity exists
 * POST_NDA: SIGNED_NDA and beyond
 * LOI_DD: OFFER_SENT and beyond
 */
const LATE_STAGES = new Set([
  "OFFER_SENT",
  "COUNTER_OFFER_RECEIVED",
  "UNDER_CONTRACT",
  "CLOSED_WON",
]);

const NDA_AND_LATER = new Set([
  "SIGNED_NDA",
  "SCHEDULING_FIRST_MEETING",
  "DUE_DILIGENCE",
  ...LATE_STAGES,
]);

export function isStageUnlocked(
  ddStage: string,
  pipelineStage: string | null,
): boolean {
  if (!pipelineStage) return ddStage === "PRE_NDA";
  if (ddStage === "PRE_NDA") return true;
  if (ddStage === "POST_NDA") return NDA_AND_LATER.has(pipelineStage);
  if (ddStage === "LOI_DD") return LATE_STAGES.has(pipelineStage);
  return false;
}
```

**Step 2: Create DD API routes**

Create `src/app/api/listings/[id]/due-diligence/route.ts`:

**GET handler:**
1. Fetch listing with opportunity (to get pipeline stage)
2. Count existing DD items for this listing
3. If count === 0, seed defaults from `DEFAULT_DD_ITEMS` via `createMany`
4. Fetch all items ordered by `stage` then `order`
5. Return `{ items, pipelineStage: opportunity?.stage ?? null }`

**POST handler** (add custom item):
1. Body: `{ stage: string, itemText: string }`
2. Validate stage is one of PRE_NDA, POST_NDA, LOI_DD
3. Get max order for that stage, set new order = max + 1
4. Create item with `isCustom: true`
5. Return created item

Create `src/app/api/listings/[id]/due-diligence/[itemId]/route.ts`:

**PATCH handler** (toggle completion / update notes):
1. Body: `{ isCompleted?: boolean, notes?: string }`
2. If `isCompleted` is true, set `completedAt = new Date()`
3. If `isCompleted` is false, set `completedAt = null`
4. Update and return item

**DELETE handler** (remove custom items only):
1. Find item, verify `isCustom === true`
2. If not custom, return 403: "Cannot delete default checklist items"
3. Delete and return 204

**Step 3: Commit**

```bash
git add src/lib/due-diligence/ src/app/api/listings/\\[id\\]/due-diligence/
git commit -m "feat: due diligence API with lazy seeding and stage-gating"
```

---

### Task 4: Build Due Diligence Panel UI

**Files:**
- Create: `src/components/listings/due-diligence-panel.tsx`

**Step 1: Build the component**

Create `src/components/listings/due-diligence-panel.tsx`:

- **"use client"** directive
- **Props**: `listingId: string`
- **Data fetching**: `useQuery` from `GET /api/listings/${listingId}/due-diligence`
- **Mutations**: useMutation for PATCH (toggle/notes), POST (add custom), DELETE (remove custom)

**Layout:**
- Collapsible panel: `rounded-lg border bg-card p-5`
- Header: "Due Diligence Checklist" with expand/collapse toggle
- Three sections (PRE_NDA, POST_NDA, LOI_DD), each with:
  - Section header: stage name + completion progress bar (e.g., "Pre-NDA: 4/6")
  - Items list:
    - Unlocked items: checkbox + text + expand button for notes
    - Locked items: grayed out checkbox (disabled) + text + lock icon + "Unlocks at [Stage]" tooltip
    - Custom items: subtle "Custom" badge + delete button (trash icon)
  - "Add Item" button at bottom of each section (inline text input on click)
- No opportunity state: "Promote to pipeline to enable due diligence tracking"

**Stage gating logic:**
- Import `isStageUnlocked` from `@/lib/due-diligence/defaults`
- Pass `pipelineStage` from API response
- For each item, check `isStageUnlocked(item.stage, pipelineStage)`

**Progress calculation:**
```typescript
const completed = items.filter(i => i.isCompleted).length;
const total = items.length;
const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
```

**Step 2: Commit**

```bash
git add src/components/listings/due-diligence-panel.tsx
git commit -m "feat: due diligence panel with stage-gated checklists"
```

---

### Task 5: Wire Due Diligence Panel Into Detail Page

**Files:**
- Modify: `src/app/(dashboard)/listings/[id]/page.tsx`

**Step 1: Add import and render**

Add import:
```typescript
import { DueDiligencePanel } from "@/components/listings/due-diligence-panel";
```

Find where `MarketCompsPanel` ends (around line 588). After it, before the AI Deep Dive section, add:

```tsx
{/* Due Diligence Checklist */}
<DueDiligencePanel listingId={listing.id} />
```

**Step 2: Commit**

```bash
git add src/app/\\(dashboard\\)/listings/\\[id\\]/page.tsx
git commit -m "feat: wire due diligence panel into listing detail page"
```

---

## Phase C: Market Data Dashboard

### Task 6: Install Recharts

**Step 1: Install**

```bash
cd /Users/liamcrawford/dealflow && npm install recharts
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts charting library"
```

---

### Task 7: Build BVR Dashboard API

**Files:**
- Create: `src/app/api/market-intel/bvr-dashboard/route.ts`

**Step 1: Implement dashboard data endpoint**

Create `src/app/api/market-intel/bvr-dashboard/route.ts`:

**GET handler** — query params: `rank` (required), `revenueMin`, `revenueMax`, `dateRange` (1yr/3yr/5yr/all)

1. Parse and validate params
2. Build `where` clause for BvrTransaction:
   - `targetRank: rank`
   - Revenue filter: `revenue: { gte: revenueMin, lte: revenueMax }` (if provided)
   - Date filter: `transactionDate: { gte: cutoffDate }` based on dateRange
3. Fetch matching transactions (select only needed fields)
4. Compute all dashboard data server-side:

**Summary stats:**
```typescript
const summary = {
  transactionCount: transactions.length,
  medianEbitdaMultiple: calcMedian(ebitdaMultiples),
  medianRevenueMultiple: calcMedian(revenueMultiples),
  dateRange: transactions.length > 0
    ? { earliest: minDate.toISOString(), latest: maxDate.toISOString() }
    : null,
};
```

**Histogram bucketing** (for each multiple type):
```typescript
function buildHistogram(values: number[], bucketSize: number = 0.5): Array<{ bucket: string; count: number }> {
  const min = Math.floor(Math.min(...values) / bucketSize) * bucketSize;
  const max = Math.ceil(Math.max(...values) / bucketSize) * bucketSize;
  const buckets: Array<{ bucket: string; count: number }> = [];
  for (let start = min; start < max; start += bucketSize) {
    const end = start + bucketSize;
    const label = `${start.toFixed(1)}x–${end.toFixed(1)}x`;
    const count = values.filter(v => v >= start && v < end).length;
    buckets.push({ bucket: label, count });
  }
  return buckets;
}
```

**Percentile stats** (reuse pattern from comps API or extract shared helper):
```typescript
function calcPercentileStats(values: number[]): PercentileStats | null { ... }
```

**Trend by year:**
```typescript
const trendByYear = Object.entries(groupByYear)
  .map(([year, txns]) => ({
    year,
    avgEbitdaMultiple: avg(txns.map(t => t.mvicEbitdaMultiple).filter(Boolean)),
    count: txns.length,
  }))
  .sort((a, b) => a.year.localeCompare(b.year));
```

**Deal structure averages:**
```typescript
const dealStructure = {
  avgPctCashAtClose: avg(cashValues),
  avgSellerNotePct: avg(noteAmounts.map((n, i) => n / mvics[i])),
  pctWithEarnout: earnoutCount / total,
  avgSellerNoteTermYears: avg(noteTerms),
};
```

**Revenue distribution** (fixed buckets):
```typescript
const revenueBuckets = [
  { label: "<$500K", min: 0, max: 500_000 },
  { label: "$500K–$1M", min: 500_000, max: 1_000_000 },
  { label: "$1M–$2M", min: 1_000_000, max: 2_000_000 },
  { label: "$2M–$3M", min: 2_000_000, max: 3_000_000 },
  { label: "$3M+", min: 3_000_000, max: Infinity },
];
```

5. Return full `BvrDashboardData` response as defined in the design doc.

**Step 2: Commit**

```bash
git add src/app/api/market-intel/bvr-dashboard/
git commit -m "feat: BVR dashboard API with histograms, trends, and deal structure"
```

---

### Task 8: Build Market Data Dashboard Page

**Files:**
- Create: `src/app/(dashboard)/market-intel/comparables/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Create the dashboard page**

Create `src/app/(dashboard)/market-intel/comparables/page.tsx`:

- **"use client"** directive
- **State**: `activeRank` (default 1), `revenueRange` [min, max], `dateRange` ("3yr" default)
- **Data fetching**: `useQuery` from `/api/market-intel/bvr-dashboard?rank=${activeRank}&...`

**Layout:**
- Page header: "Market Comparables"
- **Rank tabs**: 4 buttons (MSP blue, UCaaS purple, Security amber, Cabling emerald), active tab highlighted
- **Filter bar**: Revenue range slider (dual-thumb or two inputs), Date range toggle buttons (1yr/3yr/5yr/All)
- **Empty state**: "No BVR data imported for [rank]. Import comparable transactions in Settings → Thesis → Market Data."
- **Loading state**: Skeleton cards

**Dashboard sections** (when data exists):
- Summary cards row (4 cards): Transaction count, Median EBITDA multiple, Median Revenue multiple, Date range
- Multiples section: 3-column grid, each column is a Recharts `<BarChart>` histogram with stats box below
- Trend + Deal Structure row: 2-column, left is `<ComposedChart>` (line + bar), right is horizontal `<BarChart>`
- Revenue distribution: full-width `<BarChart>`

**Chart wrapper pattern** (for SSR safety):
```typescript
import dynamic from "next/dynamic";
const BarChart = dynamic(() => import("recharts").then(m => m.BarChart), { ssr: false });
// ... same for other chart components
```

Actually — Recharts components can be imported directly in "use client" files. No dynamic import needed since the page is already client-side.

**Step 2: Add navigation link to sidebar**

In `src/components/layout/sidebar.tsx`, find the `marketIntelItems` array. Add a new entry:

```typescript
{ label: "Comparables", href: "/market-intel/comparables", icon: TrendingUp },
```

Import `TrendingUp` from `lucide-react` (or use `BarChart2` if TrendingUp isn't available — check existing lucide imports).

**Step 3: Commit**

```bash
git add src/app/\\(dashboard\\)/market-intel/comparables/ src/components/layout/sidebar.tsx
git commit -m "feat: market data dashboard with Recharts histograms and trend analysis"
```

---

## Phase D: Priority A Fast-Track Package

### Task 9: Add PriorityAPackage Model to Schema + Install @react-pdf/renderer

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add model**

After the `DueDiligenceItem` model, add:

```prisma
// ─────────────────────────────────────────────
// PRIORITY A FAST-TRACK PACKAGES
// ─────────────────────────────────────────────

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

**Step 2: Push schema and regenerate**

```bash
cd /Users/liamcrawford/dealflow && npx prisma db push && npx prisma generate
```

**Step 3: Install @react-pdf/renderer**

```bash
cd /Users/liamcrawford/dealflow && npm install @react-pdf/renderer
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma package.json package-lock.json
git commit -m "schema: add PriorityAPackage model; install @react-pdf/renderer"
```

---

### Task 10: Build Acquisition Thesis AI Generator

**Files:**
- Create: `src/lib/ai/acquisition-thesis-generator.ts`

**Step 1: Implement the thesis generator**

Create `src/lib/ai/acquisition-thesis-generator.ts`:

Follow the pattern in `src/lib/ai/deep-dive.ts` and `src/lib/ai/outreach-draft.ts`:

```typescript
import { callClaude, safeJsonParse } from "./claude-client";

export interface ThesisInput {
  companyName: string;
  city: string | null;
  state: string | null;
  targetRankLabel: string | null;
  revenue: number | null;
  ebitda: number | null;
  askingPrice: number | null;
  employees: number | null;
  yearsInBusiness: number | null;
  acquisitionScore: number | null;
  financialScore: number | null;
  strategicScore: number | null;
  operatorScore: number | null;
  disqualifiers: string[];
  synergyDescription: string | null; // from AcquisitionThesisConfig
  // BVR comps summary
  medianEbitdaMultiple: number | null;
  comparableCount: number;
}

export interface ThesisResult {
  synopsis: string;         // 1-2 sentence summary
  thesis: string;           // 2-3 paragraphs
  keyRisks: string[];       // 3-5 bullet points
  recommendedTimeline: string; // e.g., "4-6 weeks to LOI"
}
```

System prompt should instruct Claude to:
- Write as an M&A advisor preparing a deal brief for an operator-acquirer
- Reference PMS as the platform company (AV division in Sheridan, CO)
- Explain why this specific target type matters for the platform thesis
- Highlight how Liam's background (EMBA, sales/ops experience) fills the operator gap
- Be specific about synergies, not generic
- Identify 3-5 concrete risks with mitigations
- Recommend a realistic timeline

Temperature: 0.3 (more focused than outreach). Max tokens: 2000.

Return `{ result: ThesisResult, inputTokens, outputTokens }`.

**Step 2: Commit**

```bash
git add src/lib/ai/acquisition-thesis-generator.ts
git commit -m "feat: acquisition thesis AI generator for Priority A packages"
```

---

### Task 11: Build Priority A Package API Routes

**Files:**
- Create: `src/app/api/listings/[id]/priority-a-package/route.ts`
- Create: `src/app/api/listings/[id]/priority-a-package/pdf/route.ts`

**Step 1: Build generation and retrieval routes**

Create `src/app/api/listings/[id]/priority-a-package/route.ts`:

**GET handler:**
1. Fetch PriorityAPackage by listingId
2. If not found, return 404
3. Also fetch listing.updatedAt to check staleness
4. Return `{ package, isStale: listing.updatedAt > package.generatedAt }`

**POST handler** (generate/regenerate):
1. Fetch listing with all profile fields
2. Fetch AcquisitionThesisConfig for listing's targetRank (for synergy description)
3. Fetch BVR comps summary (query BvrTransaction for median EBITDA multiple + count, same logic as comps API)
4. Call `generateAcquisitionThesis()` with listing data + comps summary
5. Build executive summary string from listing fields (no AI needed — formatted template)
6. Build valuation snapshot:
   ```typescript
   const valuationSnapshot = {
     conservative: { multiple: bvrP25, impliedPrice: adjustedEbitda * bvrP25 },
     target: { multiple: bvrMedian, impliedPrice: adjustedEbitda * bvrMedian },
     stretch: { multiple: bvrP75, impliedPrice: adjustedEbitda * bvrP75 },
     adjustedEbitda,
     earningsType: listing.earningsType,
   };
   ```
7. Upsert PriorityAPackage (create or update):
   ```typescript
   await prisma.priorityAPackage.upsert({
     where: { listingId: id },
     create: { listingId: id, executiveSummary, acquisitionThesis: thesis.thesis, valuationSnapshot, generatedAt: new Date() },
     update: { executiveSummary, acquisitionThesis: thesis.thesis, valuationSnapshot, generatedAt: new Date() },
   });
   ```
8. Return the generated package

**Step 2: Build PDF route**

Create `src/app/api/listings/[id]/priority-a-package/pdf/route.ts`:

**GET handler:**
1. Fetch PriorityAPackage (generate if not exists by calling POST internally or require it exists)
2. Fetch listing for additional context
3. Fetch DD items for checklist section
4. Use `@react-pdf/renderer` to create PDF:

```typescript
import { renderToBuffer } from "@react-pdf/renderer";
// Import the PDF document component (create separately)
import { PriorityAPDF } from "@/lib/pdf/priority-a-pdf";

const buffer = await renderToBuffer(
  <PriorityAPDF
    listing={listing}
    package={pkg}
    ddItems={ddItems}
  />
);

return new Response(buffer, {
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="Priority-A-${listing.businessName || listing.title}-${new Date().toISOString().split("T")[0]}.pdf"`,
  },
});
```

**Step 3: Create PDF template**

Create `src/lib/pdf/priority-a-pdf.tsx`:

A React component using `@react-pdf/renderer` components (`Document`, `Page`, `Text`, `View`, `StyleSheet`). Layout:
- Page 1: Header ("PRIORITY A — DEAL PACKAGE"), Executive Summary, Acquisition Thesis
- Page 2: Valuation Summary (3-column table), Due Diligence Checklist (☑/☐ items)
- Footer on each page: "Generated by DealFlow — Confidential"

Keep styling simple — `@react-pdf/renderer` has its own StyleSheet API (not Tailwind).

**Step 4: Commit**

```bash
git add src/app/api/listings/\\[id\\]/priority-a-package/ src/lib/pdf/
git commit -m "feat: Priority A package API with generation, retrieval, and PDF export"
```

---

### Task 12: Build Priority A Panel UI

**Files:**
- Create: `src/components/listings/priority-a-panel.tsx`

**Step 1: Build the component**

Create `src/components/listings/priority-a-panel.tsx`:

- **"use client"** directive
- **Props**: `listingId: string`, `acquisitionTier: string | null`, `listingTitle: string`
- **Render guard**: Only render if `acquisitionTier === "A"`
- **Data fetching**: `useQuery` from `GET /api/listings/${listingId}/priority-a-package`
- **Mutations**: `useMutation` for POST (generate/regenerate)

**Layout:**
- Collapsible panel: `rounded-lg border bg-card p-5` with yellow-50 accent (Priority A = gold)
- Header: "Priority A Package" + generation date + stale badge (yellow if `isStale`) + "Download PDF" button + "Regenerate" button
- If no package exists: "Generate Package" button (prominent, yellow/gold) with description of what it creates
- If package exists, 5 collapsible sections:

**Section 1: Executive Summary**
- Rendered as formatted text (company name bold, key stats in a mini grid)

**Section 2: Acquisition Thesis**
- AI-generated text rendered as paragraphs
- Synopsis shown as a highlighted callout at top
- Key risks as a bulleted list
- Recommended timeline as a badge

**Section 3: Valuation Summary**
- 3-column grid: Conservative / Target / Stretch
- Each shows: multiple used, implied price, per-month cash flow
- SDE adjustment note if applicable

**Section 4: Due Diligence Status**
- Mini version of DD panel: just shows Pre-NDA completion count
- "View Full Checklist" link that scrolls to DD panel

**Section 5: Quick Actions**
- "Generate Outreach Draft" button (scrolls to outreach panel)
- "Download PDF" button (calls `/api/listings/[id]/priority-a-package/pdf`)

**Loading state during generation:** Progress indicators — "Analyzing target profile...", "Generating thesis...", "Computing valuation..."

**PDF download:**
```typescript
const downloadPdf = async () => {
  const res = await fetch(`/api/listings/${listingId}/priority-a-package/pdf`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Priority-A-${listingTitle}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Step 2: Commit**

```bash
git add src/components/listings/priority-a-panel.tsx
git commit -m "feat: Priority A panel with thesis, valuation, and PDF download"
```

---

### Task 13: Wire Priority A Panel Into Detail Page

**Files:**
- Modify: `src/app/(dashboard)/listings/[id]/page.tsx`

**Step 1: Add import and render**

Add import:
```typescript
import { PriorityAPanel } from "@/components/listings/priority-a-panel";
```

After the `DueDiligencePanel`, add:

```tsx
{/* Priority A Fast-Track Package */}
<PriorityAPanel
  listingId={listing.id}
  acquisitionTier={listing.acquisitionTier}
  listingTitle={listing.title || listing.businessName || "Untitled"}
/>
```

**Step 2: Commit**

```bash
git add src/app/\\(dashboard\\)/listings/\\[id\\]/page.tsx
git commit -m "feat: wire Priority A panel into listing detail page"
```

---

### Task 14: Auto-Generate Priority A on Score Update

**Files:**
- Modify: `src/app/api/listings/[id]/score/route.ts`

**Step 1: Add auto-generation trigger**

Read the score API route. After the acquisition score is computed and saved, add:

```typescript
// Auto-generate Priority A package if target crosses into Tier A
if (acqResult.tier === "A") {
  // Fire and forget — don't block the score response
  fetch(`${request.nextUrl.origin}/api/listings/${id}/priority-a-package`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch(() => {
    // Silently fail — package can be generated manually
    console.warn(`Failed to auto-generate Priority A package for listing ${id}`);
  });
}
```

This is a fire-and-forget call — the score endpoint returns immediately while the package generates in the background.

**Step 2: Commit**

```bash
git add src/app/api/listings/\\[id\\]/score/route.ts
git commit -m "feat: auto-generate Priority A package when score reaches Tier A"
```

---

## Final Steps

### Task 15: Build Check and Test

**Step 1: Run unit tests**

```bash
cd /Users/liamcrawford/dealflow && npx vitest run
```

Expected: All tests pass (existing deal structure calculator tests).

**Step 2: Build check**

```bash
cd /Users/liamcrawford/dealflow && npm run build
```

Expected: Build succeeds with no type errors.

**Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: address build issues from Layer 3 implementation"
```

---

### Task 16: Deploy to Production

**Step 1: Push to main**

```bash
git push origin main
```

Railway auto-deploys. The `start.sh` script runs `prisma migrate deploy` with fallback to `db push`, which will create the new DueDiligenceItem and PriorityAPackage tables.

**Step 2: Verify production**

```bash
curl -s -o /dev/null -w "%{http_code}" https://dealflow-production-0240.up.railway.app/
```

Expected: 200
