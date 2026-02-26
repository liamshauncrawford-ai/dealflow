# Risk Assessment Deletion + Multi-Tab Excel Upload — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add risk assessment deletion to the pipeline overview tab, and upgrade Historic Financials to parse all sheets from a multi-tab Excel workbook with sub-tab navigation.

**Architecture:** Two independent features sharing one commit flow. Feature 1 (risk deletion) is self-contained: one API handler + one hook + one UI button. Feature 2 (multi-tab Excel) touches the Prisma schema, parser, API, hooks, and UI — introducing a `workbookGroup` UUID to group sheets from the same file, plus a `notes` field for annotation text, plus new `WorkbookCard` and `SheetTabBar` components for sub-tab navigation.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), React Query (TanStack), Tailwind CSS, `xlsx` library, Zod, Lucide icons.

---

## Task 1: Risk Assessment DELETE API Handler

**Files:**
- Modify: `src/app/api/pipeline/[id]/risk-assessment/route.ts` (after line 197)

**Step 1: Add the DELETE handler**

Append after the existing PATCH handler (line 197):

```typescript
// ─────────────────────────────────────────────
// DELETE /api/pipeline/[id]/risk-assessment
//
// Deletes a specific risk assessment by analysisId.
// ─────────────────────────────────────────────

const deleteSchema = z.object({
  analysisId: z.string(),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: opportunityId } = await params;
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { analysisId } = parsed.data;

    // Verify the analysis belongs to this opportunity and is a risk assessment
    const existing = await prisma.aIAnalysisResult.findFirst({
      where: {
        id: analysisId,
        opportunityId,
        analysisType: "RISK_ASSESSMENT",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk assessment not found" },
        { status: 404 },
      );
    }

    await prisma.aIAnalysisResult.delete({
      where: { id: analysisId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[risk-assessment] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete risk assessment" },
      { status: 500 },
    );
  }
}
```

**Step 2: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/api/pipeline/\[id\]/risk-assessment/route.ts
git commit -m "feat: add DELETE handler for risk assessment API"
```

---

## Task 2: Risk Assessment Delete Hook

**Files:**
- Modify: `src/hooks/use-risk-data.ts` (append after `useUpdateRiskData`, line 82)

**Step 1: Add the useDeleteRiskAssessment mutation**

Append after the closing `}` of `useUpdateRiskData` (line 82):

```typescript
/**
 * Deletes a risk assessment by analysisId.
 */
