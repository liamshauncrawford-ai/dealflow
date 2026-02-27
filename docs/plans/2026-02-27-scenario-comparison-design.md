# Scenario Comparison View — Design Document

**Date**: 2026-02-27
**Status**: Approved

## Problem

The valuation tab supports creating, saving, renaming, and editing multiple scenarios per opportunity. However, there is no way to visually compare scenarios side-by-side. Users must mentally compare by flipping between saved scenarios one at a time.

## Solution

Add a **"Compare" sub-tab** within the existing Valuation tab. The "Model" sub-tab keeps the current scenario editor unchanged. The "Compare" sub-tab renders a hybrid dashboard: KPI comparison table + Recharts visualizations + AI-powered deal comparison.

## User Decisions

- Comparison view lives as a sub-tab within Valuation ("Model" | "Compare")
- Full financial comparison (not just KPI snapshot)
- Hybrid layout: table at top for precision, charts below for trends
- 2-3 scenarios compared at once (PE standard base/aggressive/conservative)
- AI-powered comparison analysis (Claude generates deal-specific intelligence)

---

## Section 1: Scenario Selector

Checkbox row at the top of the Compare sub-tab. Shows all saved scenarios for this opportunity with their custom names. User checks 2-3 to include in the comparison. Unchecked scenarios are excluded from all visualizations.

If fewer than 2 scenarios are saved, the Compare tab shows an empty state: "Save at least 2 scenarios in the Model tab to compare them here."

---

## Section 2: KPI Comparison Table

Row-per-metric, column-per-scenario table. Grouped by PE best-practice categories:

### Metrics

**Deal Structure**
- Enterprise Value
- Equity Check
- Bank Debt
- Seller Note
- Entry Multiple

**Returns**
- MOIC
- IRR
- Cash-on-Cash Return (Y1)

**Debt Capacity**
- DSCR
- Total Annual Debt Service

**Cash Flow**
- Y1 Adjusted EBITDA
- Y1 Pre-Tax Cash Flow
- Y1 After-Tax Cash Flow

**Exit Analysis**
- Exit Year
- Exit EV
- Remaining Debt at Exit
- Equity to Buyer
- Total Return

### Visual Treatment

- Best value per row: subtle green background
- Worst value per row: subtle red background
- DSCR below 1.25x: warning badge (SBA underwriting threshold)
- IRR below 15%: flagged as below typical PE hurdle rate
- Delta column (when 2 scenarios): shows absolute and percentage difference

---

## Section 3: Charts (Recharts)

### Chart 1 — Revenue & EBITDA Projection Overlay

- Type: Line chart (two panels side-by-side)
- X-axis: Year 1 through Year 10 (or max exit year)
- Lines: One per scenario, color-coded with legend
- Purpose: Visual "spread" shows how much assumptions diverge over time

### Chart 2 — Cumulative FCF & Debt Paydown

- Type: Area chart (FCF) with overlaid dotted lines (debt balance)
- X-axis: Year 1 through exit year
- Area fill: Cumulative free cash flow per scenario (semi-transparent)
- Dotted lines: Remaining debt balance per scenario
- Purpose: The crossover point where cumulative FCF exceeds remaining debt is the "money-back" moment

### Chart 3 — Capital Structure Comparison

- Type: Horizontal stacked bar chart
- One bar per scenario showing Equity / Bank Debt / Seller Note proportions
- Purpose: Quick visual comparison of leverage across scenarios

---

## Section 4: AI Scenario Comparison

A "Compare with AI" button that sends all selected scenarios to Claude Sonnet and generates structured comparison analysis.

### AI Output Structure

1. **Verdict** — "Scenario X is the recommended structure because..." (2-3 sentences)
2. **Risk-Adjusted Assessment** — Which scenario has the best risk/return profile? Flags scenarios where returns depend too heavily on a single lever
3. **Value Creation Bridge** — For each scenario: what % of returns come from EBITDA growth vs. multiple expansion vs. debt paydown (PE standard IRR decomposition)
4. **Covenant & Underwriting Check** — Would each scenario pass SBA 7(a) underwriting (DSCR >= 1.25x)? Would bank lenders be comfortable?
5. **Downside Resilience** — "If EBITDA drops 20%, Scenario A's DSCR falls to X while Scenario B stays at Y"
6. **Negotiation Strategy** — Deal-specific advice on structuring the initial offer based on scenario analysis

