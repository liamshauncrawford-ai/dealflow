/**
 * Seed script: Acquisition Thesis Config + Scoring Defaults
 *
 * Populates AcquisitionThesisConfig (4 ranks) and AppSetting (scoring config).
 * Run: npx tsx scripts/seed-acquisition-config.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const thesisConfigs = [
  {
    targetRank: 1,
    rankLabel: "MSP",
    description:
      "Managed IT Services Provider — highest synergy target. MRR funds PMS turnaround. Same commercial client base.",
    synergyDescription:
      "MSPs serve the same commercial clients that need AV integration. Liam takes over sales/BD while existing techs continue service delivery. MRR from managed services directly offsets PMS operating losses.",
    hardFilterMinRevenue: 800000,
    hardFilterMinEbitda: 150000,
    hardFilterMinEbitdaMargin: 0.1,
    hardFilterMinMrrPct: 0.3,
    hardFilterMinYears: 5,
    softFilterRevenueLow: 1000000,
    softFilterRevenueHigh: 3000000,
    softFilterEbitdaLow: 250000,
    softFilterEbitdaHigh: 425000,
    valuationMultipleLow: 4.0,
    valuationMultipleMid: 5.0,
    valuationMultipleHigh: 6.0,
    impliedPriceLow: 1000000,
    impliedPriceHigh: 2100000,
    sicCodes: ["7376", "7379", "7374"],
    naicsCodes: ["541512", "541513", "541519", "518210"],
  },
  {
    targetRank: 2,
    rankLabel: "UCaaS",
    description:
      "Unified Communications / Teams Rooms / VoIP — direct AV overlap with seat-based MRR.",
    synergyDescription:
      "UCaaS providers sell into the same meeting rooms PMS installs AV in. Teams Rooms and VoIP create sticky monthly revenue. Liam's AV background makes this a natural cross-sell.",
    hardFilterMinRevenue: 500000,
    hardFilterMinEbitda: 100000,
    hardFilterMinEbitdaMargin: 0.08,
    hardFilterMinMrrPct: 0.4,
    hardFilterMinYears: 3,
    softFilterRevenueLow: 500000,
    softFilterRevenueHigh: 2000000,
    softFilterEbitdaLow: 150000,
    softFilterEbitdaHigh: 350000,
    valuationMultipleLow: 4.0,
    valuationMultipleMid: 5.0,
    valuationMultipleHigh: 6.0,
    impliedPriceLow: 600000,
    impliedPriceHigh: 2100000,
    sicCodes: ["4813", "7372", "7379", "4899"],
    naicsCodes: ["517312", "517911", "541512", "519190"],
  },
  {
    targetRank: 3,
    rankLabel: "Security Integration",
    description:
      "Commercial security integration with monitoring contracts — recurring monitoring MRR, same job sites.",
    synergyDescription:
      "Security integrators wire the same commercial buildings PMS does AV for. Monitoring contracts provide sticky MRR. Low-voltage licensing overlaps.",
    hardFilterMinRevenue: 500000,
    hardFilterMinEbitda: 100000,
    hardFilterMinEbitdaMargin: 0.08,
    hardFilterMinMrrPct: 0.2,
    hardFilterMinYears: 5,
    softFilterRevenueLow: 500000,
    softFilterRevenueHigh: 2500000,
    softFilterEbitdaLow: 150000,
    softFilterEbitdaHigh: 350000,
    valuationMultipleLow: 3.0,
    valuationMultipleMid: 4.0,
    valuationMultipleHigh: 4.5,
    impliedPriceLow: 450000,
    impliedPriceHigh: 1600000,
    sicCodes: ["7382", "7381", "1731", "5065"],
    naicsCodes: ["561621", "238210", "423690"],
  },
  {
    targetRank: 4,
    rankLabel: "Structured Cabling",
    description:
      "Structured cabling / low-voltage contractor — operational bolt-on capturing margin PMS currently leaves on table.",
    synergyDescription:
      "PMS subcontracts cabling today at 0% margin. Owning a cabling company captures that margin internally and creates a referral pipeline for AV projects.",
    hardFilterMinRevenue: 300000,
    hardFilterMinEbitda: 80000,
    hardFilterMinEbitdaMargin: 0.08,
    hardFilterMinMrrPct: null,
    hardFilterMinYears: 3,
    softFilterRevenueLow: 500000,
    softFilterRevenueHigh: 2000000,
    softFilterEbitdaLow: 120000,
    softFilterEbitdaHigh: 280000,
    valuationMultipleLow: 2.5,
    valuationMultipleMid: 3.5,
    valuationMultipleHigh: 4.0,
    impliedPriceLow: 300000,
    impliedPriceHigh: 1100000,
    sicCodes: ["1731", "1799", "1711"],
    naicsCodes: ["238210", "238290", "561990"],
  },
];

const scoringConfig = {
  financial: {
    ebitdaMargin: {
      thresholds: [0.2, 0.15, 0.1, 0.05],
      points: [10, 8, 5, 0],
    },
    mrrPct: {
      thresholds: [0.5, 0.3, 0.15, 0.0],
      points: [10, 8, 5, 0],
    },
    revenueTrend: {
      values: {
        "Growing >10%": 10,
        "Growing 0-10%": 8,
        Flat: 5,
        "Declining 0-10%": 2,
        "Declining >10%": 0,
      },
    },
    clientConcentration: {
      thresholds: [0.1, 0.15, 0.25, 0.4],
      points: [10, 8, 5, 0],
    },
  },
  strategic: {
    targetRank: {
      values: { "1": 12, "2": 8, "3": 5, "4": 5, null: 0 },
    },
    clientOverlap: {
      values: { Direct: 12, Moderate: 8, Partial: 5, None: 0 },
    },
    geography: {
      denverMetroCities: [
        "Denver",
        "Aurora",
        "Lakewood",
        "Arvada",
        "Westminster",
        "Thornton",
        "Centennial",
        "Highlands Ranch",
        "Boulder",
        "Longmont",
        "Loveland",
        "Fort Collins",
        "Greeley",
        "Castle Rock",
        "Parker",
        "Broomfield",
        "Commerce City",
        "Northglenn",
        "Brighton",
        "Littleton",
        "Englewood",
        "Sheridan",
        "Golden",
        "Wheat Ridge",
        "Federal Heights",
        "Lone Tree",
        "Superior",
        "Louisville",
        "Lafayette",
        "Erie",
      ],
      points: { denverMetro: 12, colorado: 8, neighboringState: 5, other: 0 },
      neighboringStates: ["WY", "NE", "KS", "NM", "UT"],
    },
    ownerSituation: {
      values: { Strong: 12, Moderate: 8, Weak: 5, Unknown: 0 },
    },
    cap: 35,
  },
  operatorFit: {
    ownerIsPrimarySales: { true: 12, false: 5, null: 0 },
    technicalStaff: {
      thresholds: [3, 2, 1, 0],
      points: [12, 10, 5, 0],
    },
    sbaEligible: { true: 12, false: 0, null: 5 },
    cap: 25,
  },
  tiers: { A: 80, B: 65, C: 50, Inactive: 0 },
  disqualifiers: {
    ownerIsSoleTech: true,
    topClientPctMax: 0.4,
    residentialOnly: true,
    outsideColorado: true,
    negativeEbitdaUnlessCheap: { priceThreshold: 100000 },
    activeLitigation: true,
    keyManInsuranceLapse: true,
    revenueDecliningHard: true,
  },
  pms: {
    monthlyBurn: 28583,
    location: "Sheridan, CO 80110",
    ownerSalaryForSdeAdjustment: 95000,
  },
};

async function main() {
  console.log("Seeding acquisition thesis configs...\n");

  for (const config of thesisConfigs) {
    const result = await prisma.acquisitionThesisConfig.upsert({
      where: { targetRank: config.targetRank },
      update: { ...config },
      create: { ...config },
    });
    console.log(
      `  [Rank ${result.targetRank}] ${result.rankLabel} — upserted (id: ${result.id})`
    );
  }

  console.log("\nSeeding acquisition scoring config...\n");

  const setting = await prisma.appSetting.upsert({
    where: { key: "acquisition_scoring_config" },
    update: { value: JSON.stringify(scoringConfig) },
    create: {
      key: "acquisition_scoring_config",
      value: JSON.stringify(scoringConfig),
    },
  });
  console.log(
    `  [AppSetting] ${setting.key} — upserted (${setting.value.length} chars)\n`
  );

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