export function useDeleteRiskAssessment(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/risk-assessment`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisId }),
        },
      );
      if (!res.ok) throw new Error("Failed to delete risk assessment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["risk-data", opportunityId],
      });
      toast.success("Risk assessment deleted");
    },
    onError: () => {
      toast.error("Failed to delete risk assessment");
    },
  });
}
```

**Step 2: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx next build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/hooks/use-risk-data.ts
git commit -m "feat: add useDeleteRiskAssessment hook"
```

---

## Task 3: Risk Assessment Delete UI (Trash Icon + Confirmation)

**Files:**
- Modify: `src/components/pipeline/ai-risk-panel.tsx`

**Step 1: Import the delete hook**

On line 20-24, update the import from `use-risk-data.ts` to include the new hook:

```typescript
import {
  useRiskData,
  useUpdateRiskData,
  useDeleteRiskAssessment,
  type RiskAssessmentData,
} from "@/hooks/use-risk-data";
```

**Step 2: Initialize the delete mutation**

After line 58 (`const updateMutation = ...`), add:

```typescript
  const deleteMutation = useDeleteRiskAssessment(opportunityId);
```

**Step 3: Add delete handler function**

After the `handleGenerate` function (line 87-88), add:

```typescript
  const handleDelete = () => {
    if (!analysisId) return;
    if (confirm("Delete this risk assessment? This cannot be undone.")) {
      deleteMutation.mutate(analysisId);
    }
  };
```

**Step 4: Add trash icon button in the header**

In the display mode section, find the header buttons (lines 287-307). After the Regenerate button (the `</button>` around line 306), add a new trash button:

Replace the entire button group (lines 287-307):

```typescript
        <div className="flex items-center gap-1">
          <button
            onClick={startEditing}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Edit assessment"
          >
            <PenLine className="h-3 w-3" />
          </button>
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Regenerate"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            title="Delete assessment"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </button>
        </div>
```

Note: `Trash2` is already imported on line 17 — no new import needed.

**Step 5: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx next build 2>&1 | tail -20`

**Step 6: Commit**

```bash
git add src/components/pipeline/ai-risk-panel.tsx
git commit -m "feat: add trash icon to delete risk assessments from overview tab"
```

---

## Task 4: Prisma Schema — Add workbookGroup and notes Fields

**Files:**
- Modify: `prisma/schema.prisma` (HistoricPnL model around line 1165, HistoricPnLRow around line 1188)

**Step 1: Add `workbookGroup` to HistoricPnL**

In the `HistoricPnL` model, after the `sourceFileName` field (line 1174), add:

```prisma
  workbookGroup   String?           // UUID grouping sheets from same file upload
```

Also update the index to include workbookGroup:

After `@@index([opportunityId])` (line 1185), add:

```prisma
  @@index([workbookGroup])
```

**Step 2: Add `notes` to HistoricPnLRow**

In the `HistoricPnLRow` model, after the `isBlank` field (line 1199), add:

```prisma
  notes           String?           // Annotation text from extra columns
```

**Step 3: Push schema changes**

Run: `cd /Users/liamcrawford/dealflow && npx prisma db push`

Expected: Schema push succeeds (adds nullable columns, no data loss).

**Step 4: Regenerate Prisma client**

Run: `cd /Users/liamcrawford/dealflow && npx prisma generate`

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add workbookGroup to HistoricPnL, notes to HistoricPnLRow"
```

---

## Task 5: Multi-Sheet Parser — `parseHistoricWorkbook()`

**Files:**
- Modify: `src/lib/financial/parse-historic-pnl.ts`

**Step 1: Add new types and the workbook parser**

After the existing `ParsedHistoricPnL` interface (line 35), add:

```typescript
export interface ParsedHistoricWorkbook {
  sheets: Array<ParsedHistoricPnL & { sheetName: string }>;
  sourceFileName: string;
}
```

After the existing `parseHistoricPnL` function's closing `}` (line 127), but before the Phase 1 helpers comment (line 129), add a new exported function:

```typescript
/**
 * Parse ALL sheets from an Excel workbook.
 * Returns one ParsedHistoricPnL per sheet, each tagged with its sheetName.
 * Falls back to single-sheet parsing for files with only one sheet.
 */
export function parseHistoricWorkbook(
  buffer: Buffer,
  fileName: string,
): ParsedHistoricWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  if (workbook.SheetNames.length === 0) {
    throw new Error("Spreadsheet has no sheets");
  }

  const sheets: Array<ParsedHistoricPnL & { sheetName: string }> = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows: (string | number | null)[][] = XLSX.utils.sheet_to_json(
      sheet,
      { header: 1, defval: "", raw: true },
    );

    // Skip empty sheets (less than 3 rows)
    if (rawRows.length < 3) continue;

    try {
      const parsed = parseSheet(rawRows, sheetName);
      sheets.push({ ...parsed, sheetName });
    } catch {
      // Skip sheets that fail to parse (e.g., chart sheets, summary sheets with no data)
      console.warn(`Skipping sheet "${sheetName}" — failed to parse`);
    }
  }

  if (sheets.length === 0) {
    throw new Error("No parseable sheets found in workbook");
  }

  return { sheets, sourceFileName: fileName };
}
```

**Step 2: Refactor internal parsing into a `parseSheet` helper**

The existing `parseHistoricPnL` function reads the workbook and extracts `rawRows` from the first sheet, then runs Phase 1-3. We need to extract the Phase 1-3 logic into a reusable `parseSheet()` function that works on raw rows directly.

Rename the core logic. Replace the existing `parseHistoricPnL` function (lines 52-127) with:

```typescript
export function parseHistoricPnL(
  buffer: Buffer,
  fileName: string,
): ParsedHistoricPnL {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Spreadsheet has no sheets");
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Could not read sheet");
  }

  const rawRows: (string | number | null)[][] = XLSX.utils.sheet_to_json(
    sheet,
    { header: 1, defval: "", raw: true },
  );

  if (rawRows.length < 3) {
    throw new Error("Spreadsheet has too few rows to parse");
  }

  return parseSheet(rawRows, null);
}
```

Then add the shared `parseSheet` function (between `parseHistoricPnL` and `parseHistoricWorkbook`):

```typescript
/**
 * Core sheet parser — works on raw rows from a single sheet.
 * If sheetName is provided, it overrides the detected title.
 */
