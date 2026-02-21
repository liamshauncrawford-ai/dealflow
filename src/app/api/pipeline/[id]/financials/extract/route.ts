import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { extractFinancials } from "@/lib/ai/financial-extractor";
import { isAIEnabled } from "@/lib/ai/claude-client";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Convert an xlsx/xls/csv buffer into a readable text representation.
 * Each sheet becomes a markdown-style table so Claude can parse column structure.
 */
function spreadsheetToText(buffer: Buffer, fileName: string): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert to array-of-arrays for clean tabular output
    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (rows.length === 0) continue;

    // Build a readable table representation
    sections.push(`\n=== Sheet: ${sheetName} ===\n`);

    for (const row of rows) {
      // Join cells with pipe delimiter — preserves column alignment for Claude
      const line = row.map((cell) => String(cell ?? "").trim()).join(" | ");
      if (line.replace(/\s*\|\s*/g, "").length > 0) {
        sections.push(line);
      }
    }
  }

  if (sections.length === 0) {
    return "";
  }

  return `[Extracted from spreadsheet: ${fileName}]\n${sections.join("\n")}`;
}

/**
 * Detect file type from filename extension and extract text accordingly.
 */
function extractTextFromBuffer(buffer: Buffer, fileName: string): string {
  const lower = fileName.toLowerCase();

  // Spreadsheet formats — use xlsx parser
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsm") ||
    lower.endsWith(".xltx") ||
    lower.endsWith(".csv")
  ) {
    return spreadsheetToText(buffer, fileName);
  }

  // Text/PDF — decode as UTF-8 (PDFs with embedded text work, scanned PDFs won't)
  return buffer.toString("utf-8");
}

/**
 * POST /api/pipeline/[id]/financials/extract
 *
 * Extract financial data from a document using AI.
 * Accepts either:
 *   - { documentId: string } — fetches document content
 *   - { text: string } — uses provided text directly
 *
 * Supports: PDF (text-based), XLSX, XLS, CSV, TXT
 * Sends text to Claude for structured P&L extraction,
 * caches result in AIAnalysisResult.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: "AI features are not configured (ANTHROPIC_API_KEY missing)" },
        { status: 503 }
      );
    }

    const { id } = await params;
    const json = await request.json();

    let documentText: string;

    if (json.text && typeof json.text === "string") {
      // Direct text input
      documentText = json.text;
    } else if (json.documentId && typeof json.documentId === "string") {
      // Fetch document from DB
      const document = await prisma.dealDocument.findUnique({
        where: { id: json.documentId },
        select: { id: true, fileName: true, fileData: true, fileType: true, opportunityId: true },
      });

      if (!document) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      if (document.opportunityId !== id) {
        return NextResponse.json({ error: "Document does not belong to this opportunity" }, { status: 403 });
      }
      if (!document.fileData) {
        return NextResponse.json(
          { error: "Document has no file content stored." },
          { status: 400 }
        );
      }

      // Extract text based on file type
      const buffer = Buffer.from(document.fileData);
      documentText = extractTextFromBuffer(buffer, document.fileName);

      if (!documentText || documentText.length < 50) {
        return NextResponse.json(
          { error: "Could not extract readable text from this document. The file may be empty, scanned (image-only), or in an unsupported format." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Either documentId or text is required" },
        { status: 400 }
      );
    }

    // Run AI extraction (with optional division/segment filter)
    const divisionFilter = typeof json.divisionFilter === "string" ? json.divisionFilter : undefined;
    const extraction = await extractFinancials(documentText, { divisionFilter });

    // Cache result in AIAnalysisResult
    const cached = await prisma.aIAnalysisResult.create({
      data: {
        opportunityId: id,
        analysisType: "FINANCIAL_EXTRACTION",
        resultData: extraction as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        modelUsed: "claude-sonnet-4-5",
        inputTokens: 0,
        outputTokens: 0,
      },
    });

    return NextResponse.json({
      analysisId: cached.id,
      ...extraction,
    });
  } catch (error) {
    console.error("Failed to extract financials:", error);
    return NextResponse.json(
      { error: "Failed to extract financials from document" },
      { status: 500 }
    );
  }
}
