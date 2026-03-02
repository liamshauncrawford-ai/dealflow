/**
 * One-time backfill: hide pipeline duplicates & flag non-CO listings.
 *
 * 1. Listings already promoted to an Opportunity but still visible → set isHidden = true
 * 2. Non-Colorado listings that are visible → flag as out_of_geography / TIER_3_DISQUALIFIED
 *    and tag with OUT_OF_GEOGRAPHY
 *
 * Usage:
 *   npx tsx scripts/cleanup-listings.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== DealFlow Listing Cleanup ===\n");

  // 1. Hide listings that already have a pipeline opportunity
  const pipelineDuplicates = await prisma.listing.findMany({
    where: {
      opportunity: { isNot: null },
      isHidden: false,
    },
    select: { id: true, title: true, businessName: true },
  });

  console.log(
    `Found ${pipelineDuplicates.length} listings with pipeline opportunities still visible:`
  );
  for (const l of pipelineDuplicates) {
    console.log(`  - ${l.businessName || l.title} (${l.id})`);
  }

  if (pipelineDuplicates.length > 0) {
    const result = await prisma.listing.updateMany({
      where: {
        id: { in: pipelineDuplicates.map((l) => l.id) },
      },
      data: { isHidden: true },
    });
    console.log(`  → Hidden ${result.count} pipeline duplicates\n`);
  }

  // 2. Flag non-Colorado listings as out-of-geography
  const nonColorado = await prisma.listing.findMany({
    where: {
      state: { not: "CO" },
      isHidden: false,
      thesisAlignment: { not: "out_of_geography" },
    },
    select: { id: true, title: true, businessName: true, state: true },
  });

  console.log(`Found ${nonColorado.length} non-Colorado listings to flag:`);
  for (const l of nonColorado) {
    console.log(`  - ${l.businessName || l.title} (state: ${l.state})`);
  }

  if (nonColorado.length > 0) {
    const result = await prisma.listing.updateMany({
      where: {
        id: { in: nonColorado.map((l) => l.id) },
      },
      data: {
        thesisAlignment: "out_of_geography",
        tier: "TIER_3_DISQUALIFIED",
      },
    });
    console.log(`  → Flagged ${result.count} non-CO listings as out_of_geography\n`);

    // Ensure the OUT_OF_GEOGRAPHY tag exists
    const tag = await prisma.tag.upsert({
      where: { name: "OUT_OF_GEOGRAPHY" },
      create: { name: "OUT_OF_GEOGRAPHY", color: "#EF4444" },
      update: {},
    });

    // Tag each non-CO listing (ListingTag uses composite PK: @@id([listingId, tagId]))
    for (const l of nonColorado) {
      await prisma.listingTag.upsert({
        where: { listingId_tagId: { listingId: l.id, tagId: tag.id } },
        create: { listingId: l.id, tagId: tag.id },
        update: {},
      });
    }
    console.log(`  → Tagged ${nonColorado.length} listings with OUT_OF_GEOGRAPHY`);
  }

  // 3. Summary
  const totalHidden = await prisma.listing.count({ where: { isHidden: true } });
  const totalVisible = await prisma.listing.count({ where: { isHidden: false } });
  const totalOutOfGeo = await prisma.listing.count({
    where: { thesisAlignment: "out_of_geography" },
  });

  console.log(`\n=== Summary ===`);
  console.log(`Total hidden: ${totalHidden}`);
  console.log(`Total visible: ${totalVisible}`);
  console.log(`Total out-of-geography: ${totalOutOfGeo}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
