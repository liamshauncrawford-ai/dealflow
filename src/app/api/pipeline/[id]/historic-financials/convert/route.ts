import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { convertHistoricToFinancialPeriods } from "@/lib/financial/convert-historic-to-periods";
import { recomputePeriodSummary, type PeriodOverrides } from "@/lib/financial/recompute-period";
import { syncOpportunitySummary } from "@/lib/financial/sync-opportunity";
import { createAuditLog } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/pipeline/[id]/historic-financials/convert
 *
 * Deterministic conversion: Historic P&L → FinancialPeriod records.
 *
 * Takes the already-parsed HistoricPnL data for this opportunity and
 * creates structured FinancialPeriod records with categorized line items,
 * add-backs, and override values — all without AI.
 *
 * Body (optional): { replaceExisting?: boolean }
 *   - replaceExisting=true (default): deletes existing FinancialPeriod records first
 *   - replaceExisting=false: only adds periods for years that don't already exist
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Parse optional body
    let replaceExisting = true;
    try {
      const body = await request.json();
      if (body.replaceExisting === false) replaceExisting = false;
    } catch {
      // No body or invalid JSON — use defaults
    }

    // Fetch all HistoricPnL records for this opportunity, with their rows
    const historicPnLs = await prisma.historicPnL.findMany({
      where: { opportunityId: id },
      include: {
        rows: { orderBy: { displayOrder: "asc" } },
      },
    });

    if (historicPnLs.length === 0) {
      return NextResponse.json(
        { error: "No historic P&L data found. Upload an Excel file first." },
        { status: 400 },
      );
    }

    // Convert DB records to the format expected by the converter
    const sheets = historicPnLs.map((pnl) => ({
      id: pnl.id,
      title: pnl.title,
      companyName: pnl.companyName,
      basis: pnl.basis,
      columns: (pnl.columns as Array<{ header: string; subheader: string | null }>) || [],
      rows: pnl.rows.map((r) => ({
        label: r.label,
        values: (r.values as (number | null)[]) || [],
        depth: r.depth,
        isTotal: r.isTotal,
        isSummary: r.isSummary,
        isBlank: r.isBlank,
        notes: null,
      })),
    }));

    // Run the deterministic conversion
    const conversion = convertHistoricToFinancialPeriods(sheets);

    if (conversion.periods.length === 0) {
      return NextResponse.json(
        { error: "No annual periods could be extracted from the historic P&L data." },
        { status: 400 },
      );
    }

    // If replacing, delete existing financial periods for this opportunity
    if (replaceExisting) {
      await prisma.financialPeriod.deleteMany({
        where: { opportunityId: id },
      });
    }

    // Create FinancialPeriod records for each extracted year
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const createdPeriods: any[] = [];

    for (const extracted of conversion.periods) {
      // Check if this year already exists (when not replacing)
      if (!replaceExisting) {
        const existing = await prisma.financialPeriod.findFirst({
          where: {
            opportunityId: id,
            periodType: "ANNUAL",
            year: extracted.year,
          },
        });
        if (existing) continue; // Skip existing years
      }

      // Build override data
      const overrideData: Record<string, number> = {};
      if (extracted.overrides.overrideTotalRevenue != null)
        overrideData.overrideTotalRevenue = extracted.overrides.overrideTotalRevenue;
      if (extracted.overrides.overrideTotalCogs != null)
        overrideData.overrideTotalCogs = extracted.overrides.overrideTotalCogs;
      if (extracted.overrides.overrideGrossProfit != null)
        overrideData.overrideGrossProfit = extracted.overrides.overrideGrossProfit;
      if (extracted.overrides.overrideTotalOpex != null)
        overrideData.overrideTotalOpex = extracted.overrides.overrideTotalOpex;
      if (extracted.overrides.overrideNetIncome != null)
        overrideData.overrideNetIncome = extracted.overrides.overrideNetIncome;
      if (extracted.overrides.overrideEbitda != null)
        overrideData.overrideEbitda = extracted.overrides.overrideEbitda;

      const period = await prisma.$transaction(async (tx) => {
        // Create the period
        const created = await tx.financialPeriod.create({
          data: {
            opportunityId: id,
            periodType: "ANNUAL",
            year: extracted.year,
            dataSource: "AI_EXTRACTION", // Using same enum, but it's deterministic
            confidence: 1.0, // 100% confidence — deterministic extraction
            notes: `Deterministic extraction from Historic P&L "${conversion.sheetUsed}"`,
            ...overrideData,
          },
        });

        // Create line items
        if (extracted.lineItems.length > 0) {
          await tx.financialLineItem.createMany({
            data: extracted.lineItems.map((item, i) => ({
              periodId: created.id,
              category: item.category,
              subcategory: item.subcategory ?? null,
              rawLabel: item.rawLabel,
              displayOrder: i,
              amount: Math.abs(item.amount),
              isNegative: item.isNegative,
            })),
          });
        }

        // Create add-backs
        if (extracted.addBacks.length > 0) {
          await tx.addBack.createMany({
            data: extracted.addBacks.map((ab) => ({
              periodId: created.id,
              category: ab.category as any,
              description: ab.description,
              amount: ab.amount, // Keep sign for negative add-backs (reversals)
              confidence: ab.confidence,
              sourceLabel: ab.sourceLabel,
              includeInSde: ab.includeInSde,
              includeInEbitda: ab.includeInEbitda,
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

        const overrides: PeriodOverrides | undefined =
          Object.keys(overrideData).length > 0
            ? {
                overrideTotalRevenue: overrideData.overrideTotalRevenue ?? null,
                overrideTotalCogs: overrideData.overrideTotalCogs ?? null,
                overrideGrossProfit: overrideData.overrideGrossProfit ?? null,
                overrideTotalOpex: overrideData.overrideTotalOpex ?? null,
                overrideEbitda: overrideData.overrideEbitda ?? null,
                overrideNetIncome: overrideData.overrideNetIncome ?? null,
              }
            : undefined;

        const summary = recomputePeriodSummary(allLineItems, allAddBacks, overrides);

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

    // Sync to Opportunity flat fields (Overview tab)
    if (createdPeriods.length > 0) {
      try {
        await syncOpportunitySummary(id);
      } catch (syncError) {
        console.error("Failed to sync financials to Opportunity:", syncError);
      }
    }

    // Audit log
    await createAuditLog({
      eventType: "CREATED",
      entityType: "FINANCIAL",
      entityId: id,
      opportunityId: id,
      summary: `Deterministic extraction from Historic P&L: ${createdPeriods.length} period(s) created from "${conversion.sheetUsed}"`,
    });

    return NextResponse.json(
      {
        created: createdPeriods.length,
        sheetUsed: conversion.sheetUsed,
        notes: conversion.notes,
        periods: createdPeriods.map((p) => ({
          id: p.id,
          year: p.year,
          totalRevenue: p.totalRevenue?.toString(),
          totalCogs: p.totalCogs?.toString(),
          grossProfit: p.grossProfit?.toString(),
          totalOpex: p.totalOpex?.toString(),
          ebitda: p.ebitda?.toString(),
          adjustedEbitda: p.adjustedEbitda?.toString(),
          sde: p.sde?.toString(),
          netIncome: p.netIncome?.toString(),
          lineItemCount: p.lineItems.length,
          addBackCount: p.addBacks.length,
        })),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to convert historic P&L:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
