# Scenario Comparison View — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Compare" sub-tab within the Valuation tab that displays a KPI comparison table, Recharts visualizations, and AI-powered deal comparison for 2-3 saved scenarios.

**Architecture:** Client-side comparison view that reads from existing `useValuationScenarios()` hook data. No schema changes. One new API endpoint for AI comparison. Three new UI components (table, charts, container). Recharts 3.7.0 already installed.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts 3.7.0, Anthropic SDK (Claude Sonnet 4), React Query

---

## Task 1: Sub-Tab Toggle in Valuation Tab Content

Add "Model" | "Compare" toggle to the existing `valuation-tab-content.tsx`.

**Files:**
- Modify: `src/components/pipeline/valuation-tab-content.tsx`

**Step 1: Add sub-tab state and toggle UI**

At the top of `ValuationTabContent` function (around line 97), add state:

```typescript
const [subTab, setSubTab] = useState<"model" | "compare">("model");
```

Then wrap the existing JSX return. Before the current `<div className="grid gap-6 ...">` layout (the main content), insert a sub-tab toggle bar:

```tsx
{/* Sub-tab toggle */}
<div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
  <button
    onClick={() => setSubTab("model")}
    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
      subTab === "model"
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`}
  >
    Model
  </button>
  <button
    onClick={() => setSubTab("compare")}
    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
      subTab === "compare"
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`}
  >
    Compare
  </button>
</div>
```

**Step 2: Conditionally render sub-tab content**

Wrap ALL existing valuation model content in `{subTab === "model" && ( ... )}`.

Add the compare view placeholder:

```tsx
{subTab === "compare" && (
  <ScenarioComparisonView
    opportunityId={opportunityId}
    scenarios={scenarios}
    isLoading={scenariosLoading}
  />
)}
```

Add import at top:

```typescript
import { ScenarioComparisonView } from "@/components/financials/scenario-comparison-view";
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build passes. The import will fail until Task 2 creates the component, so create a minimal stub first.

**Step 4: Commit**

```bash
git add src/components/pipeline/valuation-tab-content.tsx
git commit -m "feat: add Model/Compare sub-tab toggle to valuation tab"
```

---

## Task 2: Scenario Comparison Container Component

The main container that manages scenario selection and renders the table, charts, and AI panel.

**Files:**
- Create: `src/components/financials/scenario-comparison-view.tsx`

**Step 1: Create the container component**

This component:
- Receives `scenarios` array and `opportunityId` from parent
- Manages `selectedIds: Set<string>` state (max 3 checkboxes)
- Shows empty state if < 2 scenarios saved
- Renders scenario selector (checkboxes)
- Passes selected scenarios to child components

```tsx
"use client";

import { useState, useMemo } from "react";
import { BarChart3, Sparkles, Loader2 } from "lucide-react";
import type { ValuationScenario } from "@/hooks/use-valuation-scenarios";
import type { ValuationInputs, ValuationOutputs } from "@/lib/financial/valuation-engine";
import { ScenarioComparisonTable } from "./scenario-comparison-table";
import { ScenarioComparisonCharts } from "./scenario-comparison-charts";

// Scenario colors for chart legends
const SCENARIO_COLORS = ["#8b5cf6", "#f59e0b", "#06b6d4"]; // purple, amber, cyan

interface ScenarioComparisonViewProps {
  opportunityId: string;
  scenarios: ValuationScenario[];
  isLoading: boolean;
}

export function ScenarioComparisonView({
  opportunityId,
  scenarios,
  isLoading,
}: ScenarioComparisonViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiComparison, setAiComparison] = useState<ScenarioComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Auto-select first 2 scenarios on initial load
  // (managed via useEffect or initial state)

  const selectedScenarios = useMemo(
    () => scenarios.filter((s) => selectedIds.has(s.id)),
    [scenarios, selectedIds],
  );

  const toggleScenario = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  };

  // ... loading state, empty state, scenario selector checkboxes,
  // then <ScenarioComparisonTable>, <ScenarioComparisonCharts>, AI panel
}
```

Key details:
- Extract `inputs` and `outputs` from each scenario's JSON: `scenario.inputs as unknown as ValuationInputs`, `scenario.outputs as unknown as ValuationOutputs`
- Pass `selectedScenarios` with their parsed inputs/outputs and color assignments to child components
- The `SCENARIO_COLORS` array maps to scenario index (0, 1, 2)

**Empty state** (when < 2 scenarios saved):
```tsx
<div className="rounded-lg border border-dashed p-12 text-center">
  <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
  <p className="mt-3 font-medium">Compare Scenarios</p>
  <p className="mt-1 text-sm text-muted-foreground">
    Save at least 2 scenarios in the Model tab to compare them here.
  </p>