### Storage

AI comparison results stored as a new ValuationModel record with a reserved modelName (e.g., `__comparison__`) or in a new JSON column. The comparison is tied to the specific scenarios that were compared (stored by scenario IDs in the comparison data).

---

## Technical Approach

### New Files

| File | Purpose |
|------|---------|
| `src/components/financials/scenario-comparison-view.tsx` | Compare sub-tab container with scenario selector |
| `src/components/financials/scenario-comparison-table.tsx` | KPI comparison table with best/worst highlighting |
| `src/components/financials/scenario-comparison-charts.tsx` | Three Recharts visualizations |
| `src/lib/ai/valuation-comparison-commentary.ts` | Prompt + schema for AI comparison |
| `src/app/api/pipeline/[id]/valuation/compare/route.ts` | POST endpoint for AI comparison |

### Modified Files

| File | Change |
|------|--------|
| `src/components/pipeline/valuation-tab-content.tsx` | Add "Model" / "Compare" sub-tab toggle |
| `src/hooks/use-valuation-scenarios.ts` | Add `useCompareScenarios` mutation hook |

### No Changes

- Prisma schema (ValuationModel already stores inputs/outputs as JSON)
- Existing CRUD API routes
- Existing valuation engine
- Existing scenario management (create, rename, duplicate, delete, auto-save)

### Data Flow

1. User navigates to Valuation > Compare
2. `useValuationScenarios(opportunityId)` fetches all saved scenarios (already exists)
3. User checks 2-3 scenarios to compare
4. Component extracts `outputs` JSON from each selected scenario
5. KPI table renders from `outputs` data (no API calls — pure client-side)
6. Charts render from `outputs.projection` arrays (also client-side)
7. "AI Compare" button POSTs selected scenarios to `/api/pipeline/[id]/valuation/compare`
8. Claude generates structured comparison analysis
9. Result rendered in the AI comparison panel

### Chart Library

Recharts 3.7.0 (already installed). All three charts use standard Recharts components:
- `LineChart` + `Line` for projection overlay
- `AreaChart` + `Area` + `Line` for FCF/debt
- `BarChart` + `Bar` for capital structure

---

## Best Practices Encoded in the UI

Based on PE/M&A industry standards:

1. **DSCR thresholds**: 1.25x minimum for SBA 7(a), 1.5x for conventional — flagged visually
2. **IRR hurdle rate**: 15% minimum for middle-market PE — flagged when below
3. **Value creation decomposition**: AI breaks down returns by EBITDA growth vs. multiple expansion vs. debt paydown
4. **Downside stress testing**: AI tests 20% EBITDA decline scenario against each structure
5. **Covenant checking**: AI validates each scenario against typical bank lending covenants
6. **Best/worst highlighting**: Instant visual identification of which scenario wins each metric

Sources:
- [Mastering LBO Returns: Calculating IRR and MOIC](https://sparkco.ai/blog/mastering-lbo-returns-calculating-irr-and-moic)
- [PE Value-Creation Levers](https://uplevered.com/private-equity-value-levers/)
- [IRR Decomposition](https://www.mosaic.pe/academy/irr-decomposition)
- [LBO Modelling Framework](https://privateequitybro.com/lbo-modeling-framework-for-private-equity-interviews/)

---

## Verification

1. Valuation tab shows "Model" | "Compare" sub-tabs
2. Compare tab loads all saved scenarios with checkboxes
3. Checking 2-3 scenarios renders KPI table with correct values from saved outputs
4. Best/worst highlighting works correctly per metric
5. DSCR and IRR threshold warnings display appropriately
6. All three charts render with correct data from projection arrays
7. "AI Compare" generates structured analysis covering all 6 sections
8. Flipping back to "Model" tab preserves all existing functionality
9. Build passes clean (TypeScript, no console errors)
