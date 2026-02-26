/**
 * Seed script — 5 priority acquisition targets from the DealFlow briefing doc.
 *
 * Creates Listing records with isManualEntry: true and runs the fit score
 * engine to populate fitScore and compositeScore immediately.
 *
 * Usage: npx tsx prisma/seed-targets.ts
 */

import { config } from "dotenv";
config({ override: true });

async function main() {
  // Dynamic import to pick up freshly generated Prisma client
  const { PrismaClient } = await import("@prisma/client");
  const { computeFitScore } = await import("../src/lib/scoring/fit-score-engine");

  const prisma = new PrismaClient();

  const targets = [
    {
      title: "SPC Communications (Structured Plus Communications)",
      businessName: "Structured Plus Communications, Inc.",
      description:
        "Denver-based structured cabling and fiber optics company. 30+ year history with government, healthcare, education, and commercial clients. MBE/WBE certified, GSA contract holder. Owner Kenny Som estimated 55-70. No visible succession plan. Non-union shop with own staff.",
      city: "Aurora",
      state: "CO",
      metroArea: "Denver Metro",
      fullAddress: "631 Salida Way, Unit A4, Aurora, CO 80011",
      latitude: 39.7281,
      longitude: -104.8275,
      industry: "Structured Cabling & Fiber",
      established: 1993,
      revenue: 5_000_000, // Midpoint of $2-10M estimate
      employees: 15,
      primaryTrade: "STRUCTURED_CABLING" as const,
      secondaryTrades: [],
      certifications: ["MBE/WBE", "GSA Contract", "BBB", "BICSI Member"],

      dcExperience: true,
      dcClients: [],
      website: "structuredplus.com",
      tier: "TIER_1_ACTIVE" as const,
      // Scoring inputs
      estimatedAgeRange: "55-70",
      keyPersonRisk: "HIGH",
      recurringRevenuePct: 0.10,
    },
    {
      title: "ISI Technology (Integrated Systems Installers)",
      businessName: "Integrated Systems Installers, Inc.",
      description:
        "Lakewood-based security, surveillance, access control, and structured cabling company. 30 years in business, $6M revenue on 2-4 W-2 employees (uses subs). Partnership: Marty Wedel (Pres) + Walter Tew (Partner). Dual retirement motivation. Very high key-person risk. Rebranded in 2022.",
      city: "Lakewood",
      state: "CO",
      metroArea: "Denver Metro",
      fullAddress: "747 Sheridan Blvd #2D, Lakewood, CO 80214",
      latitude: 39.7312,
      longitude: -105.0525,
      industry: "Security & Cabling Integration",
      established: 1996,
      revenue: 6_000_000,
      employees: 4,
      primaryTrade: "STRUCTURED_CABLING" as const,
      secondaryTrades: ["SECURITY_FIRE_ALARM" as const],
      certifications: ["BBB Accredited"],

      dcExperience: false,
      dcClients: [],
      website: "isicabling.com",
      tier: "TIER_1_ACTIVE" as const,
      estimatedAgeRange: "55-65",
      keyPersonRisk: "HIGH",
      recurringRevenuePct: 0.05,
    },
    {
      title: "Mechanical Solutions Inc. (MSI)",
      businessName: "Mechanical Solutions, Inc.",
      description:
        "Denver BAS/building automation integrator. Distech Controls factory certified. 27+ years in business. Prestigious clients: Denver Performing Arts Complex, EPA Region 8 HQ, McMurdo Station. Founder (40+ years industry) and CFO (30yr CPA) both aging out. No visible succession.",
      city: "Denver",
      state: "CO",
      metroArea: "Denver Metro",
      industry: "Building Automation Systems",
      established: 1998,
      revenue: 5_000_000, // Midpoint of $3-8M estimate
      employees: 10,
      primaryTrade: "HVAC_MECHANICAL" as const,
      secondaryTrades: ["ELECTRICAL" as const],
      certifications: ["Distech Controls Factory Certified"],

      dcExperience: true,
      dcClients: [],
      website: "msicolorado.com",
      tier: "TIER_1_ACTIVE" as const,
      estimatedAgeRange: "65-75",
      keyPersonRisk: "HIGH",
      recurringRevenuePct: 0.25,
    },
    {
      title: "Colorado Controls",
      businessName: "Colorado Controls",
      description:
        "Fort Collins BAS/HVAC controls and lighting controls company. Reliable Controls Factory Authorized Dealer (1 of 3 in CO). ABC and AGC member. Clients: Weld County schools, UCHealth, banks, military. Founder has 40 years HVAC experience. 12+ years in business.",
      city: "Fort Collins",
      state: "CO",
      metroArea: "Front Range",
      industry: "Building Automation Systems",
      established: 2013,
      revenue: 2_000_000, // Conservative estimate
      employees: 8,
      primaryTrade: "HVAC_MECHANICAL" as const,
      secondaryTrades: ["ELECTRICAL" as const],
      certifications: [
        "Reliable Controls Factory Authorized Dealer",
        "ABC Member",
        "AGC Member",
      ],

      dcExperience: false,
      dcClients: [],
      website: "colorado-controls.com",
      tier: "TIER_2_WATCH" as const,
      estimatedAgeRange: "55-65",
      keyPersonRisk: "HIGH",
      recurringRevenuePct: 0.15,
    },
    {
      title: "Anchor Network Solutions",
      businessName: "Anchor Network Solutions",
      description:
        "Lone Tree MSP with structured cabling capability. Managing Director: Mike Stewart. Founded 2002. Core business is managed IT services, but does cabling/fiber for Denver commercial clients. Only relevant if they spin off or de-emphasize cabling division.",
      city: "Lone Tree",
      state: "CO",
      metroArea: "Denver Metro",
      industry: "Managed IT Services / Cabling",
      established: 2002,
      revenue: 2_500_000, // Midpoint of $2-3M estimate
      employees: 10,
      primaryTrade: "GENERAL_COMMERCIAL" as const,
      secondaryTrades: ["STRUCTURED_CABLING" as const],
      certifications: [],

      dcExperience: false,
      dcClients: [],
      tier: "TIER_2_WATCH" as const,
      estimatedAgeRange: "45-55",
      keyPersonRisk: "MEDIUM",
      recurringRevenuePct: 0.40,
    },
  ];

  console.log("Seeding 5 priority acquisition targets...\n");

  for (const target of targets) {
    const {
      estimatedAgeRange,
      keyPersonRisk,
      recurringRevenuePct,
      ...listingData
    } = target;

    // Check if already exists
    const existing = await prisma.listing.findFirst({
      where: { businessName: target.businessName },
    });

    if (existing) {
      console.log(`  [skip] ${target.title} — already exists (${existing.id})`);
      continue;
    }

    // Compute fit score
    const scoreResult = computeFitScore({
      primaryTrade: listingData.primaryTrade,
      secondaryTrades: listingData.secondaryTrades as string[],
      revenue: listingData.revenue,
      established: listingData.established,
      state: listingData.state,
      metroArea: listingData.metroArea,
      certifications: listingData.certifications,
      askingPrice: null,
      ebitda: null,
      inferredEbitda: null,
      targetMultipleLow: 3.0,
      targetMultipleHigh: 5.0,
      estimatedAgeRange,
      keyPersonRisk,
      recurringRevenuePct,
    });

    // Determine thesis alignment from score
    let thesisAlignment: string;
    let recommendedAction: string;
    if (scoreResult.fitScore >= 75) {
      thesisAlignment = "strong";
      recommendedAction = "pursue_immediately";
    } else if (scoreResult.fitScore >= 60) {
      thesisAlignment = "moderate";
      recommendedAction = "research_further";
    } else if (scoreResult.fitScore >= 40) {
      thesisAlignment = "weak";
      recommendedAction = "monitor";
    } else {
      thesisAlignment = "disqualified";
      recommendedAction = "pass";
    }

    const created = await prisma.listing.create({
      data: {
        ...listingData,
        revenue: listingData.revenue,
        isManualEntry: true,
        isActive: true,
        source: "manual",
        fitScore: scoreResult.fitScore,
        compositeScore: scoreResult.fitScore, // AI score = 0 for now, so composite = deterministic
        deterministicScore: scoreResult.fitScore,
        aiScore: 0,
        thesisAlignment,
        recommendedAction,
        lastScoredAt: new Date(),
        enrichmentStatus: "pending",
      },
    });

    console.log(
      `  [created] ${target.title}`,
      `| Score: ${scoreResult.fitScore}`,
      `| Thesis: ${thesisAlignment}`,
      `| Action: ${recommendedAction}`,
      `| ID: ${created.id}`
    );
  }

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(console.error);
