# Design: Risk Assessment Deletion + Multi-Tab Excel Upload

**Date:** 2026-02-26
**Status:** Approved

## Overview

Two features for pipeline opportunity management:
1. Delete existing AI risk assessments from the overview tab
2. Upload multi-tab Excel workbooks to Historic Financials with sub-tab navigation

---

## Feature 1: Risk Assessment Deletion

### API

Add `DELETE` handler to `/api/pipeline/[id]/risk-assessment/route.ts`:
- Accepts `{ analysisId: string }` in request body
- Verifies analysis belongs to the opportunity and is type `RISK_ASSESSMENT`
- Deletes the `AIAnalysisResult` record
- Returns `{ success: true }`

### UI

In `ai-risk-panel.tsx`:
- Trash icon (`Trash2`) in header next to Edit/Regenerate buttons
- Confirmation dialog: "Delete this risk assessment? This cannot be undone."
- On confirm, calls DELETE endpoint with `analysisId`
- Invalidates `["risk-data", opportunityId]` query cache
- Falls back to empty state with "Generate Assessment" button

### Hook

Add `useDeleteRiskAssessment(opportunityId)` mutation in `use-risk-data.ts`.

---

## Feature 2: Multi-Tab Excel Upload

### Schema Changes

```prisma
model HistoricPnL {
  // existing fields...
  workbookGroup  String?   // UUID grouping sheets from same file upload
}

model HistoricPnLRow {
  // existing fields...
  notes          String?   // Annotation text from extra columns
}
```

### Parser

New function `parseHistoricWorkbook(buffer, fileName)` returns:
```typescript
interface ParsedHistoricWorkbook {
  sheets: Array<ParsedHistoricPnL & { sheetName: string }>;
  sourceFileName: string;
}
```

Per-sheet parsing:
1. Reuse existing Phase 1-3 (metadata, rows, depth)
2. Scan columns beyond last data column for annotation text -> `notes` field
3. Carry sheet name as `title` for the P&L record

### API

POST `/api/pipeline/[id]/historic-financials`:
- Calls `parseHistoricWorkbook()` instead of `parseHistoricPnL()`
- Creates one `HistoricPnL` per sheet, all sharing a `workbookGroup` UUID
- Returns array of created P&Ls

DELETE: Updated to accept `workbookGroup` param for deleting all sheets from a file.

### UI: Sub-Tab Sheet Selector

```
┌──────────────────────────────────────────────────┐
│ Mountain_States_Framing_Buyer_Financials.xlsx   ✕ │
├──────────────────────────────────────────────────┤
│ [2024 vs 2023] [2023 vs 2022] [12-mo Rolling]   │
│ [Yearly Income] [CIM-CBR Summary]                │
├──────────────────────────────────────────────────┤
│ Selected sheet's P&L table rendered here         │
└──────────────────────────────────────────────────┘
```

Key behaviors:
- P&Ls with same `workbookGroup` grouped under one card
- Horizontal pill tabs for each sheet name
- Single-sheet files render directly (no tabs) — backward compatible
- Delete button removes entire workbook group with confirmation
- Rows with `notes` show info icon with tooltip on hover
- First sheet selected by default

Components:
- `WorkbookCard` — file header + sub-tab bar + selected table
- `SheetTabBar` — horizontal pill tabs for switching sheets
- `HistoricPnlTable` — unchanged, receives selected P&L
- Tooltip on rows with `notes` field
