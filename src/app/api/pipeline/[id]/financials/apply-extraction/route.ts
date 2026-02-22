import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RevenueTrend } from "@prisma/client";
import { parseBody } from "@/lib/validations/common";
import { applyExtractionSchema } from "@/lib/validations/financials";
import { recomputePeriodSummary } from "@/lib/financial/recompute-period";
import { createAuditLog } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/pipeline/[id]/financials/apply-extraction
 *
 * Apply AI-extracted financial data by creating FinancialPeriod records.
 * Takes an analysisId (from /extract endpoint) and an array of selected
 * period indices to import.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await parseBody(applyExtractionSchema, request);
    if (body.error) return body.error;

    const { analysisId, selectedPeriods } = body.data;

    // Fetch the cached analysis result
    const analysis = await prisma.aIAnalysisResult.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) {
      return NextResponse.json({ error: "Analysis result not found" }, { status: 404 });
    }
    if (analysis.opportunityId !== id) {
      return NextResponse.json({ error: "Analysis does not belong to this opportunity" }, { status: 403 });
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const result = analysis.resultData as any;
    if (!result?.periods || !Array.isArray(result.periods)) {
      return NextResponse.json({ error: "Invalid analysis result format" }, { status: 400 });
    }

    const createdPeriods: any[] = [];

    for (const idx of selectedPeriods) {
      const extractedPeriod = result.periods[idx];
      if (!extractedPeriod) continue;

      // Create period with line items and add-backs in a transaction
      const period = await prisma.$transaction(async (tx) => {
        const created = await tx.financialPeriod.create({
          data: {
            opportunityId: id,
            periodType: extractedPeriod.periodType || "ANNUAL",
            year: extractedPeriod.year,
            quarter: extractedPeriod.quarter ?? null,
            dataSource: "AI_EXTRACTION",
            confidence: result.confidence ?? null,
            notes: result.notes ? `AI extracted: ${result.notes}` : "AI extracted from document",
          },
        });

        // Create line items
        if (extractedPeriod.lineItems?.length > 0) {
          await tx.financialLineItem.createMany({
            data: extractedPeriod.lineItems.map((item: any, i: number) => ({
              periodId: created.id,
              category: item.category,
              subcategory: item.subcategory ?? null,
              rawLabel: item.rawLabel,
              displayOrder: i,
              amount: item.amount,
              isNegative: item.isNegative ?? false,
            })),
          });
        }

        // Create add-backs
        if (extractedPeriod.addBacks?.length > 0) {
          await tx.addBack.createMany({
            data: extractedPeriod.addBacks.map((ab: any) => ({
              periodId: created.id,
              category: ab.category,
              description: ab.description,
              amount: ab.amount,
              confidence: ab.confidence ?? null,
              sourceLabel: ab.sourceLabel ?? null,
              includeInSde: true,
              includeInEbitda: true,
            })),
          });
        }

        // Recompute summary
        const allLineItems = await tx.financialLineItem.findMany({
          where: { periodId: created.id },
        });
        const allAddBacks = await tx.addBack.findMany({
          where: { periodId: created.id },
        });
        const summary = recomputePeriodSummary(allLineItems, allAddBacks);

        return tx.financialPeriod.update({
          where: { id: created.id },
          data: summary,
          include: {
            lineItems: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
            addBacks: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
          },
        });
      });

      createdPeriods.push(period);
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // ─────────────────────────────────────────────
    // Sync extracted financials → Opportunity flat fields
    // These serve as the "last known good" snapshot for the Overview tab
    // and remain editable if the user needs to override.
    // ─────────────────────────────────────────────
    if (createdPeriods.length > 0) {
      try {
        // Get all annual periods for this opportunity (not just newly created ones)
        const annualPeriods = await prisma.financialPeriod.findMany({
          where: { opportunityId: id, periodType: "ANNUAL" },
          orderBy: { year: "desc" },
          select: {
            year: true,
            totalRevenue: true,
            ebitda: true,
            adjustedEbitda: true,
            ebitdaMargin: true,
            adjustedEbitdaMargin: true,
          },
        });

        if (annualPeriods.length > 0) {
          const mostRecent = annualPeriods[0];

          // Compute revenue trend from two most recent years
          let revenueTrend: RevenueTrend | null = null;
          if (annualPeriods.length >= 2 && mostRecent.totalRevenue && annualPeriods[1].totalRevenue) {
            const recent = Number(mostRecent.totalRevenue);
            const prior = Number(annualPeriods[1].totalRevenue);
            if (prior > 0) {
              const yoyGrowth = (recent - prior) / prior;
              revenueTrend = yoyGrowth > 0.05 ? RevenueTrend.GROWING : yoyGrowth < -0.05 ? RevenueTrend.DECLINING : RevenueTrend.STABLE;
            }
          }

          await prisma.opportunity.update({
            where: { id },
            data: {
              actualRevenue: mostRecent.totalRevenue ?? undefined,
              actualEbitda: mostRecent.adjustedEbitda ?? mostRecent.ebitda ?? undefined,
              actualEbitdaMargin: mostRecent.adjustedEbitdaMargin ?? mostRecent.ebitdaMargin ?? undefined,
              ...(revenueTrend ? { revenueTrend } : {}),
            },
          });
        }
      } catch (syncError) {
        // Non-fatal: log but don't fail the extraction
        console.error("Failed to sync financials to Opportunity:", syncError);
      }
    }

    // Audit log
    await createAuditLog({
      eventType: "CREATED",
      entityType: "FINANCIAL",
      entityId: analysisId,
      opportunityId: id,
      summary: `Applied AI extraction: ${createdPeriods.length} period(s) created`,
    });

    return NextResponse.json({
      created: createdPeriods.length,
      periods: createdPeriods,
    }, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A financial period with this type, year, and quarter already exists" },
        { status: 409 }
      );
    }
    console.error("Failed to apply extraction:", error);
    return NextResponse.json(
      { error: "Failed to apply extraction" },
      { status: 500 }
    );
  }
}
