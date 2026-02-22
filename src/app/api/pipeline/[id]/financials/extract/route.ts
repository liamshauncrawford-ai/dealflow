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

// Allow up to 2 minutes for large file extraction + Claude API retries
export const maxDuration = 120;

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
  // ── Pre-flight checks ──
  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "AI features are not configured (ANTHROPIC_API_KEY missing)" },
      { status: 503 }
    );
  }

  const { id } = await params;

  let json: Record<string, unknown>;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // ── Step 1: Get document text ──
  let documentText: string;

  if (json.text && typeof json.text === "string") {
    documentText = json.text;
  } else if (json.documentId && typeof json.documentId === "string") {
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

    // Parse file content into text
    try {
      const buffer = Buffer.from(document.fileData);
      documentText = extractTextFromBuffer(buffer, document.fileName);
    } catch (parseErr) {
      console.error("File parsing failed:", parseErr);
      return NextResponse.json(
        { error: "Could not read file content. The file may be corrupted or in an unsupported format." },
        { status: 400 }
      );
    }

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

  // ── Step 2: Run AI extraction ──
  let extraction;
  const divisionFilter = typeof json.divisionFilter === "string" ? json.divisionFilter : undefined;

  try {
    extraction = await extractFinancials(documentText, { divisionFilter });
  } catch (aiErr: unknown) {
    const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
    console.error("AI extraction failed:", aiErr);

    // Surface specific, actionable error messages
    if (msg.includes("context_length") || msg.includes("too many tokens") || msg.includes("max_tokens")) {
      return NextResponse.json(
        { error: "Document text is too large for AI processing. Try a smaller or simpler file." },
        { status: 400 }
      );
    }
    if (aiErr instanceof SyntaxError || msg.includes("JSON")) {
      return NextResponse.json(
        { error: "AI returned an unexpected response format. Please try again." },
        { status: 502 }
      );
    }
    if (msg.includes("rate_limit") || msg.includes("429")) {
      return NextResponse.json(
        { error: "AI service is busy. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("authentication") || msg.includes("401")) {
      return NextResponse.json(
        { error: "AI service authentication error. Please contact support." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Extraction failed: ${msg}` },
      { status: 500 }
    );
  }

  // ── Step 3: Cache result ──
  try {
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
  } catch (dbErr) {
    console.error("Failed to cache extraction result:", dbErr);
    return NextResponse.json(
      { error: "Extraction succeeded but failed to save results. Please try again." },
      { status: 500 }
    );
  }
}
