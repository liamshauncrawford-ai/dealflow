import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { createFinancialPeriodSchema } from "@/lib/validations/financials";
import { recomputePeriodSummary } from "@/lib/financial/recompute-period";
import { createAuditLog } from "@/lib/audit";

// ─────────────────────────────────────────────
// DELETE /api/pipeline/[id]/financials — Clear all financial periods
// ─────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Count first so we can report what was deleted
    const count = await prisma.financialPeriod.count({
      where: { opportunityId: id },
    });

    if (count === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    // Cascade handles line items + add-backs automatically
    await prisma.financialPeriod.deleteMany({
      where: { opportunityId: id },
    });

    await createAuditLog({
      eventType: "DELETED",
      entityType: "FINANCIAL",
      entityId: id,
      opportunityId: id,
      summary: `Cleared all financial periods (${count} period${count !== 1 ? "s" : ""} removed)`,
    });

    return NextResponse.json({ deleted: count });
  } catch (error) {
    console.error("Failed to clear financial periods:", error);
    return NextResponse.json(
      { error: "Failed to clear financial periods" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const periods = await prisma.financialPeriod.findMany({
      where: { opportunityId: id },
      include: {
        lineItems: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
        addBacks: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
      },
      orderBy: [{ year: "desc" }, { periodType: "asc" }],
    });

    return NextResponse.json(periods);
  } catch (error) {
    console.error("Failed to fetch financial periods:", error);
    return NextResponse.json(
      { error: "Failed to fetch financial periods" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await parseBody(createFinancialPeriodSchema, request);
    if (body.error) return body.error;

    const { lineItems: lineItemsData, addBacks: addBacksData, ...periodData } = body.data;

    // Create period with line items and add-backs in a transaction
    const period = await prisma.$transaction(async (tx) => {
      const created = await tx.financialPeriod.create({
        data: {
          opportunityId: id,
          ...periodData,
        },
      });

      // Create line items
      if (lineItemsData && lineItemsData.length > 0) {
        await tx.financialLineItem.createMany({
          data: lineItemsData.map((item, idx) => ({
            periodId: created.id,
            category: item.category,
            subcategory: item.subcategory ?? null,
            rawLabel: item.rawLabel,
            displayOrder: item.displayOrder ?? idx,
            amount: item.amount,
            isNegative: item.isNegative ?? false,
            notes: item.notes ?? null,
          })),
        });
      }

      // Create add-backs
      if (addBacksData && addBacksData.length > 0) {
        await tx.addBack.createMany({
          data: addBacksData.map((ab) => ({
            periodId: created.id,
            category: ab.category,
            description: ab.description,
            amount: ab.amount,
            confidence: ab.confidence ?? null,
            includeInSde: ab.includeInSde ?? true,
            includeInEbitda: ab.includeInEbitda ?? true,
            notes: ab.notes ?? null,
            sourceLabel: ab.sourceLabel ?? null,
          })),
        });
      }

      // Recompute summary values
      const allLineItems = await tx.financialLineItem.findMany({
        where: { periodId: created.id },
      });
      const allAddBacks = await tx.addBack.findMany({
        where: { periodId: created.id },
      });

      const summary = recomputePeriodSummary(allLineItems, allAddBacks);

      const updated = await tx.financialPeriod.update({
        where: { id: created.id },
        data: summary,
        include: {
          lineItems: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
          addBacks: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
        },
      });

      return updated;
    });

    // Audit log
    await createAuditLog({
      eventType: "CREATED",
      entityType: "FINANCIAL",
      entityId: period.id,
      opportunityId: id,
      summary: `Created financial period: ${period.periodType} ${period.year}${period.quarter ? ` Q${period.quarter}` : ""}`,
    });

    return NextResponse.json(period, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A financial period with this type, year, and quarter already exists" },
        { status: 409 }
      );
    }
    console.error("Failed to create financial period:", error);
    return NextResponse.json(
      { error: "Failed to create financial period" },
      { status: 500 }
    );
  }
}
