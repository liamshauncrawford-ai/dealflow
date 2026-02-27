/**
 * Direct Excel parser for Historic P&L data.
 *
 * Converts a raw Excel buffer into structured P&L data that mirrors
 * the exact QuickBooks layout — preserving hierarchy, account codes,
 * parent/child subtotals, and all "Total" rows.
 *
 * Supports multi-sheet workbooks: parseHistoricWorkbook() iterates every
 * sheet and returns one ParsedHistoricPnL per parseable tab.
 *
 * No AI needed: instant, zero-cost, perfectly accurate.
 */

import * as XLSX from "xlsx";

// ─── Public types ───────────────────────────────

export interface ParsedColumn {
  header: string;           // "2025 YTD", "2024"
  subheader: string | null; // "Jan 1 - Oct 15", "Jan - Dec"
}

export interface ParsedRow {
  label: string;
  values: (number | null)[];
  depth: number;
  isTotal: boolean;
  isSummary: boolean;
  isBlank: boolean;
  notes: string | null;
}

export interface ParsedHistoricPnL {
  companyName: string | null;
  title: string | null;
  basis: string | null;
  columns: ParsedColumn[];
  rows: ParsedRow[];
}

export interface ParsedHistoricWorkbook {
  sheets: Array<ParsedHistoricPnL & { sheetName: string }>;
  sourceFileName: string;
}

// ─── Summary row patterns ───────────────────────

const SUMMARY_LABELS = new Set([
  "gross profit",
  "net operating income",
  "net income",
  "net other income",
  "net ordinary income",
]);

const BASIS_PATTERN = /^(cash|accrual)\s+basis$/i;
const TOTAL_PREFIX = /^total\s+/i;

// ─── Single-sheet parser (backward compatible) ──

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

// ─── Multi-sheet workbook parser ────────────────

/**
 * Parse ALL sheets from an Excel workbook.
 * Returns one ParsedHistoricPnL per parseable sheet, each tagged with its sheetName.
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

// ─── Core sheet parser (shared logic) ───────────

/**
 * Core sheet parser — works on raw rows from a single sheet.
 * If sheetName is provided, it overrides the detected title.
 */
function parseSheet(
  rawRows: (string | number | null)[][],
  sheetName: string | null,
): ParsedHistoricPnL {
  // ── Phase 1: Detect metadata & columns ──

  const { companyName, title, basis, columnHeaderIdx, columns, dataColIndices, lastDataColIdx } =
    detectMetadataAndColumns(rawRows);

  // ── Phase 2: Parse data rows ──

  const dataStartIdx = columnHeaderIdx + (columns[0]?.subheader ? 2 : 1);
  const numCols = columns.length;
  const parsedRows: ParsedRow[] = [];

  // Determine label column range from tracked data positions
  const firstDataCol = dataColIndices.length > 0 ? Math.min(...dataColIndices) : 1;
  const labelEndCol = firstDataCol - 1; // inclusive — last column used for labels
  const isMultiColLabel = labelEndCol > 0;

  // Track which column each label came from (for column-based depth assignment)
  const labelCols: number[] = [];

  for (let i = dataStartIdx; i < rawRows.length; i++) {
    const raw = rawRows[i];
    if (!raw) continue;

    // Build label from label columns
    let label = "";
    let labelCol = 0;

    if (isMultiColLabel) {
      // Multi-column labels: find the rightmost non-empty cell in label range
      for (let c = labelEndCol; c >= 0; c--) {
        const cellVal = String(raw[c] ?? "").trim();
        if (cellVal) {
          label = cellVal;
          labelCol = c;
          break;
        }
      }
    } else {
      // Single-column labels (col 0)
      label = String(raw[0] ?? "").trim();
      labelCol = 0;
    }

    labelCols.push(labelCol);

    // Extract numeric values from tracked data column positions
    const values: (number | null)[] = [];
    for (let c = 0; c < numCols; c++) {
      const rawIdx = dataColIndices[c];
      const cell = rawIdx !== undefined ? raw[rawIdx] : undefined;
      if (cell === "" || cell === null || cell === undefined) {
        values.push(null);
      } else {
        const num = typeof cell === "number" ? cell : parseFloat(String(cell).replace(/[,$]/g, ""));
        values.push(isNaN(num) ? null : num);
      }
    }

    // Scan for annotation text in columns beyond the last data column
    let notes: string | null = null;
    const noteParts: string[] = [];
    for (let c = lastDataColIdx + 1; c < raw.length; c++) {
      const val = String(raw[c] ?? "").trim();
      if (val) noteParts.push(val);
    }
    if (noteParts.length > 0) {
      notes = noteParts.join(" — ");
    }

    const allValuesEmpty = values.every((v) => v === null);
    const isBlank = !label && allValuesEmpty;
    const isTotal = TOTAL_PREFIX.test(label);
    const isSummary = SUMMARY_LABELS.has(label.toLowerCase());

    parsedRows.push({
      label: label || "",
      values,
      depth: 0, // Assigned in Phase 3
      isTotal,
      isSummary,
      isBlank,
      notes,
    });
  }

  // ── Phase 3: Calculate hierarchy depths ──

  if (isMultiColLabel) {
    // For multi-column label sheets, depth is derived from column position.
    // Build a rank mapping from unique non-summary, non-blank label columns.
    const uniqueCols = new Set<number>();
    for (let i = 0; i < parsedRows.length; i++) {
      if (!parsedRows[i].isBlank && !parsedRows[i].isSummary) {
        uniqueCols.add(labelCols[i]);
      }
    }
    const sortedCols = Array.from(uniqueCols).sort((a, b) => a - b);
    const rankMap = new Map<number, number>();
    sortedCols.forEach((col, rank) => rankMap.set(col, rank));

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      if (row.isBlank || row.isSummary) {
        row.depth = 0;
      } else {
        row.depth = rankMap.get(labelCols[i]) ?? 0;
      }
    }
  } else {
    // For single-column label sheets, use the heuristic Total-matching approach
    assignDepths(parsedRows);
  }

  return {
    companyName,
    title: sheetName || title,
    basis,
    columns,
    rows: parsedRows,
  };
}

