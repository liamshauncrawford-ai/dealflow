/**
 * One-time production data cleanup for Precision Media Solutions.
 *
 * Removes parent/total line items that were double-counted during AI extraction,
 * then recomputes all period summaries.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/fix-precision-media-financials.ts
 *
 * Pass --dry-run to preview changes without writing.
 */

import { PrismaClient } from "@prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const prisma = new PrismaClient();

  console.log(DRY_RUN ? "=== DRY RUN (no changes will be made) ===" : "=== LIVE RUN ===");

  try {
    // Find Precision Media opportunity
    const opp = await prisma.opportunity.findFirst({
      where: { title: { contains: "Precision Media", mode: "insensitive" } },
      select: { id: true, title: true },
    });

    if (!opp) {
      console.error("Precision Media opportunity not found!");
      return;
    }
    console.log(`Found opportunity: ${opp.title} (${opp.id})`);

    // Fetch all financial periods with line items
    const periods = await prisma.financialPeriod.findMany({
      where: { opportunityId: opp.id },
      include: {
        lineItems: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
        addBacks: true,
      },
      orderBy: { year: "desc" },
    });

    console.log(`Found ${periods.length} financial period(s)\n`);

    const totalPattern = /\(total\)\s*$/i;

    for (const period of periods) {
      const label = `${period.periodType} ${period.year}${period.quarter ? ` Q${period.quarter}` : ""}`;
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Period: ${label} (${period.id})`);
      console.log(`  Line items: ${period.lineItems.length}`);
      console.log(`  Current totals: Revenue=${period.totalRevenue}, COGS=${period.totalCogs}, OPEX=${period.totalOpex}`);
      console.log(`  Gross Profit=${period.grossProfit}, EBITDA=${period.ebitda}, Net Income=${period.netIncome}`);

      // In QuickBooks P&L exports, "(Total)" rows are ALWAYS parent summaries.
      // Their child detail items are also extracted, causing double-counting.
      // Safe to remove ALL "(Total)" rows — the individual items remain.
      const toDelete: string[] = [];
      let removedSum = 0;

      for (const item of period.lineItems) {
        if (totalPattern.test(item.rawLabel)) {
          const amt = Math.abs(Number(item.amount));
          console.log(`  [DELETE] "${item.rawLabel}" ($${item.amount})`);
          toDelete.push(item.id);
          removedSum += amt;
        }
      }

      if (toDelete.length > 0) {
        console.log(`  => Total value of removed rows: $${removedSum.toFixed(2)}`);
      }

      if (toDelete.length === 0) {
        console.log("  No duplicate parent rows found.");
        continue;
      }

      console.log(`\n  => Will delete ${toDelete.length} parent/total rows`);

      if (!DRY_RUN) {
        // Delete the parent rows
        const deleted = await prisma.financialLineItem.deleteMany({
          where: { id: { in: toDelete } },
        });
        console.log(`  Deleted ${deleted.count} line items`);

        // Recompute the period summary (dynamically import to get the latest version)
        const { recomputeAndUpdate } = await import("../src/lib/financial/recompute-and-update");
        await recomputeAndUpdate(period.id);

        // Re-fetch to show new values
        const updated = await prisma.financialPeriod.findUnique({
          where: { id: period.id },
          select: {
            totalRevenue: true, totalCogs: true, grossProfit: true,
            totalOpex: true, ebitda: true, netIncome: true,
          },
        });
        if (updated) {
          console.log(`  NEW totals: Revenue=${updated.totalRevenue}, COGS=${updated.totalCogs}, OPEX=${updated.totalOpex}`);
          console.log(`  Gross Profit=${updated.grossProfit}, EBITDA=${updated.ebitda}, Net Income=${updated.netIncome}`);
        }
      }
    }

    // Sync opportunity summary
    if (!DRY_RUN) {
      const { syncOpportunitySummary } = await import("../src/lib/financial/sync-opportunity");
      try {
        await syncOpportunitySummary(opp.id);
        console.log("\nOpportunity summary synced.");
      } catch (e) {
        console.error("Sync failed:", e);
      }
    }

    console.log("\nDone!");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
