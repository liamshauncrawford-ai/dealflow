/**
 * Migration script: map existing listings from primaryTrade to the new targetRank system.
 *
 * Mapping:
 *   SECURITY_FIRE_ALARM  -> targetRank=3, targetRankLabel="Security Integration"
 *   STRUCTURED_CABLING   -> targetRank=4, targetRankLabel="Structured Cabling"
 *   ELECTRICAL           -> targetRank=4, targetRankLabel="Structured Cabling"
 *   Everything else      -> null, null
 *
 * Usage: npx tsx scripts/migrate-acquisition-ranks.ts
 */

import { config } from "dotenv";
config({ override: true });

const TRADE_TO_RANK: Record<string, { targetRank: number; targetRankLabel: string }> = {
  SECURITY_FIRE_ALARM: { targetRank: 3, targetRankLabel: "Security Integration" },
  STRUCTURED_CABLING:  { targetRank: 4, targetRankLabel: "Structured Cabling" },
  ELECTRICAL:          { targetRank: 4, targetRankLabel: "Structured Cabling" },
};

async function main() {
  const { prisma } = await import("../src/lib/db");

  const listings = await prisma.listing.findMany({
    where: { isActive: true },
    select: { id: true, primaryTrade: true, title: true },
  });

  console.log(`Found ${listings.length} active listings\n`);

  let ranked = 0;
  let unranked = 0;
  const breakdown: Record<string, number> = {};

  for (const listing of listings) {
    const mapping = listing.primaryTrade ? TRADE_TO_RANK[listing.primaryTrade] : undefined;

    if (mapping) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          targetRank: mapping.targetRank,
          targetRankLabel: mapping.targetRankLabel,
        },
      });
      ranked++;
      const key = `Rank ${mapping.targetRank} (${mapping.targetRankLabel})`;
      breakdown[key] = (breakdown[key] || 0) + 1;
    } else {
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          targetRank: null,
          targetRankLabel: null,
        },
      });
      unranked++;
    }
  }

  console.log("=== Migration Summary ===");
  console.log(`  Ranked:   ${ranked}`);
  console.log(`  Unranked: ${unranked}`);
  console.log(`  Total:    ${listings.length}`);
  console.log("");
  console.log("Breakdown by rank:");
  for (const [key, count] of Object.entries(breakdown).sort()) {
    console.log(`  ${key}: ${count}`);
  }
  console.log("");
  console.log("Next step: Call POST /api/listings/rescore-all to score all listings with new rubric.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
