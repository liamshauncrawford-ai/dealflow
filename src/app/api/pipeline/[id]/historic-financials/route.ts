import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseHistoricPnL } from "@/lib/financial/parse-historic-pnl";

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
 * Upload and parse an Excel P&L file.
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

    // Parse the spreadsheet
    let parsed;
    try {
      parsed = parseHistoricPnL(buffer, fileName);
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

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in the spreadsheet" },
        { status: 400 },
      );
    }

    // Create the HistoricPnL with all rows in a transaction
    const historicPnL = await prisma.$transaction(async (tx) => {
      const pnl = await tx.historicPnL.create({
        data: {
          opportunityId: id,
          title: parsed.title,
          companyName: parsed.companyName,
          basis: parsed.basis,
          sourceFileName: fileName,
          columns: parsed.columns as unknown as Prisma.InputJsonValue,
        },
      });

      // Bulk create rows
      await tx.historicPnLRow.createMany({
        data: parsed.rows.map((row, index) => ({
          historicPnlId: pnl.id,
          label: row.label,
          displayOrder: index,
          depth: row.depth,
          isTotal: row.isTotal,
          isSummary: row.isSummary,
          isBlank: row.isBlank,
          values: row.values as unknown as Prisma.InputJsonValue,
        })),
      });

      // Re-fetch with rows included
      return tx.historicPnL.findUnique({
        where: { id: pnl.id },
        include: {
          rows: { orderBy: { displayOrder: "asc" } },
        },
      });
    });

    return NextResponse.json(historicPnL, { status: 201 });
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
 * Delete a historic P&L snapshot and all its rows.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const pnlId = searchParams.get("pnlId");

    if (!pnlId) {
      return NextResponse.json(
        { error: "pnlId query parameter is required" },
        { status: 400 },
      );
    }

    // Verify it belongs to this opportunity
    const existing = await prisma.historicPnL.findFirst({
      where: { id: pnlId, opportunityId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Historic P&L not found" },
        { status: 404 },
      );
    }

    // Cascade delete removes rows automatically
    await prisma.historicPnL.delete({
      where: { id: pnlId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting historic P&L:", error);
    return NextResponse.json(
      { error: "Failed to delete historic P&L" },
      { status: 500 },
    );
  }
}
