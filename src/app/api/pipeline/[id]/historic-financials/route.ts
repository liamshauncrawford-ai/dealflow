import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { parseHistoricWorkbook } from "@/lib/financial/parse-historic-pnl";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/pipeline/[id]/historic-financials
 * Fetch all historic P&L snapshots for an opportunity.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const historicPnLs = await prisma.historicPnL.findMany({
      where: { opportunityId: id },
      include: {
        rows: { orderBy: { displayOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ historicPnLs });
  } catch (error) {
    console.error("Error fetching historic financials:", error);
    return NextResponse.json(
      { error: "Failed to fetch historic financials" },
      { status: 500 },
    );
  }
}

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

    // Generate a workbookGroup UUID to link sheets from this upload
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