// ─── Phase 1 helpers ────────────────────────────

function detectMetadataAndColumns(rawRows: (string | number | null)[][]) {
  let companyName: string | null = null;
  let title: string | null = null;
  let basis: string | null = null;
  let columnHeaderIdx = -1;
  let lastDataColIdx = 0;
  const columns: ParsedColumn[] = [];
  const dataColIndices: number[] = []; // Raw column indices where data lives

  // Scan the first ~15 rows for metadata and column headers
  const scanLimit = Math.min(rawRows.length, 15);

  for (let i = 0; i < scanLimit; i++) {
    const row = rawRows[i];
    if (!row) continue;

    const firstCell = String(row[0] ?? "").trim();

    // Check if this row has column headers — track both text AND raw column index
    const headerCandidates: Array<{ text: string; rawColIndex: number }> = [];
    for (let c = 1; c < row.length; c++) {
      const val = String(row[c] ?? "").trim();
      if (val) headerCandidates.push({ text: val, rawColIndex: c });
    }

    if (headerCandidates.length > 0 && isColumnHeaderRow(headerCandidates.map(h => h.text))) {
      columnHeaderIdx = i;

      // Check if next row has subheaders (date ranges) at the SAME raw column positions
      const nextRow = rawRows[i + 1];
      let hasSubheaders = false;
      const subheaderMap = new Map<number, string>();

      if (nextRow) {
        for (const hc of headerCandidates) {
          const val = String(nextRow[hc.rawColIndex] ?? "").trim();
          if (val && /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(val)) {
            hasSubheaders = true;
          }
          if (val) subheaderMap.set(hc.rawColIndex, val);
        }
      }

      for (const hc of headerCandidates) {
        columns.push({
          header: hc.text,
          subheader: hasSubheaders ? (subheaderMap.get(hc.rawColIndex) ?? null) : null,
        });
        dataColIndices.push(hc.rawColIndex);
      }

      lastDataColIdx = Math.max(...dataColIndices);
      break;
    }

    // Metadata detection (before column header row)
    if (firstCell && columnHeaderIdx === -1) {
      if (BASIS_PATTERN.test(firstCell)) {
        basis = firstCell;
      } else if (!companyName) {
        companyName = firstCell;
      } else if (!title) {
        title = firstCell;
      }
    }
  }

  // Fallback: if no column headers detected, treat all non-A columns as data
  if (columnHeaderIdx === -1 || columns.length === 0) {
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row) continue;
      for (let c = 1; c < row.length; c++) {
        if (typeof row[c] === "number") {
          columnHeaderIdx = Math.max(0, i - 1);
          for (let cc = 1; cc < row.length; cc++) {
            columns.push({ header: `Column ${cc}`, subheader: null });
            dataColIndices.push(cc);
          }
          lastDataColIdx = dataColIndices.length > 0 ? Math.max(...dataColIndices) : 0;
          break;
        }
      }
      if (columns.length > 0) break;
    }
  }

  return { companyName, title, basis, columnHeaderIdx, columns, dataColIndices, lastDataColIdx };
}

