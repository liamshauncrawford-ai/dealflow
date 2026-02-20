#!/usr/bin/env npx tsx
/**
 * Run a thesis-targeted BizBuySell scrape directly (bypasses auth middleware).
 *
 * Usage: npx tsx scripts/run-scrape.ts
 */

import "dotenv/config";

async function main() {
  console.log("=== Thesis-Targeted BizBuySell Scrape ===\n");

  // Check for Apify token
  if (!process.env.APIFY_API_TOKEN) {
    console.error("❌ APIFY_API_TOKEN not set in .env");
    process.exit(1);
  }
  console.log("✓ APIFY_API_TOKEN configured");

  // Import after dotenv loads
  const { prisma } = await import("@/lib/db");
  const { apifyScrape } = await import("@/lib/scrapers/apify-scraper");

  // Create a scrape run record
  const run = await prisma.scrapeRun.create({
    data: {
      platform: "BIZBUYSELL",
      triggeredBy: "manual-script",
      status: "PENDING",
    },
  });

  console.log(`✓ Created ScrapeRun: ${run.id}\n`);
  console.log("Starting Apify actor with thesis-targeted searches...\n");

  try {
    await apifyScrape(run.id, { state: "CO" });

    // Fetch final status
    const result = await prisma.scrapeRun.findUnique({
      where: { id: run.id },
    });

    console.log("\n=== Results ===");
    console.log(`Status:          ${result?.status}`);
    console.log(`Listings found:  ${result?.listingsFound ?? 0}`);
    console.log(`New listings:    ${result?.listingsNew ?? 0}`);
    console.log(`Updated:         ${result?.listingsUpdated ?? 0}`);
    console.log(`Errors:          ${result?.errors ?? 0}`);
    if (result?.errorLog) {
      console.log(`Error log:       ${result.errorLog}`);
    }
  } catch (err) {
    console.error("\n❌ Scrape failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