function parseSheet(
  rawRows: (string | number | null)[][],
  sheetName: string | null,
): ParsedHistoricPnL {
  // ── Phase 1: Detect metadata & columns ──
  const { companyName, title, basis, columnHeaderIdx, columns, lastDataColIdx } =
    detectMetadataAndColumns(rawRows);

  // ── Phase 2: Parse data rows ──
  const dataStartIdx = columnHeaderIdx + (columns[0]?.subheader ? 2 : 1);
  const numCols = columns.length;
  const parsedRows: ParsedRow[] = [];

  for (let i = dataStartIdx; i < rawRows.length; i++) {
    const raw = rawRows[i];
    if (!raw) continue;

    const label = String(raw[0] ?? "").trim();

    // Extract numeric values from data columns
    const values: (number | null)[] = [];
    for (let c = 1; c <= numCols; c++) {
      const cell = raw[c];
      if (cell === "" || cell === null || cell === undefined) {
        values.push(null);
      } else {
        const num = typeof cell === "number" ? cell : parseFloat(String(cell).replace(/[,$]/g, ""));
        values.push(isNaN(num) ? null : num);
      }
    }

    // Scan for annotation text in columns beyond the data columns
    let notes: string | null = null;
    if (lastDataColIdx !== undefined) {
      const noteParts: string[] = [];
      for (let c = lastDataColIdx + 1; c < raw.length; c++) {
        const val = String(raw[c] ?? "").trim();
        if (val) noteParts.push(val);
      }
      if (noteParts.length > 0) {
        notes = noteParts.join(" — ");
      }
    }

    const allValuesEmpty = values.every((v) => v === null);
    const isBlank = !label && allValuesEmpty;
    const isTotal = TOTAL_PREFIX.test(label);
    const isSummary = SUMMARY_LABELS.has(label.toLowerCase());

    parsedRows.push({
      label: label || "",
      values,
      depth: 0,
      isTotal,
      isSummary,
      isBlank,
      notes,
    });
  }

  // ── Phase 3: Calculate hierarchy depths ──
  assignDepths(parsedRows);

  return {
    companyName,
    title: sheetName || title,
    basis,
    columns,
    rows: parsedRows,
  };
}
```

**Step 3: Update `ParsedRow` to include `notes`**

In the `ParsedRow` interface (around line 21-27), add the `notes` field:

```typescript
export interface ParsedRow {
  label: string;
  values: (number | null)[];
  depth: number;
  isTotal: boolean;
  isSummary: boolean;
  isBlank: boolean;
  notes: string | null;
}
```

**Step 4: Update `detectMetadataAndColumns` to return `lastDataColIdx`**

Update the return type of `detectMetadataAndColumns` to also return `lastDataColIdx`, which marks the index of the last data column (so we know where annotations start).

In the function's return statement (line 212), add `lastDataColIdx`:

```typescript
  return { companyName, title, basis, columnHeaderIdx, columns, lastDataColIdx: columns.length };
```

And update the function signature to return this extra field. The `parseSheet` function above already destructures it.

**Step 5: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx next build 2>&1 | tail -20`

**Step 6: Commit**

```bash
git add src/lib/financial/parse-historic-pnl.ts
git commit -m "feat: add parseHistoricWorkbook for multi-sheet Excel parsing with notes"
```

---

## Task 6: API — Update POST to Handle Multi-Sheet Uploads

**Files:**
- Modify: `src/app/api/pipeline/[id]/historic-financials/route.ts`

**Step 1: Import the new parser and crypto**

Replace the import on line 4:

```typescript
import { parseHistoricWorkbook } from "@/lib/financial/parse-historic-pnl";
```

Add `crypto` import at top:

```typescript
import { randomUUID } from "crypto";
```

**Step 2: Replace the POST handler**

Replace the entire POST function (lines 39-153) with:

```typescript
/**
 * POST /api/pipeline/[id]/historic-financials
 * Upload and parse an Excel workbook (all sheets).
 * Accepts multipart/form-data with a "file" field.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 },
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Upload an .xlsx, .xls, or .csv file." },
        { status: 400 },
      );
    }

    const fileName = file.name;
    const lower = fileName.toLowerCase();
    if (
      !lower.endsWith(".xlsx") &&
      !lower.endsWith(".xls") &&
      !lower.endsWith(".xlsm") &&
      !lower.endsWith(".csv")
    ) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload .xlsx, .xls, or .csv." },
        { status: 400 },
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the workbook (all sheets)
    let parsed;
    try {
      parsed = parseHistoricWorkbook(buffer, fileName);
    } catch (parseErr) {
      console.error("Excel parse error:", parseErr);
      return NextResponse.json(
        {
          error:
            parseErr instanceof Error
              ? parseErr.message
              : "Failed to parse spreadsheet",
        },
        { status: 400 },
      );
    }

    if (parsed.sheets.length === 0) {
      return NextResponse.json(
        { error: "No data found in the spreadsheet" },
        { status: 400 },
      );
    }

    // Generate a workbookGroup UUID to link all sheets from this upload
    const workbookGroup = parsed.sheets.length > 1 ? randomUUID() : null;

    // Create one HistoricPnL per sheet in a transaction
    const created = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const sheet of parsed.sheets) {
        const pnl = await tx.historicPnL.create({
          data: {
            opportunityId: id,
            title: sheet.sheetName || sheet.title,
            companyName: sheet.companyName,
            basis: sheet.basis,
            sourceFileName: fileName,
            workbookGroup,
            columns: sheet.columns as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.historicPnLRow.createMany({
          data: sheet.rows.map((row, index) => ({
            historicPnlId: pnl.id,
            label: row.label,
            displayOrder: index,
            depth: row.depth,
            isTotal: row.isTotal,
            isSummary: row.isSummary,
            isBlank: row.isBlank,
            notes: row.notes,
            values: row.values as unknown as Prisma.InputJsonValue,
          })),
        });

        const full = await tx.historicPnL.findUnique({
          where: { id: pnl.id },
          include: { rows: { orderBy: { displayOrder: "asc" } } },
        });

        if (full) results.push(full);
      }

      return results;
    });

    return NextResponse.json({ historicPnLs: created }, { status: 201 });
  } catch (error) {
    console.error("Error uploading historic P&L:", error);
    return NextResponse.json(
      { error: "Failed to upload and parse file" },
      { status: 500 },
    );
  }
}
```

**Step 3: Update DELETE to support workbookGroup**

Replace the existing DELETE function (lines 159-197) with:

```typescript
/**
 * DELETE /api/pipeline/[id]/historic-financials?pnlId=XXX
 *    or ?workbookGroup=XXX (deletes all sheets in a workbook group)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const pnlId = searchParams.get("pnlId");
    const workbookGroup = searchParams.get("workbookGroup");

    if (!pnlId && !workbookGroup) {
      return NextResponse.json(
        { error: "pnlId or workbookGroup query parameter is required" },
        { status: 400 },
      );
    }

    if (workbookGroup) {
      // Delete all P&Ls in this workbook group
      const count = await prisma.historicPnL.deleteMany({
        where: { workbookGroup, opportunityId: id },
      });

      if (count.count === 0) {
        return NextResponse.json(
          { error: "No P&Ls found for this workbook group" },
          { status: 404 },
        );
      }

      return NextResponse.json({ success: true, deletedCount: count.count });
    }

    // Single P&L delete (existing behavior)
    const existing = await prisma.historicPnL.findFirst({
      where: { id: pnlId!, opportunityId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Historic P&L not found" },
        { status: 404 },
      );
    }

    await prisma.historicPnL.delete({ where: { id: pnlId! } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting historic P&L:", error);
    return NextResponse.json(
      { error: "Failed to delete historic P&L" },
      { status: 500 },
    );
  }
}
```

**Step 4: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx next build 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/app/api/pipeline/\[id\]/historic-financials/route.ts
git commit -m "feat: POST creates one P&L per sheet, DELETE supports workbookGroup"
```

---

## Task 7: Update Hooks for Workbook Group Delete

**Files:**
- Modify: `src/hooks/use-historic-financials.ts`

**Step 1: Add `useDeleteHistoricWorkbookGroup` mutation**

After the existing `useDeleteHistoricPnl` function (line 172), add:

```typescript
// ─── Mutation: Delete all P&Ls in a workbook group ──