function isColumnHeaderRow(candidates: string[]): boolean {
  // A column header row contains year-like or period-like values
  return candidates.some((val) => {
    const s = val.trim();
    // 4-digit year: "2024", "2025 YTD", "Jan - Dec 2024", "FY 2023"
    if (/\b20\d{2}\b/.test(s)) return true;
    // Month abbreviation + 2-digit year: "Jan - Dec 24", "Aug 24", "Sep 24"
    if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b.*\b\d{2}\b/i.test(s)) return true;
    // YTD / FY labels
    if (/\bYTD\b/i.test(s) || /\bFY\b/i.test(s)) return true;
    return false;
  });
}

// ─── Phase 3: Depth assignment ──────────────────

interface GroupRange {
  startIndex: number;
  endIndex: number; // Index of the "Total" row
}

function assignDepths(rows: ParsedRow[]): void {
  // Pass 1: Identify group boundaries by matching "Total X" rows to their opening "X" rows
  const groups: GroupRange[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.isTotal) continue;

    const totalLabel = row.label;
    const match = totalLabel.match(TOTAL_PREFIX);
    if (!match) continue;

    const baseName = totalLabel.replace(TOTAL_PREFIX, "").trim().toLowerCase();
    if (!baseName) continue;

    // Scan backwards to find the matching opening row
    for (let j = i - 1; j >= 0; j--) {
      const candidate = rows[j];
      if (candidate.isBlank) continue;

      const candidateLabel = candidate.label.trim().toLowerCase();

      // Match: exact label match, or the candidate starts with the same text
      if (
        candidateLabel === baseName ||
        baseName.startsWith(candidateLabel) ||
        candidateLabel.startsWith(baseName)
      ) {
        groups.push({ startIndex: j, endIndex: i });
        break;
      }

      // Also try matching by account code prefix (e.g., "6110" in "6110 Automobile Expense")
      const baseCode = extractAccountCode(baseName);
      const candidateCode = extractAccountCode(candidateLabel);
      if (baseCode && candidateCode && baseCode === candidateCode) {
        groups.push({ startIndex: j, endIndex: i });
        break;
      }
    }
  }

  // Pass 2: Assign depths based on how many group ranges each row falls within
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.isBlank || row.isSummary) {
      row.depth = 0;
      continue;
    }

    let depth = 0;
    for (const group of groups) {
      // Row is inside this group if it's between start (exclusive) and end (exclusive)
      // The opening header and the Total row themselves are at the parent level
      if (i > group.startIndex && i < group.endIndex) {
        depth++;
      }
    }

    // The opening header of a group gets the depth of its parent context
    const isGroupHeader = groups.some((g) => g.startIndex === i);
    if (isGroupHeader) {
      // Count groups this row's start is contained within
      let headerDepth = 0;
      for (const group of groups) {
        if (i > group.startIndex && i < group.endIndex) {
          headerDepth++;
        }
      }
      row.depth = headerDepth;
    } else if (row.isTotal) {
      // Total rows get the same depth as their opening header
      const matchingGroup = groups.find((g) => g.endIndex === i);
      if (matchingGroup) {
        let totalDepth = 0;
        for (const group of groups) {
          if (matchingGroup.startIndex > group.startIndex && matchingGroup.startIndex < group.endIndex) {
            totalDepth++;
          }
        }
        row.depth = totalDepth;
      }
    } else {
      row.depth = depth;
    }
  }
}

function extractAccountCode(label: string): string | null {
  const match = label.match(/^(\d{4}(?:\.\d+)?)\s/);
  return match ? match[1] : null;
}
