import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const industryMultiples = [
  {
    industry: "Construction",
    category: "General Contractor",
    sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.5,
    ebitdaLow: 3.0, ebitdaMedian: 4.0, ebitdaHigh: 5.5,
    revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.8,
    ebitdaMarginLow: 0.08, ebitdaMarginMedian: 0.10, ebitdaMarginHigh: 0.12,
    source: "BIZCOMPS / Industry Estimates",
  },
  {
    industry: "Construction",
    category: "HVAC",
    sdeLow: 2.3, sdeMedian: 2.8, sdeHigh: 3.8,
    ebitdaLow: 3.5, ebitdaMedian: 4.5, ebitdaHigh: 6.0,
    revenueLow: 0.4, revenueMedian: 0.6, revenueHigh: 0.9,
    ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.13, ebitdaMarginHigh: 0.15,
    source: "BIZCOMPS",
  },
  {
    industry: "Construction",
    category: "Plumbing",
    sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.2,
    ebitdaLow: 3.0, ebitdaMedian: 4.0, ebitdaHigh: 5.0,
    revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.8,
    ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.12, ebitdaMarginHigh: 0.14,
    source: "BIZCOMPS",
  },
  {
    industry: "Construction",
    category: "Electrical",
    sdeLow: 2.1, sdeMedian: 2.6, sdeHigh: 3.3,
    ebitdaLow: 3.2, ebitdaMedian: 4.2, ebitdaHigh: 5.2,
    revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.8,
    ebitdaMarginLow: 0.09, ebitdaMarginMedian: 0.11, ebitdaMarginHigh: 0.13,
    source: "BIZCOMPS",
  },
  {
    industry: "Construction",
    category: "Landscaping",
    sdeLow: 1.8, sdeMedian: 2.3, sdeHigh: 3.0,
    ebitdaLow: 2.5, ebitdaMedian: 3.5, ebitdaHigh: 4.5,
    revenueLow: 0.3, revenueMedian: 0.4, revenueHigh: 0.7,
    ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.13, ebitdaMarginHigh: 0.15,
    source: "BIZCOMPS",
  },
  {
    industry: "Construction",
    category: "Painting",
    sdeLow: 1.8, sdeMedian: 2.2, sdeHigh: 2.8,
    ebitdaLow: 2.5, ebitdaMedian: 3.5, ebitdaHigh: 4.5,
    revenueLow: 0.3, revenueMedian: 0.4, revenueHigh: 0.6,
    ebitdaMarginLow: 0.12, ebitdaMarginMedian: 0.15, ebitdaMarginHigh: 0.18,
    source: "BIZCOMPS",
  },
  {
    industry: "Construction",
    category: "Demolition",
    sdeLow: 2.0, sdeMedian: 2.4, sdeHigh: 3.0,
    ebitdaLow: 3.0, ebitdaMedian: 3.8, ebitdaHigh: 4.8,
    revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.7,
    ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.13, ebitdaMarginHigh: 0.15,
    source: "Industry Estimate",
  },
  {
    industry: "Transportation",
    category: "Moving / Logistics",
    sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.2,
    ebitdaLow: 3.0, ebitdaMedian: 4.0, ebitdaHigh: 5.0,
    revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.7,
    ebitdaMarginLow: 0.08, ebitdaMarginMedian: 0.10, ebitdaMarginHigh: 0.12,
    source: "BIZCOMPS",
  },
  {
    industry: "Manufacturing",
    category: null,
    sdeLow: 2.5, sdeMedian: 3.0, sdeHigh: 4.5,
    ebitdaLow: 3.5, ebitdaMedian: 5.0, ebitdaHigh: 7.0,
    revenueLow: 0.4, revenueMedian: 0.7, revenueHigh: 1.2,
    ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.14, ebitdaMarginHigh: 0.18,
    source: "First Page Sage / BIZCOMPS",
  },
  {
    industry: "Food Service",
    category: "Restaurant",
    sdeLow: 1.5, sdeMedian: 2.0, sdeHigh: 2.8,
    ebitdaLow: 2.5, ebitdaMedian: 3.5, ebitdaHigh: 4.5,
    revenueLow: 0.25, revenueMedian: 0.4, revenueHigh: 0.6,
    ebitdaMarginLow: 0.05, ebitdaMarginMedian: 0.08, ebitdaMarginHigh: 0.10,
    source: "BizBuySell",
  },
  {
    industry: "Retail",
    category: null,
    sdeLow: 1.5, sdeMedian: 2.0, sdeHigh: 2.8,
    ebitdaLow: 2.5, ebitdaMedian: 3.5, ebitdaHigh: 4.5,
    revenueLow: 0.2, revenueMedian: 0.4, revenueHigh: 0.6,
    ebitdaMarginLow: 0.05, ebitdaMarginMedian: 0.08, ebitdaMarginHigh: 0.10,
    source: "BizBuySell",
  },
  {
    industry: "Professional Services",
    category: null,
    sdeLow: 2.2, sdeMedian: 2.8, sdeHigh: 4.0,
    ebitdaLow: 3.5, ebitdaMedian: 4.5, ebitdaHigh: 6.5,
    revenueLow: 0.5, revenueMedian: 0.8, revenueHigh: 1.5,
    ebitdaMarginLow: 0.15, ebitdaMarginMedian: 0.20, ebitdaMarginHigh: 0.25,
    source: "BizBuySell",
  },
  {
    industry: "Healthcare",
    category: "Dental",
    sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.5,
    ebitdaLow: 3.0, ebitdaMedian: 4.0, ebitdaHigh: 5.5,
    revenueLow: 0.5, revenueMedian: 0.8, revenueHigh: 1.2,
    ebitdaMarginLow: 0.15, ebitdaMarginMedian: 0.20, ebitdaMarginHigh: 0.25,
    source: "BIZCOMPS",
  },
  {
    industry: "Healthcare",
    category: null,
    sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.5,
    ebitdaLow: 3.5, ebitdaMedian: 5.0, ebitdaHigh: 7.0,
    revenueLow: 0.5, revenueMedian: 0.8, revenueHigh: 1.5,
    ebitdaMarginLow: 0.15, ebitdaMarginMedian: 0.20, ebitdaMarginHigh: 0.25,
    source: "BIZCOMPS",
  },
  {
    industry: "Technology",
    category: "Software / SaaS",
    sdeLow: 3.0, sdeMedian: 3.5, sdeHigh: 5.0,
    ebitdaLow: 5.0, ebitdaMedian: 7.0, ebitdaHigh: 12.0,
    revenueLow: 1.0, revenueMedian: 2.0, revenueHigh: 5.0,
    ebitdaMarginLow: 0.20, ebitdaMarginMedian: 0.28, ebitdaMarginHigh: 0.35,
    source: "First Page Sage",
  },
  {
    industry: "Automotive",
    category: "Auto Repair / Service",
    sdeLow: 1.8, sdeMedian: 2.3, sdeHigh: 3.0,
    ebitdaLow: 2.5, ebitdaMedian: 3.5, ebitdaHigh: 4.5,
    revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.7,
    ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.13, ebitdaMarginHigh: 0.15,
    source: "BIZCOMPS",
  },
  {
    industry: "Default",
    category: null,
    sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.5,
    ebitdaLow: 3.0, ebitdaMedian: 4.0, ebitdaHigh: 5.5,
    revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.8,
    ebitdaMarginLow: 0.08, ebitdaMarginMedian: 0.10, ebitdaMarginHigh: 0.15,
    source: "Conservative Estimate",
  },
];