export function useDeleteHistoricWorkbookGroup(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workbookGroup: string) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/historic-financials?workbookGroup=${workbookGroup}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete workbook");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["historic-financials", opportunityId],
      });
      toast.success("Workbook deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
```

**Step 2: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx next build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/hooks/use-historic-financials.ts
git commit -m "feat: add useDeleteHistoricWorkbookGroup hook"
```

---

## Task 8: SheetTabBar Component

**Files:**
- Create: `src/components/financials/sheet-tab-bar.tsx`

**Step 1: Create the component**

```typescript
"use client";

interface SheetTabBarProps {
  sheets: Array<{ id: string; title: string | null; sheetName?: string }>;
  activeSheetId: string;
  onSheetChange: (sheetId: string) => void;
}

export function SheetTabBar({
  sheets,
  activeSheetId,
  onSheetChange,
}: SheetTabBarProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sheets.map((sheet) => {
        const isActive = sheet.id === activeSheetId;
        const label = sheet.title || "Untitled";

        return (
          <button
            key={sheet.id}
            onClick={() => onSheetChange(sheet.id)}
            className={`
              rounded-full px-3 py-1 text-xs font-medium transition-colors
              ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }
            `}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx next build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/components/financials/sheet-tab-bar.tsx
git commit -m "feat: add SheetTabBar component for multi-sheet navigation"
```

---

## Task 9: WorkbookCard Component

**Files:**
- Create: `src/components/financials/workbook-card.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { Trash2, FileSpreadsheet } from "lucide-react";
import { SheetTabBar } from "@/components/financials/sheet-tab-bar";
import { HistoricPnlTable } from "@/components/financials/historic-pnl-table";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface WorkbookCardProps {
  /** All P&Ls belonging to this workbook group */
  pnls: any[];
  /** The shared source file name */
  fileName: string;
  opportunityId: string;
  onDelete: () => void;
  isDeleting: boolean;
}

export function WorkbookCard({
  pnls,
  fileName,
  opportunityId,
  onDelete,
  isDeleting,
}: WorkbookCardProps) {
  const [activeSheetId, setActiveSheetId] = useState(pnls[0]?.id ?? "");

  const activePnl = pnls.find((p) => p.id === activeSheetId) ?? pnls[0];
  const hasMultipleSheets = pnls.length > 1;

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* File header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground truncate">
            {fileName}
          </span>
          <span className="text-xs text-muted-foreground">
            ({pnls.length} {pnls.length === 1 ? "sheet" : "sheets"})
          </span>
        </div>
        <button
          onClick={() => {
            const msg = hasMultipleSheets
              ? `Delete all ${pnls.length} sheets from "${fileName}"? This cannot be undone.`
              : `Delete this P&L from "${fileName}"? This cannot be undone.`;
            if (confirm(msg)) {
              onDelete();
            }
          }}
          disabled={isDeleting}
          className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          title="Delete workbook"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Sheet tabs (only if multi-sheet) */}
      {hasMultipleSheets && (
        <div className="border-b px-4 py-2">
          <SheetTabBar
            sheets={pnls.map((p: any) => ({
              id: p.id,
              title: p.title,
            }))}
            activeSheetId={activeSheetId}
            onSheetChange={setActiveSheetId}
          />
        </div>
      )}

      {/* Active sheet metadata */}
      {activePnl && (
        <div className="px-4 pt-3 pb-1 space-y-0.5">
          {activePnl.companyName && (
            <h3 className="text-sm font-semibold text-foreground">
              {activePnl.companyName}
            </h3>
          )}
          {!hasMultipleSheets && activePnl.title && (
            <p className="text-sm text-muted-foreground">{activePnl.title}</p>
          )}
          {activePnl.basis && (
            <p className="text-xs text-muted-foreground/70">
              {activePnl.basis}
            </p>
          )}
        </div>
      )}

      {/* P&L table for active sheet */}
      {activePnl && (
        <div className="p-4 pt-2">
          <HistoricPnlTable pnl={activePnl} opportunityId={opportunityId} />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx next build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/components/financials/workbook-card.tsx
git commit -m "feat: add WorkbookCard with sheet tabs and delete support"
```

---

## Task 10: Update HistoricPnlTable for Notes Tooltips

**Files:**
- Modify: `src/components/financials/historic-pnl-table.tsx`

**Step 1: Add Info icon import**

