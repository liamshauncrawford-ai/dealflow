/**
 * Seed script — scraper configurations from Section 4 of the architecture doc.
 *
 * Creates ScraperConfig records for all data sources. Dodge Construction
 * is created but disabled (deferred to post-acquisition per user instruction).
 *
 * Usage: npx tsx prisma/seed-scrapers.ts
 */

import { config } from "dotenv";
config({ override: true });

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const scraperConfigs = [
    {
      sourceName: "bizbuysell",
      isActive: true,
      frequency: "daily",
      config: {
        searchUrls: [
          "https://www.bizbuysell.com/colorado/electrical-contractor-businesses-for-sale/",
          "https://www.bizbuysell.com/colorado/technology-services-businesses-for-sale/",
        ],
        keywords: [
          "structured cabling",
          "low voltage",
          "security systems",
          "building automation",
          "fire alarm",
          "HVAC controls",
        ],
        scrapeMethod: "puppeteer",
      },
    },
    {
      sourceName: "bizquest",
      isActive: true,
      frequency: "daily",
      config: {
        searchUrls: [
          "https://www.bizquest.com/find-a-business/?q=electrical+contractor&state=CO",
          "https://www.bizquest.com/find-a-business/?q=low+voltage&state=CO",
        ],
        keywords: [
          "electrical contractor",
          "low voltage",
          "cabling",
          "security",
        ],
        scrapeMethod: "puppeteer",
      },
    },
    {
      sourceName: "csos",
      isActive: true,
      frequency: "weekly",
      config: {
        url: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do",
        searchTerms: [
          "structured cabling",
          "low voltage",
          "data cabling",
          "communications contractor",
          "security systems",
          "building automation",
          "fiber optic",
          "network cabling",
        ],
        entityTypes: ["Limited Liability Company", "Corporation"],
        status: ["Good Standing", "Delinquent"],
      },
    },
    {
      sourceName: "dora",
      isActive: true,
      frequency: "weekly",
      config: {
        url: "https://apps.colorado.gov/dora/licensing/Lookup",
        licenseTypes: [
          "Electrical Contractor",
          "Low Voltage Installer",
          "Fire Alarm Installer",
          "Security Systems Contractor",
        ],
      },
    },
    {
      sourceName: "google_alerts",
      isActive: true,
      frequency: "every_6_hours",
      config: {
        rssFeeds: [
          "https://www.datacenterdynamics.com/en/rss/",
          "https://datacenterfrontier.com/feed/",
        ],
        alertKeywords: [
          "colorado data center construction",
          "denver data center",
          "aurora data center",
          "front range data center",
          "colorado cabling contractor for sale",
          "colorado electrical contractor retirement",
        ],
      },
    },
    {
      sourceName: "dodge_construction",
      isActive: false, // DEFERRED — activate post-acquisition (~Q3-Q4 2026)
      frequency: "daily",
      config: {
        enabled: false,
        note: "Dodge Data & Analytics subscription (~$300/mo). Activate after platform acquisition closes.",
        projectFilters: {
          type: ["Data Center", "Technology", "Mission Critical"],
          location: "Colorado",
          valueMin: 1_000_000,
          stage: ["Planning", "Bidding", "Under Construction"],
        },
      },
    },
  ];

  console.log("Seeding scraper configurations...\n");

  for (const sc of scraperConfigs) {
    const existing = await prisma.scraperConfig.findUnique({
      where: { sourceName: sc.sourceName },
    });

    if (existing) {
      // Update existing config
      await prisma.scraperConfig.update({
        where: { id: existing.id },
        data: {
          isActive: sc.isActive,
          frequency: sc.frequency,
          config: sc.config as object,
        },
      });
      console.log(`  [updated] ${sc.sourceName} — active: ${sc.isActive}, freq: ${sc.frequency}`);
    } else {
      await prisma.scraperConfig.create({
        data: {
          sourceName: sc.sourceName,
          isActive: sc.isActive,
          frequency: sc.frequency,
          config: sc.config as object,
        },
      });
      console.log(`  [created] ${sc.sourceName} — active: ${sc.isActive}, freq: ${sc.frequency}`);
    }
  }

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(console.error);
