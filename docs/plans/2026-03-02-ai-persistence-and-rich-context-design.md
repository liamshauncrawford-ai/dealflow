# AI Persistence Standardization & Rich Financial Context

**Date:** 2026-03-02
**Status:** Approved

## Problem Statement

Two issues with AI-generated analysis across the DealFlow platform:

1. **Inconsistent persistence:** Some AI features duplicate rows on every regeneration (Weekly Brief, Deep Dive, Financial Analysis, etc.), while others are ephemeral (Valuation Commentary). Only Risk Assessment has the full cache + edit + delete pattern. Users expect: generate once, persist, regenerate replaces, editable.

2. **Stale financial data in Risk Assessment:** The AI reads denormalized `Opportunity.actualEbitda` (a cache field synced from `FinancialPeriod`) instead of live financial records. When the cache is out of sync (e.g., after a data correction), the AI generates analysis based on wrong numbers. Example: Precision Media shows EBITDA of -$1,288.97 when actual FinancialPeriod records show ~$282K.

## Design Decisions

- **Keep-latest-only:** Regenerating deletes old result and inserts new. No history.
- **Risk Assessment pattern everywhere:** 24-hour cache window, PATCH to edit, DELETE to remove.
- **Shared utility layer:** Centralized `analysis-manager.ts` handles lifecycle.
- **Live financial data:** Risk Assessment reads `FinancialPeriod` + `HistoricPnL` + `ValuationModel` directly, not stale Opportunity cache fields.
- **Valuation Commentary persists** to `ValuationModel.aiCommentary`.
- **Email Template Generation stays ephemeral.**

---

## Workstream 1: Analysis Manager Utility

### New File: `src/lib/ai/analysis-manager.ts`

Four core functions:

```typescript
// Returns latest cached AIAnalysisResult for entity+type, or null
getLatestAnalysis(opts: {
  opportunityId?: string;
  listingId?: string;
  documentId?: string;
  analysisType: string;
}): Promise<AIAnalysisResult | null>

// Checks cache (default 24h). If fresh, returns cached result.
// If stale/absent: calls generateFn, deletes ALL old results for entity+type, inserts new.
generateAnalysis(opts: {
  opportunityId?: string;
  listingId?: string;
  documentId?: string;
  analysisType: string;
  cacheHours?: number; // default 24
  modelUsed?: string;
  generateFn: () => Promise<{ resultData: unknown; inputTokens?: number; outputTokens?: number }>;
}): Promise<{ result: AIAnalysisResult; cached: boolean }>

// Merges partial updates into resultData JSON
editAnalysis(analysisId: string, updates: Record<string, unknown>): Promise<AIAnalysisResult>

// Hard-deletes the result row
deleteAnalysis(analysisId: string): Promise<void>
```

### WeeklyBrief Helpers (same file)

```typescript
generateBrief(opts: {
  cacheHours?: number;
  generateFn: () => Promise<WeeklyBriefData>;
}): Promise<{ brief: WeeklyBrief; cached: boolean }>

editBrief(briefId: string, updates: Partial<WeeklyBriefData>): Promise<WeeklyBrief>
deleteBrief(briefId: string): Promise<void>
```

### ValuationCommentary Helper

```typescript
generateValuationCommentary(opts: {
  valuationModelId: string;
  generateFn: () => Promise<unknown>;
}): Promise<{ commentary: unknown; cached: boolean }>
```

Writes to `ValuationModel.aiCommentary` field. Regenerating overwrites.

---

## Workstream 2: Feature Integration

### Group 1 — AIAnalysisResult Features (9 features)

Each route refactored to use `generateAnalysis()`:

| Feature | analysisType | Entity Key | Changes |
|---|---|---|---|
| Deep Dive | `DEEP_DIVE` | `listingId` | POST → `generateAnalysis()`. Add PATCH + DELETE |
| Enrichment | `ENRICHMENT` | `listingId` | POST → `generateAnalysis()`. Add PATCH + DELETE. Keep null-guard on listing fields |
| Risk Assessment | `RISK_ASSESSMENT` | `opportunityId` | POST → `generateAnalysis()`. Already has PATCH + DELETE |
| CIM Analysis | `CIM_EXTRACTION` | `opportunityId` + `documentId` | Add GET + PATCH + DELETE. Keep per-document cache key |
| Financial Extraction | `FINANCIAL_EXTRACTION` | `opportunityId` | Add GET + PATCH + DELETE |
| Financial Analysis | `FINANCIAL_ANALYSIS` | `opportunityId` | Add GET + PATCH + DELETE |
| Outreach Draft | `OUTREACH_DRAFT` | `listingId` | Simplify GET to latest. Add PATCH + DELETE |
| Meeting Notes | `MEETING_NOTES_EXTRACTION` | `opportunityId` | Add GET + PATCH + DELETE. Keep two-Note creation |
| Daily Scan | `DAILY_SCAN` | `listingId` | POST → `generateAnalysis()`. Add GET |