</div>
```

**Scenario selector** (checkboxes with names):
```tsx
<div className="flex flex-wrap items-center gap-3">
  <span className="text-sm font-medium text-muted-foreground">Compare:</span>
  {scenarios.map((s, i) => (
    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={selectedIds.has(s.id)}
        onChange={() => toggleScenario(s.id)}
        disabled={!selectedIds.has(s.id) && selectedIds.size >= 3}
        className="rounded"
      />
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }}
      />
      {s.modelName || "Untitled"}
    </label>
  ))}
</div>
```

**Step 2: Build**

Run: `npm run build`
Expected: Pass (child components will be stubs initially)

**Step 3: Commit**

```bash
git add src/components/financials/scenario-comparison-view.tsx
git commit -m "feat: scenario comparison container with selector"
```

---

## Task 3: KPI Comparison Table

The row-per-metric, column-per-scenario comparison table with best/worst highlighting.

**Files:**
- Create: `src/components/financials/scenario-comparison-table.tsx`

**Step 1: Define metric rows configuration**

```typescript
interface MetricRow {
  key: string;
  label: string;
  category: string;
  format: "currency" | "multiple" | "percent" | "ratio" | "year";
  /** Extract value from ValuationOutputs */
  getValue: (outputs: ValuationOutputs, inputs: ValuationInputs) => number | null;
  /** Higher is better? (for best/worst highlighting) */
  higherIsBetter: boolean;
  /** Optional threshold for warning badge */
  warningThreshold?: { value: number; below: boolean; label: string };
}
```

Define the metric rows grouped by category — reference exact paths into `ValuationOutputs`:

```typescript
const METRIC_ROWS: MetricRow[] = [
  // Deal Structure
  { key: "ev", label: "Enterprise Value", category: "Deal Structure",
    format: "currency", getValue: (o) => o.deal.enterprise_value, higherIsBetter: false },
  { key: "equity", label: "Equity Check", category: "Deal Structure",
    format: "currency", getValue: (o) => o.deal.equity_check, higherIsBetter: false },
  { key: "bank_debt", label: "Bank Debt", category: "Deal Structure",
    format: "currency", getValue: (o) => o.deal.bank_debt, higherIsBetter: false },
  { key: "seller_note", label: "Seller Note", category: "Deal Structure",
    format: "currency", getValue: (o) => o.deal.seller_note, higherIsBetter: false },
  { key: "entry_multiple", label: "Entry Multiple", category: "Deal Structure",
    format: "multiple", getValue: (_o, i) => i.entry_multiple, higherIsBetter: false },

  // Returns
  { key: "moic", label: "MOIC", category: "Returns",
    format: "multiple", getValue: (o) => o.exit.moic, higherIsBetter: true },
  { key: "irr", label: "IRR", category: "Returns",
    format: "percent", getValue: (o) => o.exit.irr, higherIsBetter: true,
    warningThreshold: { value: 0.15, below: true, label: "Below 15% PE hurdle" } },
  { key: "coc", label: "Cash-on-Cash Return", category: "Returns",
    format: "percent",
    getValue: (o) => o.deal.equity_check > 0 ? o.cashFlow.after_tax_cash_flow / o.deal.equity_check : 0,
    higherIsBetter: true },

  // Debt Capacity
  { key: "dscr", label: "DSCR", category: "Debt Capacity",
    format: "ratio", getValue: (o) => o.cashFlow.dscr, higherIsBetter: true,
    warningThreshold: { value: 1.25, below: true, label: "Below SBA 1.25x" } },
  { key: "debt_service", label: "Total Annual Debt Service", category: "Debt Capacity",
    format: "currency", getValue: (o) => o.debt.total_annual_debt_service, higherIsBetter: false },

  // Cash Flow
  { key: "adj_ebitda", label: "Y1 Adjusted EBITDA", category: "Cash Flow",
    format: "currency", getValue: (o) => o.cashFlow.adjusted_ebitda, higherIsBetter: true },
  { key: "pretax_cf", label: "Y1 Pre-Tax Cash Flow", category: "Cash Flow",
    format: "currency", getValue: (o) => o.cashFlow.pre_tax_cash_flow, higherIsBetter: true },
  { key: "aftertax_cf", label: "Y1 After-Tax Cash Flow", category: "Cash Flow",
    format: "currency", getValue: (o) => o.cashFlow.after_tax_cash_flow, higherIsBetter: true },

  // Exit Analysis
  { key: "exit_year", label: "Exit Year", category: "Exit Analysis",
    format: "year", getValue: (_o, i) => i.exit_year, higherIsBetter: false },
  { key: "exit_ev", label: "Exit EV", category: "Exit Analysis",
    format: "currency", getValue: (o) => o.exit.exit_ev, higherIsBetter: true },
  { key: "remaining_debt", label: "Remaining Debt at Exit", category: "Exit Analysis",
    format: "currency", getValue: (o) => o.exit.remaining_debt_at_exit, higherIsBetter: false },
  { key: "equity_to_buyer", label: "Equity to Buyer", category: "Exit Analysis",
    format: "currency", getValue: (o) => o.exit.equity_to_buyer, higherIsBetter: true },
  { key: "total_return", label: "Total Return", category: "Exit Analysis",
    format: "currency", getValue: (o) => o.exit.total_return, higherIsBetter: true },
];
```

**Step 2: Implement the table component**

Key rendering logic:
- Group rows by `category` — render category headers as section breaks
- For each row, extract the value from each selected scenario's outputs
- Determine best/worst: compare values using `higherIsBetter`
- Apply conditional classes:
  - Best: `bg-emerald-50 dark:bg-emerald-950/20`
  - Worst: `bg-red-50 dark:bg-red-950/20`
  - Warning: render `<AlertTriangle className="h-3 w-3 text-amber-500" />` badge when threshold breached
- Delta column (when exactly 2 scenarios): absolute difference and percentage

**Format helpers** (reuse patterns from `valuation-tab-content.tsx`):
- `currency`: `$X.XM` or `$XXK` via Intl.NumberFormat
- `multiple`: `X.Xx`
- `percent`: `XX.X%` (multiply by 100 if stored as decimal)
- `ratio`: `X.XX`
- `year`: integer

**Step 3: Build**

Run: `npm run build`
Expected: Pass

**Step 4: Commit**

```bash
git add src/components/financials/scenario-comparison-table.tsx
git commit -m "feat: KPI comparison table with best/worst highlighting"
```

---

## Task 4: Recharts Comparison Visualizations

Three charts using Recharts 3.7.0 (already installed and used throughout the app).

**Files:**
- Create: `src/components/financials/scenario-comparison-charts.tsx`

**Step 1: Define the shared chart data types**

```typescript
interface ChartScenario {
  id: string;
  name: string;
  color: string;
  inputs: ValuationInputs;
  outputs: ValuationOutputs;
}

