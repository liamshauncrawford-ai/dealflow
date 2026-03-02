/**
 * One-off script: backfill compositeScore = fitScore for listings
 * where compositeScore is NULL but fitScore exists.
 *
 * Usage: npx tsx scripts/backfill-composite-score.ts
 */

import { config } from "dotenv";
config({ override: true });

async function main() {
  // Dynamic import to ensure fresh Prisma client after dotenv loads
  const { prisma } = await import("../src/lib/db");

  const result = await prisma.$executeRaw`
    UPDATE "Listing"
    SET "compositeScore" = "fitScore"
    WHERE "compositeScore" IS NULL
      AND "fitScore" IS NOT NULL
  `;

  console.log(`Backfilled compositeScore for ${result} listings`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