async function main() {
  console.log("Seeding industry multiples...");

  for (const multiple of industryMultiples) {
    await prisma.industryMultiple.upsert({
      where: {
        industry_category: {
          industry: multiple.industry,
          category: multiple.category ?? "",
        },
      },
      update: {
        ...multiple,
        category: multiple.category ?? undefined,
      },
      create: {
        ...multiple,
        category: multiple.category ?? undefined,
      },
    });
  }

  console.log(`Seeded ${industryMultiples.length} industry multiples.`);

  // Seed default scrape schedules
  const platforms = [
    { platform: "BIZBUYSELL" as const, cron: "0 6 * * *" },
    { platform: "BIZQUEST" as const, cron: "30 6 * * *" },
    { platform: "DEALSTREAM" as const, cron: "0 7 */2 * *" },
    { platform: "TRANSWORLD" as const, cron: "30 7 */2 * *" },
    { platform: "LOOPNET" as const, cron: "0 8 * * *" },
    { platform: "BUSINESSBROKER" as const, cron: "30 8 */2 * *" },
  ];

  for (const p of platforms) {
    await prisma.scrapeSchedule.upsert({
      where: { platform: p.platform },
      update: { cronExpression: p.cron },
      create: {
        platform: p.platform,
        cronExpression: p.cron,
        isEnabled: false, // Disabled by default until cookies are set up
      },
    });
  }

  console.log(`Seeded ${platforms.length} scrape schedules.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
