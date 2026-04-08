import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import {
  mapDealStatsRows,
  mapBizCompsRows,
  type BvrRawRow,
  type BvrParsedTransaction,
} from "@/lib/bvr";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXTENSIONS = new Set(["xlsx", "csv"]);

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/octet-stream", // browsers sometimes send this for .xlsx/.csv
]);

const VALID_SOURCES = new Set(["DealStats", "BizComps"]);

// ---------------------------------------------------------------------------
// GET /api/settings/bvr-import — recent import history
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const history = await prisma.bvrImportHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching BVR import history:", error);
    return NextResponse.json(
      { error: "Failed to fetch import history" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/settings/bvr-import — preview or confirm a BVR file import
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse FormData ──────────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sourceDatabase = formData.get("sourceDatabase") as string | null;
    const selectedRanksRaw = formData.get("selectedRanks") as string | null;
    const confirm = formData.get("confirm") as string | null;

    // ── 2. Validate inputs ─────────────────────────────────────────────
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 25 MB limit" },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File extension ".${ext}" is not supported. Use .xlsx or .csv` },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File MIME type "${file.type}" is not supported` },
        { status: 400 },
      );
    }

    if (!sourceDatabase || !VALID_SOURCES.has(sourceDatabase)) {
      return NextResponse.json(
        { error: 'sourceDatabase must be "DealStats" or "BizComps"' },
        { status: 400 },
      );
    }

    let selectedRanks: number[] = [];
    if (selectedRanksRaw) {
      try {
        selectedRanks = JSON.parse(selectedRanksRaw);
        if (!Array.isArray(selectedRanks) || !selectedRanks.every(Number.isFinite)) {
          throw new Error("Not an array of numbers");
        }
      } catch {
        return NextResponse.json(
          { error: "selectedRanks must be a JSON array of numbers" },
          { status: 400 },
        );
      }
    }

    // ── 3. Parse file with xlsx ────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "File contains no data rows" },
        { status: 400 },
      );
    }

    // ── 4. Map rows using the appropriate mapper ───────────────────────
    const mapperResult =
      sourceDatabase === "DealStats"
        ? mapDealStatsRows(rows as BvrRawRow[])
        : mapBizCompsRows(rows as BvrRawRow[]);

    // ── 5. Load thesis configs for SIC/NAICS filtering ─────────────────
    const thesisConfigs = await prisma.acquisitionThesisConfig.findMany({
      where:
        selectedRanks.length > 0
          ? { targetRank: { in: selectedRanks } }
          : undefined,
    });

    const allowedSicCodes = new Set(thesisConfigs.flatMap((c) => c.sicCodes));
    const allowedNaicsCodes = new Set(thesisConfigs.flatMap((c) => c.naicsCodes));

    // ── 6. Filter & categorize transactions ────────────────────────────
    const matched: BvrParsedTransaction[] = [];
    const filtered: BvrParsedTransaction[] = [];
    const rejected: BvrParsedTransaction[] = [];

    for (const t of mapperResult.transactions) {
      // Reject if missing critical fields (need at least one financial metric)
      if (t.mvic == null && t.revenue == null && t.ebitda == null && t.sde == null) {
        rejected.push(t);
        continue;
      }

      // Filter by SIC/NAICS/rank match
      const sicMatch = t.sicCode != null && allowedSicCodes.has(t.sicCode);
      const naicsMatch = t.naicsCode != null && allowedNaicsCodes.has(t.naicsCode);
      const rankMatch = t.targetRank != null && selectedRanks.includes(t.targetRank);

      if (
        selectedRanks.length > 0 &&
        allowedSicCodes.size + allowedNaicsCodes.size > 0 &&
        !sicMatch &&
        !naicsMatch &&
        !rankMatch
      ) {
        filtered.push(t);
        continue;
      }

      matched.push(t);
    }

    // ── 7. Deduplicate against existing DB records ─────────────────────
    const existing = await prisma.bvrTransaction.findMany({
      where: { sourceDatabase },
      select: { mvic: true, revenue: true, transactionDate: true },
    });

    const existingKeys = new Set(
      existing.map(
        (e) =>
          `${String(e.mvic ?? "null")}|${String(e.revenue ?? "null")}|${
            e.transactionDate ? e.transactionDate.toISOString() : "null"
          }`,
      ),
    );

    const newTransactions: BvrParsedTransaction[] = [];
    const duplicates: BvrParsedTransaction[] = [];

    for (const t of matched) {
      const key = `${t.mvic != null ? String(t.mvic) : "null"}|${
        t.revenue != null ? String(t.revenue) : "null"
      }|${t.transactionDate ? t.transactionDate.toISOString() : "null"}`;

      if (existingKeys.has(key)) {
        duplicates.push(t);
      } else {
        newTransactions.push(t);
        // Also add to set so intra-file duplicates are caught
        existingKeys.add(key);
      }
    }

    // ── 8. Preview mode ────────────────────────────────────────────────
    if (confirm !== "true") {
      return NextResponse.json({
        preview: true,
        totalRows: rows.length,
        newRows: newTransactions.length,
        duplicateRows: duplicates.length,
        rejectedRows: rejected.length,
        filteredRows: filtered.length,
        sample: newTransactions.slice(0, 20),
        parseErrors: mapperResult.parseErrors,
      });
    }

    // ── 9. Confirm mode — write to database ────────────────────────────
    const importRecord = await prisma.bvrImportHistory.create({
      data: {
        sourceDatabase,
        fileName: file.name,
        rowsTotal: rows.length,
        rowsImported: newTransactions.length,
        rowsDuplicate: duplicates.length,
        rowsRejected: rejected.length + filtered.length,
        sicCodesUsed: Array.from(allowedSicCodes),
        naicsCodesUsed: Array.from(allowedNaicsCodes),
      },
    });

    if (newTransactions.length > 0) {
      await prisma.bvrTransaction.createMany({
        data: newTransactions.map((t) => ({
          sourceDatabase,
          importId: importRecord.id,
          sicCode: t.sicCode,
          naicsCode: t.naicsCode,
          industry: t.industry,
          transactionDate: t.transactionDate,
          mvic: t.mvic,
          revenue: t.revenue,
          ebitda: t.ebitda,
          sde: t.sde,
          ebitdaMarginPct: t.ebitdaMarginPct,
          mvicEbitdaMultiple: t.mvicEbitdaMultiple,
          mvicRevenueMultiple: t.mvicRevenueMultiple,
          mvicSdeMultiple: t.mvicSdeMultiple,
          pctCashAtClose: t.pctCashAtClose,
          sellerNoteAmount: t.sellerNoteAmount,
          sellerNoteTermYears: t.sellerNoteTermYears,
          sellerNoteRate: t.sellerNoteRate,
          earnoutAmount: t.earnoutAmount,
          employeeCount: t.employeeCount,
          yearsInBusiness: t.yearsInBusiness,
          state: t.state,
          targetRank: t.targetRank,
        })),
      });
    }

    return NextResponse.json({
      importId: importRecord.id,
      rowsImported: newTransactions.length,
      rowsDuplicate: duplicates.length,
      rowsRejected: rejected.length + filtered.length,
    });
  } catch (error) {
    console.error("Error importing BVR data:", error);
    return NextResponse.json(
      { error: "Failed to import BVR data" },
      { status: 500 },
    );
  }
}