interface ScenarioComparisonChartsProps {
  scenarios: ChartScenario[];
}
```

**Step 2: Chart 1 — Revenue & EBITDA Projection Overlay**

Transform data: For each scenario, map `outputs.projection` array into chart data points. Merge all scenarios into a single data array keyed by `year`:

```typescript
// chartData = [
//   { year: 1, "Base Case Revenue": 1200000, "Aggressive Revenue": 1500000, ... },
//   { year: 2, ... },
// ]
```

Render two `LineChart` components side-by-side (`grid grid-cols-2 gap-4`):
- Left: Revenue lines
- Right: EBITDA lines

Use existing Recharts patterns from `src/components/charts/pipeline-value-trend-chart.tsx`:
- `ResponsiveContainer` wrapper, height 280
- `CartesianGrid strokeDasharray="3 3" opacity={0.3}`
- `XAxis dataKey="year"` with `tick={{ fontSize: 11 }}`
- `YAxis` with dollar formatting
- `Tooltip` with custom formatter for currency
- One `Line` per scenario, colored from `SCENARIO_COLORS`

**Step 3: Chart 2 — Cumulative FCF & Debt Paydown**

Single `ComposedChart` (from recharts) combining:
- `Area` for cumulative FCF per scenario (semi-transparent fill: `fillOpacity={0.15}`)
- `Line` with `strokeDasharray="5 5"` for remaining debt per scenario

Data format:
```typescript
// { year: 1, "Base FCF": 120000, "Base Debt": 800000, "Aggr FCF": ..., ... }
```

**Step 4: Chart 3 — Capital Structure Comparison**

Horizontal `BarChart` with `layout="vertical"`:
- Y-axis: scenario names
- X-axis: dollar amount
- Three stacked `Bar` segments: Equity (blue), Bank Debt (red/amber), Seller Note (gray)

```tsx
<BarChart layout="vertical" data={capitalData}>
  <XAxis type="number" tickFormatter={fmtK} />
  <YAxis dataKey="name" type="category" width={120} />
  <Bar dataKey="equity" stackId="cap" fill="#3b82f6" name="Equity" />
  <Bar dataKey="bankDebt" stackId="cap" fill="#f59e0b" name="Bank Debt" />
  <Bar dataKey="sellerNote" stackId="cap" fill="#94a3b8" name="Seller Note" />
  <Tooltip formatter={fmtK} />
  <Legend />