On line 4 (or near the top), add the `Info` import:

```typescript
import { Info } from "lucide-react";
```

**Step 2: Add tooltip for notes on label cells**

In the label cell render section (around lines 182-195 in the `<td>` for labels), after the label `<span>` (line 194), add a notes indicator:

Replace the label display (the non-editing branch, around line 193-194):

```typescript
                  ) : (
                    <span className="flex items-center gap-1 text-foreground">
                      {row.label}
                      {row.notes && (
                        <span className="group relative inline-flex">
                          <Info className="h-3 w-3 text-blue-400 shrink-0" />
                          <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20 max-w-xs rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md border whitespace-pre-wrap">
                            {row.notes}
                          </span>
                        </span>
                      )}
                    </span>
                  )}
```

**Step 3: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx next build 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/components/financials/historic-pnl-table.tsx
git commit -m "feat: show info tooltip for rows with annotation notes"
```

---

## Task 11: Update Tab Content to Group by Workbook

**Files:**
- Modify: `src/components/pipeline/historic-financials-tab-content.tsx`

**Step 1: Replace the entire component**

Replace the full file content with:

```typescript
"use client";

import {
  useHistoricFinancials,
  useUploadHistoricPnl,
  useDeleteHistoricPnl,
  useDeleteHistoricWorkbookGroup,
} from "@/hooks/use-historic-financials";
import { ErrorBoundary } from "@/components/error-boundary";
import { HistoricPnlUpload } from "@/components/financials/historic-pnl-upload";
import { WorkbookCard } from "@/components/financials/workbook-card";
import { HistoricPnlTable } from "@/components/financials/historic-pnl-table";
import { Trash2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface HistoricFinancialsTabContentProps {
  opportunityId: string;
}

/**
 * Groups P&Ls by workbookGroup. Ungrouped P&Ls (workbookGroup = null)
 * are each treated as standalone entries.
 */
function groupByWorkbook(pnls: any[]): Array<{
  key: string;
  workbookGroup: string | null;
  fileName: string;
  pnls: any[];
}> {
  const groups = new Map<string, { workbookGroup: string | null; fileName: string; pnls: any[] }>();

  for (const pnl of pnls) {
    const groupKey = pnl.workbookGroup || `standalone-${pnl.id}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        workbookGroup: pnl.workbookGroup,
        fileName: pnl.sourceFileName || "Untitled",
        pnls: [],
      });
    }

    groups.get(groupKey)!.pnls.push(pnl);
  }

  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    ...group,
  }));
}

export function HistoricFinancialsTabContent({
  opportunityId,
}: HistoricFinancialsTabContentProps) {
  const { data: historicPnLs = [], isLoading } =
    useHistoricFinancials(opportunityId);
  const uploadPnl = useUploadHistoricPnl(opportunityId);
  const deletePnl = useDeleteHistoricPnl(opportunityId);
  const deleteWorkbook = useDeleteHistoricWorkbookGroup(opportunityId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  const hasData = historicPnLs.length > 0;
  const workbookGroups = groupByWorkbook(historicPnLs);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      {hasData && (
        <div className="flex items-center justify-between">
          <HistoricPnlUpload
            onFileSelected={(file) => uploadPnl.mutate(file)}
            isUploading={uploadPnl.isPending}
            compact
          />
          <p className="text-xs text-muted-foreground">
            Double-click any cell to edit
          </p>
        </div>
      )}

      {/* Empty state: full-width dropzone */}
      {!hasData && (
        <HistoricPnlUpload
          onFileSelected={(file) => uploadPnl.mutate(file)}
          isUploading={uploadPnl.isPending}
        />
      )}

      {/* Workbook groups + standalone P&Ls */}
      {workbookGroups.map((group) => (
        <ErrorBoundary key={group.key}>
          {group.workbookGroup ? (
            /* Multi-sheet workbook — render WorkbookCard with sub-tabs */
            <WorkbookCard
              pnls={group.pnls}
              fileName={group.fileName}
              opportunityId={opportunityId}
              onDelete={() =>
                deleteWorkbook.mutate(group.workbookGroup!)
              }
              isDeleting={deleteWorkbook.isPending}
            />
          ) : (
            /* Standalone P&L (no workbookGroup) — backward compatible */
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  {group.pnls[0]?.companyName && (
                    <h3 className="text-sm font-semibold text-foreground">
                      {group.pnls[0].companyName}
                    </h3>
                  )}
                  {group.pnls[0]?.title && (
                    <p className="text-sm text-muted-foreground">
                      {group.pnls[0].title}
                    </p>
                  )}
                  {group.pnls[0]?.basis && (
                    <p className="text-xs text-muted-foreground/70">
                      {group.pnls[0].basis}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {group.pnls[0]?.sourceFileName && (
                    <span className="text-xs text-muted-foreground/50">
                      {group.pnls[0].sourceFileName}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "Delete this historic P&L? This cannot be undone.",
                        )
                      ) {
                        deletePnl.mutate(group.pnls[0].id);
                      }
                    }}
                    disabled={deletePnl.isPending}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    title="Delete this P&L"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <HistoricPnlTable
                pnl={group.pnls[0]}
                opportunityId={opportunityId}
              />
            </div>
          )}
        </ErrorBoundary>
      ))}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx next build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/components/pipeline/historic-financials-tab-content.tsx
git commit -m "feat: group multi-sheet uploads into WorkbookCards with sub-tab navigation"
```

---

## Task 12: Full Build Verification + Push

**Step 1: Run full build**

Run: `cd /Users/liamcrawford/dealflow && npx next build`

Expected: Build succeeds with no errors.

**Step 2: Run Prisma push against Railway (production)**

Run: `cd /Users/liamcrawford/dealflow && npx prisma db push`

Expected: Schema changes applied (workbookGroup, notes columns added).

**Step 3: Stage all changes and create final commit**

```bash
cd /Users/liamcrawford/dealflow
git add -A
git status
```

If any uncommitted changes remain, create a cleanup commit.

**Step 4: Push to GitHub**

```bash
git push origin main
```

Railway should auto-deploy from the GitHub push.

---

## Verification Checklist

1. **Risk assessment deletion**: Navigate to a pipeline opportunity with an existing risk assessment → Click trash icon → Confirm → Assessment disappears, "Generate Assessment" button appears
2. **Multi-tab upload**: Navigate to Historic Financials tab → Upload `Mountain_States_Framing_Buyer_Financials.xlsx` → Workbook card appears with 5 pill tabs
3. **Sheet switching**: Click different sheet tabs → Table content changes to show that sheet's data
4. **Backward compatibility**: Previously uploaded single-sheet P&Ls still render normally (no tabs)
5. **Annotation tooltips**: On sheets with extra annotation columns, rows show blue info icon → Hover reveals tooltip with annotation text
6. **Workbook delete**: Click trash on workbook card → Confirm → All 5 sheets deleted, empty state returns
7. **Negative values**: Red text for negative values preserved
8. **Cell editing**: Double-click cells → Edit → Save works on any sheet
9. **Build clean**: `npx next build` succeeds with no TypeScript errors

---

## Files Summary

| File | Action | What Changes |
|------|--------|-------------|
| `src/app/api/pipeline/[id]/risk-assessment/route.ts` | Modify | Add DELETE handler |
| `src/hooks/use-risk-data.ts` | Modify | Add `useDeleteRiskAssessment` hook |
| `src/components/pipeline/ai-risk-panel.tsx` | Modify | Add trash icon + delete confirmation |
| `prisma/schema.prisma` | Modify | Add `workbookGroup` to HistoricPnL, `notes` to HistoricPnLRow |
| `src/lib/financial/parse-historic-pnl.ts` | Modify | Refactor into `parseSheet()`, add `parseHistoricWorkbook()`, add notes extraction |
| `src/app/api/pipeline/[id]/historic-financials/route.ts` | Modify | POST creates multi-sheet P&Ls, DELETE supports workbookGroup |
| `src/hooks/use-historic-financials.ts` | Modify | Add `useDeleteHistoricWorkbookGroup` hook |
| `src/components/financials/sheet-tab-bar.tsx` | **NEW** | Horizontal pill tabs for switching sheets |
| `src/components/financials/workbook-card.tsx` | **NEW** | File header + sheet tabs + active sheet table |
| `src/components/financials/historic-pnl-table.tsx` | Modify | Add notes tooltip with Info icon |
| `src/components/pipeline/historic-financials-tab-content.tsx` | Modify | Group P&Ls by workbookGroup, render WorkbookCards |