### Group 2 — Special Models (3 features)

| Feature | Changes |
|---|---|
| Weekly Brief | POST → `generateBrief()` (delete-then-create). Add PATCH + DELETE handlers |
| Valuation Commentary | POST → write to `ValuationModel.aiCommentary`. Add GET + PATCH + DELETE |
| Pipeline Summarize | Already overwrites. No change needed |

### Group 3 — No Changes (4 features)

Intelligence Feed (read-only), Email Template Gen (stays ephemeral), Email Classification (bulk overwrite), News Monitor (URL-deduped).

---

## Workstream 3: Rich Financial Context for Risk Assessment

### Problem

`risk-assessment.ts` → `buildAssessmentContext()` reads only:
- `Opportunity.actualEbitda` (stale cache)
- `Listing.ebitda` (broker snapshot)
- CIM extraction (if available)

### Solution

Expand the Prisma query in `assessDealRisk()` to include:

```typescript
const opp = await prisma.opportunity.findUnique({
  where: { id: opportunityId },
  include: {
    listing: { include: { sources: true, tags: true } },
    contacts: true,
    emails: { take: 20, orderBy: { receivedAt: "desc" }, select: { ... } },
    documents: { select: { ... } },
    notes: { take: 10, orderBy: { createdAt: "desc" } },
    aiAnalyses: {
      where: { analysisType: { in: ["CIM_EXTRACTION", "FINANCIAL_ANALYSIS"] } },
      orderBy: { createdAt: "desc" },
      take: 2,
    },
    // NEW: Live financial data
    financialPeriods: {
      include: { lineItems: true, addBacks: true },
      orderBy: { periodEnd: "desc" },
    },
    // NEW: Valuation scenarios
    valuations: {
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  },
});

// NEW: Historic P&L (separate table, no direct relation)
const historicPnL = await prisma.historicPnL.findMany({
  where: { opportunityId },
  orderBy: { year: "asc" },
});
```

### Enhanced Prompt Structure

`buildAssessmentContext()` updated to produce:

```
=== VERIFIED FINANCIAL DATA (FinancialPeriod records — source of truth) ===
FY2022: Revenue $X | COGS $X | Gross Profit $X (margin%)
  Operating Expenses $X | EBITDA $X | Adj. EBITDA $X (margin%)
  Add-backs: [category: $amount, ...]
FY2023: [same structure]
FY2024: [same structure]
YoY Revenue Growth: X% → X%
YoY Adj. EBITDA Growth: X% → X%

=== HISTORIC P&L (raw spreadsheet data, if available) ===
[year-by-year summary from HistoricPnL records]

⚠ DATA DISCREPANCY (if detected):
Opportunity cache says EBITDA = $X but FinancialPeriod shows $Y.
Treat FinancialPeriod as authoritative.

=== PRIOR FINANCIAL ANALYSIS (if available) ===
[AI analysis summary, confidence score, red flags from FINANCIAL_ANALYSIS result]

=== VALUATION CONTEXT (if available) ===
Entry Multiple: Xx Adj. EBITDA
Implied Enterprise Value: $X
DSCR: Xx | IRR: X% | MOIC: Xx
Deal Structure: [from ValuationModel.inputs]

=== DEAL INFORMATION ===
[existing: offer price, listing data, CIM data, contacts, emails, notes]
```

### Discrepancy Detection

Add a helper function that compares:
- `Opportunity.actualEbitda` vs latest `FinancialPeriod.adjustedEbitda`
- `Listing.ebitda` vs `FinancialPeriod.ebitda`
- `Listing.revenue` vs `FinancialPeriod.totalRevenue`

If any differ by > 10%, include a warning in the prompt instructing the AI to use FinancialPeriod data as the source of truth.

### Auto-Sync Fix

After regenerating the risk assessment, if a discrepancy was detected, also re-run `syncOpportunitySummary(opportunityId)` to fix the stale Opportunity cache. This prevents the discrepancy from recurring.

---

## Implementation Order

1. **Analysis Manager utility** — foundation for everything else
2. **Weekly Brief integration** — the user's primary trigger for this work
3. **Risk Assessment enrichment** — fix the financial data quality issue
4. **Remaining AIAnalysisResult features** — Deep Dive, Enrichment, CIM, Financials, Outreach, Meeting Notes, Daily Scan
5. **Valuation Commentary persistence** — save to existing field
6. **Build + test** — verify all features