</BarChart>
```

Each chart should be wrapped in the existing `ChartCard` component from `src/components/charts/chart-card.tsx` for consistent styling.

**Step 5: Build**

Run: `npm run build`
Expected: Pass

**Step 6: Commit**

```bash
git add src/components/financials/scenario-comparison-charts.tsx
git commit -m "feat: scenario comparison charts (projections, FCF/debt, capital structure)"
```

---

## Task 5: AI Comparison API Endpoint

Server-side endpoint that sends scenario data to Claude for structured comparison analysis.

**Files:**
- Create: `src/lib/ai/valuation-comparison-commentary.ts`
- Create: `src/app/api/pipeline/[id]/valuation/compare/route.ts`

**Step 1: Create the AI comparison prompt and schema**

File: `src/lib/ai/valuation-comparison-commentary.ts`

Define the structured output:

```typescript
export interface ScenarioComparisonResult {
  verdict: string;
  risk_adjusted_assessment: string;
  value_creation_bridge: Array<{
    scenario_name: string;
    ebitda_growth_pct: number;
    multiple_expansion_pct: number;
    debt_paydown_pct: number;
  }>;
  covenant_check: string;
  downside_resilience: string;
  negotiation_strategy: string;
}
```

Use `callClaudeStructured` (same pattern as `src/app/api/pipeline/[id]/financials/analyze/route.ts`) with `jsonSchemaOutputFormat`:

```typescript
import { callClaudeStructured } from "./claude-client";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
```

System prompt should reference:
- Crawford Holdings acquisition thesis (4-5x entry, 2.5-3.5x bolt-ons, 7-10x exit)
- Colorado Front Range commercial trade contractor focus
- SBA 7(a) underwriting standards (DSCR >= 1.25x)
- PE IRR hurdle rates (15-25% target range)
- Value creation decomposition framework (EBITDA growth, multiple expansion, debt paydown)

User prompt should include for each scenario:
- Scenario name
- All key inputs (entry multiple, capital structure, growth rate, exit assumptions)
- All key outputs (EV, MOIC, IRR, DSCR, Y1 after-tax CF, exit analysis)

**Step 2: Create the API route**

File: `src/app/api/pipeline/[id]/valuation/compare/route.ts`

```typescript
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { scenarioIds } = await request.json();

  // Fetch the specified scenarios
  const scenarios = await prisma.valuationModel.findMany({
    where: { id: { in: scenarioIds }, opportunityId: id },
  });

  if (scenarios.length < 2) {
    return NextResponse.json({ error: "At least 2 scenarios required" }, { status: 400 });
  }

  // Fetch opportunity name for context
  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    select: { title: true },
  });

  // Call AI comparison
  const result = await generateScenarioComparison({
    companyName: opportunity?.title ?? "Target Company",
    scenarios: scenarios.map((s) => ({
      name: s.modelName ?? "Untitled",
      inputs: s.inputs as Record<string, unknown>,
      outputs: s.outputs as Record<string, unknown>,
    })),
  });

  return NextResponse.json({
    comparison: result.parsed,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}
```

**Step 3: Build**

Run: `npm run build`
Expected: Pass

**Step 4: Commit**

```bash
git add src/lib/ai/valuation-comparison-commentary.ts src/app/api/pipeline/[id]/valuation/compare/route.ts
git commit -m "feat: AI scenario comparison endpoint with structured output"
```

---

## Task 6: Comparison Hook + AI Panel Integration

Wire the AI comparison into the UI.

**Files:**
- Modify: `src/hooks/use-valuation-scenarios.ts`
- Modify: `src/components/financials/scenario-comparison-view.tsx`

**Step 1: Add comparison mutation hook**

In `use-valuation-scenarios.ts`, add:

```typescript
export function useCompareScenarios(opportunityId: string) {
  return useMutation({
    mutationFn: async (scenarioIds: string[]) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/valuation/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to compare scenarios");
      }
      return res.json();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
```

**Step 2: Wire AI panel into comparison view**

In `scenario-comparison-view.tsx`, add the AI comparison section at the bottom:
- "Compare with AI" button (uses `Sparkles` icon, matches existing AI button patterns)
- Loading state with `Loader2` spinner
- Result panel with 6 sections rendered as cards/sections
- Value Creation Bridge section renders as a mini-table showing % breakdown per scenario

The AI comparison panel should follow the existing pattern from `src/components/financials/financial-analysis-panel.tsx` for consistent styling.

**Step 3: Build**

Run: `npm run build`
Expected: Pass

**Step 4: Commit**

```bash
git add src/hooks/use-valuation-scenarios.ts src/components/financials/scenario-comparison-view.tsx
git commit -m "feat: wire AI comparison to UI with structured result panel"
```

---

## Task 7: Final Integration & Polish

**Files:**
- Modify: `src/components/financials/scenario-comparison-view.tsx` (auto-select first 2 scenarios)

**Step 1: Auto-select initial scenarios**

Add `useEffect` that auto-selects the first 2 scenarios when the compare tab is first opened:

```typescript
useEffect(() => {
  if (scenarios.length >= 2 && selectedIds.size === 0) {
    setSelectedIds(new Set(scenarios.slice(0, 2).map((s) => s.id)));
  }
}, [scenarios]);
```

**Step 2: Full build verification**

Run: `npm run build`
Expected: Build passes with zero TypeScript errors.

**Step 3: Manual smoke test**

1. Navigate to a pipeline deal with 2+ saved valuation scenarios
2. Click "Valuation" tab → verify "Model" / "Compare" sub-tabs appear
3. Click "Compare" → verify scenarios auto-selected, table renders
4. Verify best/worst highlighting on KPI table
5. Verify DSCR and IRR threshold warnings display
6. Verify all 3 charts render with data
7. Click "Compare with AI" → verify analysis generates
8. Switch back to "Model" → verify existing editor works unchanged

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: scenario comparison view with KPI table, charts, and AI analysis"
```

**Step 5: Push**

```bash
git push
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/pipeline/valuation-tab-content.tsx` | Modify | Add Model/Compare sub-tab toggle |
| `src/components/financials/scenario-comparison-view.tsx` | Create | Container with scenario selector, layout |
| `src/components/financials/scenario-comparison-table.tsx` | Create | KPI table with best/worst highlighting, thresholds |
| `src/components/financials/scenario-comparison-charts.tsx` | Create | 3 Recharts (projections, FCF/debt, capital structure) |
| `src/lib/ai/valuation-comparison-commentary.ts` | Create | AI prompt + schema for scenario comparison |
| `src/app/api/pipeline/[id]/valuation/compare/route.ts` | Create | POST endpoint for AI comparison |
| `src/hooks/use-valuation-scenarios.ts` | Modify | Add `useCompareScenarios` mutation |

**No Prisma schema changes. No changes to existing valuation engine, CRUD routes, or scenario management.**
