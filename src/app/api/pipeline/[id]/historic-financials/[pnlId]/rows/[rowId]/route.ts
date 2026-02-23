import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = {
  params: Promise<{ id: string; pnlId: string; rowId: string }>;
};

/**
 * PATCH /api/pipeline/[id]/historic-financials/[pnlId]/rows/[rowId]
 *
 * Update a cell value or label in a historic P&L row.
 *
 * Body options:
 *   { columnIndex: number, value: number | null }  — update a specific cell
 *   { label: string }                              — update the row label
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, pnlId, rowId } = await params;

    // Verify the row belongs to the correct P&L and opportunity
    const row = await prisma.historicPnLRow.findFirst({
      where: {
        id: rowId,
        historicPnlId: pnlId,
        historicPnl: { opportunityId: id },
      },
    });

    if (!row) {
      return NextResponse.json(
        { error: "Row not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    // Label update
    if (typeof body.label === "string") {
      const updated = await prisma.historicPnLRow.update({
        where: { id: rowId },
        data: { label: body.label },
      });
      return NextResponse.json(updated);
    }

    // Cell value update
    if (typeof body.columnIndex === "number") {
      const { columnIndex, value } = body;
      const values = (row.values as (number | null)[]) ?? [];

      if (columnIndex < 0 || columnIndex >= values.length) {
        return NextResponse.json(
          { error: `columnIndex ${columnIndex} out of range (0-${values.length - 1})` },
          { status: 400 },
        );
      }

      // Validate value
      const newValue =
        value === null || value === ""
          ? null
          : typeof value === "number"
            ? value
            : parseFloat(value);

      if (newValue !== null && isNaN(newValue)) {
        return NextResponse.json(
          { error: "Invalid numeric value" },
          { status: 400 },
        );
      }

      // Update the specific position in the values array
      const newValues = [...values];
      newValues[columnIndex] = newValue;

      const updated = await prisma.historicPnLRow.update({
        where: { id: rowId },
        data: { values: newValues },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "Request must include either { label } or { columnIndex, value }" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error updating historic P&L row:", error);
    return NextResponse.json(
      { error: "Failed to update row" },
      { status: 500 },
    );
  }
}
