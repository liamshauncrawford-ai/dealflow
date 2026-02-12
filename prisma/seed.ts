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

  // ─── Thesis Target Companies ───────────────────────────────
  console.log("Seeding thesis target companies...");

  // Helper to compute fit score
  const { computeFitScore } = await import("../src/lib/scoring/fit-score-engine");

  // 1. OWNED — PMS Commercial Division
  const pms = await prisma.listing.upsert({
    where: { id: "seed-pms-commercial" },
    update: {},
    create: {
      id: "seed-pms-commercial",
      title: "PMS Commercial Division",
      businessName: "PMS Commercial Division",
      description: "Existing platform company. Security, surveillance, and AV integration for commercial and data center clients across the Denver Metro area.",
      city: "Denver",
      state: "CO",
      metroArea: "Denver Metro",
      industry: "Construction / Low Voltage",
      category: "Security & AV Integration",
      revenue: 1_400_000,
      employees: 7,
      established: 2018,
      isManualEntry: true,
      primaryTrade: "SECURITY_SURVEILLANCE",
      secondaryTrades: ["AV_INTEGRATION"],
      tier: "OWNED",
      website: "https://pmscommercial.com",
      certifications: ["Licensed", "Bonded", "Insured"],
      bonded: true,
      insured: true,
      dcExperience: true,
      dcRelevanceScore: 8,
      targetMultipleLow: 3.0,
      targetMultipleHigh: 5.0,
      fitScore: 0, // Will compute below
      sources: { create: { platform: "MANUAL", sourceUrl: "manual://seed-pms" } },
    },
  });

  // 2. TIER 1 — SPC Communications
  const spc = await prisma.listing.upsert({
    where: { id: "seed-spc-communications" },
    update: {},
    create: {
      id: "seed-spc-communications",
      title: "SPC Communications",
      businessName: "SPC Communications LLC",
      description: "Full-service structured cabling contractor specializing in data center infrastructure, campus fiber optics, and commercial low-voltage systems. Established reputation in Denver Metro serving enterprise and government clients.",
      city: "Aurora",
      state: "CO",
      metroArea: "Denver Metro",
      industry: "Construction / Low Voltage",
      category: "Structured Cabling",
      revenue: 5_000_000,
      revenueSource: "BBB / Estimate",
      revenueConfidence: "ESTIMATED",
      employees: 30,
      established: 1993,
      isManualEntry: true,
      primaryTrade: "STRUCTURED_CABLING",
      secondaryTrades: ["SECURITY_SURVEILLANCE"],
      tier: "TIER_1_ACTIVE",
      website: "https://spccommunications.com",
      certifications: ["MBE/WBE", "GSA Schedule", "BiCSI RCDD", "BBB A+"],
      dcCertifications: ["BiCSI RCDD"],
      bonded: true,
      insured: true,
      dcExperience: true,
      dcRelevanceScore: 9,
      targetMultipleLow: 3.0,
      targetMultipleHigh: 5.0,
      sources: { create: { platform: "MANUAL", sourceUrl: "manual://seed-spc" } },
    },
  });

  // Create opportunity for SPC
  const spcOpp = await prisma.opportunity.upsert({
    where: { id: "seed-opp-spc" },
    update: {},
    create: {
      id: "seed-opp-spc",
      title: "SPC Communications Acquisition",
      listingId: spc.id,
      stage: "CONTACTING",
      priority: "HIGH",
      keyPersonRisk: "HIGH",
      recurringRevenuePct: 0.15,
    },
  });

  await prisma.contact.upsert({
    where: { id: "seed-contact-spc-kenny" },
    update: {},
    create: {
      id: "seed-contact-spc-kenny",
      opportunityId: spcOpp.id,
      name: "Kenny Som",
      role: "President / Founder",
      isPrimary: true,
      estimatedAgeRange: "55-70",
      yearsInIndustry: 30,
      foundedCompany: true,
      ownershipPct: 1.0,
      hasSuccessor: false,
      familyBusiness: false,
      outreachStatus: "NOT_CONTACTED",
      sentiment: "COLD",
    },
  });
  await prisma.contact.upsert({
    where: { id: "seed-contact-spc-sue" },
    update: {},
    create: {
      id: "seed-contact-spc-sue",
      opportunityId: spcOpp.id,
      name: "Sue Tran",
      role: "Office Manager",
      isPrimary: false,
    },
  });

  // 3. TIER 1 — ISI Technology
  const isi = await prisma.listing.upsert({
    where: { id: "seed-isi-technology" },
    update: {},
    create: {
      id: "seed-isi-technology",
      title: "ISI Technology",
      businessName: "ISI Technology Inc",
      description: "Structured cabling and security integration firm in Lakewood, CO. Dual-owner partnership with complementary skills (sales/ops and project management). Serves commercial, government, and data center clients.",
      city: "Lakewood",
      state: "CO",
      metroArea: "Denver Metro",
      industry: "Construction / Low Voltage",
      category: "Structured Cabling & Security",
      revenue: 6_000_000,
      revenueSource: "RocketReach / Estimate",
      revenueConfidence: "ESTIMATED",
      employees: 25,
      established: 1996,
      isManualEntry: true,
      primaryTrade: "STRUCTURED_CABLING",
      secondaryTrades: ["SECURITY_SURVEILLANCE"],
      tier: "TIER_1_ACTIVE",
      website: "https://isitechnology.com",
      certifications: ["BBB A+"],
      bonded: true,
      insured: true,
      dcExperience: true,
      dcRelevanceScore: 8,
      targetMultipleLow: 3.5,
      targetMultipleHigh: 5.0,
      sources: { create: { platform: "MANUAL", sourceUrl: "manual://seed-isi" } },
    },
  });

  const isiOpp = await prisma.opportunity.upsert({
    where: { id: "seed-opp-isi" },
    update: {},
    create: {
      id: "seed-opp-isi",
      title: "ISI Technology Acquisition",
      listingId: isi.id,
      stage: "CONTACTING",
      priority: "HIGH",
      keyPersonRisk: "MEDIUM",
      recurringRevenuePct: 0.10,
    },
  });

  await prisma.contact.upsert({
    where: { id: "seed-contact-isi-marty" },
    update: {},
    create: {
      id: "seed-contact-isi-marty",
      opportunityId: isiOpp.id,
      name: "Marty Wedel",
      role: "President / Co-Founder",
      isPrimary: true,
      estimatedAgeRange: "55-65",
      yearsInIndustry: 28,
      foundedCompany: true,
      ownershipPct: 0.5,
      hasPartner: true,
      partnerName: "Walter Tew",
      hasSuccessor: false,
      familyBusiness: false,
      outreachStatus: "NOT_CONTACTED",
      sentiment: "COLD",
    },
  });
  await prisma.contact.upsert({
    where: { id: "seed-contact-isi-walter" },
    update: {},
    create: {
      id: "seed-contact-isi-walter",
      opportunityId: isiOpp.id,
      name: "Walter Tew",
      role: "Partner / Project Manager",
      isPrimary: false,
      ownershipPct: 0.5,
      hasPartner: true,
      partnerName: "Marty Wedel",
    },
  });

  // 4. TIER 1 — Mechanical Solutions Inc
  const msi = await prisma.listing.upsert({
    where: { id: "seed-mechanical-solutions" },
    update: {},
    create: {
      id: "seed-mechanical-solutions",
      title: "Mechanical Solutions Inc",
      businessName: "Mechanical Solutions Inc",
      description: "Building automation and HVAC controls specialist. Distech Controls factory authorized dealer. Serves commercial buildings, hospitals, and data centers in the Denver Metro area. Deep technical expertise in BMS integration.",
      city: "Denver",
      state: "CO",
      metroArea: "Denver Metro",
      industry: "Construction / HVAC & Controls",
      category: "Building Automation / BMS",
      revenue: 5_000_000,
      revenueSource: "Industry Estimate",
      revenueConfidence: "ESTIMATED",
      employees: 20,
      established: 1998,
      isManualEntry: true,
      primaryTrade: "BUILDING_AUTOMATION_BMS",
      secondaryTrades: ["HVAC_CONTROLS"],
      tier: "TIER_1_ACTIVE",
      website: "https://msicontrols.com",
      certifications: ["Distech Controls Factory Certified", "Licensed", "Bonded"],
      dcCertifications: ["BMS Integration"],
      bonded: true,
      insured: true,
      dcExperience: true,
      dcRelevanceScore: 9,
      targetMultipleLow: 3.0,
      targetMultipleHigh: 5.0,
      sources: { create: { platform: "MANUAL", sourceUrl: "manual://seed-msi" } },
    },
  });

  const msiOpp = await prisma.opportunity.upsert({
    where: { id: "seed-opp-msi" },
    update: {},
    create: {
      id: "seed-opp-msi",
      title: "Mechanical Solutions Acquisition",
      listingId: msi.id,
      stage: "CONTACTING",
      priority: "HIGH",
      keyPersonRisk: "MEDIUM",
      recurringRevenuePct: 0.25,
    },
  });

  await prisma.contact.upsert({
    where: { id: "seed-contact-msi-john" },
    update: {},
    create: {
      id: "seed-contact-msi-john",
      opportunityId: msiOpp.id,
      name: "John (President)",
      role: "President / Co-Founder",
      isPrimary: true,
      estimatedAgeRange: "65-75",
      yearsInIndustry: 40,
      foundedCompany: true,
      ownershipPct: 0.5,
      hasPartner: true,
      partnerName: "Al (CFO)",
      hasSuccessor: false,
      familyBusiness: false,
      outreachStatus: "NOT_CONTACTED",
      sentiment: "COLD",
    },
  });
  await prisma.contact.upsert({
    where: { id: "seed-contact-msi-al" },
    update: {},
    create: {
      id: "seed-contact-msi-al",
      opportunityId: msiOpp.id,
      name: "Al (CFO)",
      role: "CFO / Co-Founder / CPA",
      isPrimary: false,
      estimatedAgeRange: "60-70",
      yearsInIndustry: 30,
      foundedCompany: true,
      ownershipPct: 0.5,
      education: "CPA",
    },
  });

  // 5. TIER 2 — Colorado Controls
  const coControls = await prisma.listing.upsert({
    where: { id: "seed-colorado-controls" },
    update: {},
    create: {
      id: "seed-colorado-controls",
      title: "Colorado Controls",
      businessName: "Colorado Controls LLC",
      description: "Building automation and HVAC controls company in Fort Collins. Reliable Controls factory authorized dealer. Small team with deep technical expertise in commercial BMS systems.",
      city: "Fort Collins",
      state: "CO",
      metroArea: "Front Range",
      industry: "Construction / HVAC & Controls",
      category: "Building Automation / BMS",
      revenue: 2_000_000,
      revenueSource: "Industry Estimate",
      revenueConfidence: "ESTIMATED",
      employees: 8,
      established: 2013,
      isManualEntry: true,
      primaryTrade: "BUILDING_AUTOMATION_BMS",
      secondaryTrades: ["HVAC_CONTROLS"],
      tier: "TIER_2_WATCH",
      certifications: ["Reliable Controls Factory Authorized", "ABC Member", "AGC Member"],
      bonded: true,
      insured: true,
      dcExperience: false,
      dcRelevanceScore: 6,
      targetMultipleLow: 3.0,
      targetMultipleHigh: 4.0,
      sources: { create: { platform: "MANUAL", sourceUrl: "manual://seed-cocontrols" } },
    },
  });

  const coControlsOpp = await prisma.opportunity.upsert({
    where: { id: "seed-opp-cocontrols" },
    update: {},
    create: {
      id: "seed-opp-cocontrols",
      title: "Colorado Controls Acquisition",
      listingId: coControls.id,
      stage: "CONTACTING",
      priority: "MEDIUM",
      keyPersonRisk: "HIGH",
      recurringRevenuePct: 0.20,
    },
  });

  await prisma.contact.upsert({
    where: { id: "seed-contact-cocontrols-founder" },
    update: {},
    create: {
      id: "seed-contact-cocontrols-founder",
      opportunityId: coControlsOpp.id,
      name: "Founder (Unknown Name)",
      role: "Founder / Owner",
      isPrimary: true,
      estimatedAgeRange: "55-65",
      yearsInIndustry: 40,
      foundedCompany: true,
      ownershipPct: 1.0,
      hasSuccessor: false,
      outreachStatus: "NOT_CONTACTED",
      sentiment: "COLD",
    },
  });

  // 6. TIER 2 — Anchor Network Solutions
  const anchor = await prisma.listing.upsert({
    where: { id: "seed-anchor-network" },
    update: {},
    create: {
      id: "seed-anchor-network",
      title: "Anchor Network Solutions",
      businessName: "Anchor Network Solutions Inc",
      description: "Managed IT services and structured cabling company in Lone Tree, CO. Serves small-to-medium businesses with IT infrastructure, cabling, and network management.",
      city: "Lone Tree",
      state: "CO",
      metroArea: "Denver Metro",
      industry: "Construction / IT Services",
      category: "Managed IT & Cabling",
      revenue: 3_000_000,
      revenueSource: "Industry Estimate",
      revenueConfidence: "ESTIMATED",
      employees: 15,
      established: 2002,
      isManualEntry: true,
      primaryTrade: "MANAGED_IT_SERVICES",
      secondaryTrades: ["STRUCTURED_CABLING"],
      tier: "TIER_2_WATCH",
      bonded: true,
      insured: true,
      dcExperience: false,
      dcRelevanceScore: 5,
      targetMultipleLow: 3.0,
      targetMultipleHigh: 4.5,
      sources: { create: { platform: "MANUAL", sourceUrl: "manual://seed-anchor" } },
    },
  });

  const anchorOpp = await prisma.opportunity.upsert({
    where: { id: "seed-opp-anchor" },
    update: {},
    create: {
      id: "seed-opp-anchor",
      title: "Anchor Network Solutions Acquisition",
      listingId: anchor.id,
      stage: "CONTACTING",
      priority: "MEDIUM",
      keyPersonRisk: "MEDIUM",
    },
  });

  await prisma.contact.upsert({
    where: { id: "seed-contact-anchor-mike" },
    update: {},
    create: {
      id: "seed-contact-anchor-mike",
      opportunityId: anchorOpp.id,
      name: "Mike Stewart",
      role: "Managing Director",
      isPrimary: true,
      outreachStatus: "NOT_CONTACTED",
      sentiment: "COLD",
    },
  });

  // TIER 3 (Disqualified) — Listings only
  const tier3Targets = [
    {
      id: "seed-control-systems-inc",
      title: "Control Systems Inc",
      city: "Denver",
      state: "CO",
      primaryTrade: "BUILDING_AUTOMATION_BMS" as const,
      reason: "Multi-state platform, likely PE-backed. Too large for bolt-on acquisition.",
      employees: 200,
    },
    {
      id: "seed-electricians-llc",
      title: "The Electricians LLC",
      city: "Colorado Springs",
      state: "CO",
      primaryTrade: "ELECTRICAL" as const,
      reason: "Founded 2020, only 5 years in business. Still growing, not mature enough.",
      established: 2020,
      employees: 12,
    },
    {
      id: "seed-townsend-mechanical",
      title: "Townsend Mechanical",
      city: "Greeley",
      state: "CO",
      primaryTrade: "HVAC_CONTROLS" as const,
      reason: "Residential HVAC, not commercial BMS. Wrong trade fit for data center thesis.",
      employees: 15,
    },
    {
      id: "seed-climate-centennial",
      title: "Climate Engineering / Centennial Controls",
      city: "Denver",
      state: "CO",
      primaryTrade: "HVAC_CONTROLS" as const,
      reason: "ABM/Linc Service franchise territory. Too entangled with franchisor agreements.",
      employees: 40,
    },
    {
      id: "seed-ikm-building",
      title: "IKM Building Solutions",
      city: "Milwaukee",
      state: "WI",
      primaryTrade: "BUILDING_AUTOMATION_BMS" as const,
      reason: "Wisconsin-based, 114 employees, EMCOR-owned. Too large and geographically wrong.",
      employees: 114,
    },
  ];

  for (const t3 of tier3Targets) {
    await prisma.listing.upsert({
      where: { id: t3.id },
      update: {},
      create: {
        id: t3.id,
        title: t3.title,
        businessName: t3.title,
        city: t3.city,
        state: t3.state,
        industry: "Construction / Low Voltage",
        isManualEntry: true,
        primaryTrade: t3.primaryTrade,
        tier: "TIER_3_DISQUALIFIED",
        disqualificationReason: t3.reason,
        employees: t3.employees,
        established: t3.established,
        dcRelevanceScore: 3,
        sources: { create: { platform: "MANUAL", sourceUrl: `manual://${t3.id}` } },
      },
    });
  }

  // Compute fit scores for Tier 1 & Tier 2 targets
  const scorableListings = [spc, isi, msi, coControls, anchor, pms];
  const oppMap: Record<string, typeof spcOpp> = {
    [spc.id]: spcOpp,
    [isi.id]: isiOpp,
    [msi.id]: msiOpp,
    [coControls.id]: coControlsOpp,
    [anchor.id]: anchorOpp,
  };

  for (const listing of scorableListings) {
    const opp = oppMap[listing.id];
    // Get primary contact for owner age scoring
    const primaryContact = opp
      ? await prisma.contact.findFirst({
          where: { opportunityId: opp.id, isPrimary: true },
        })
      : null;

    const { fitScore } = computeFitScore({
      primaryTrade: listing.primaryTrade,
      secondaryTrades: listing.secondaryTrades as string[],
      revenue: listing.revenue ? Number(listing.revenue) : null,
      established: listing.established,
      state: listing.state,
      metroArea: listing.metroArea,
      certifications: listing.certifications as string[],
      dcCertifications: listing.dcCertifications as string[],
      dcRelevanceScore: listing.dcRelevanceScore,
      askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
      ebitda: listing.ebitda ? Number(listing.ebitda) : null,
      inferredEbitda: listing.inferredEbitda ? Number(listing.inferredEbitda) : null,
      targetMultipleLow: listing.targetMultipleLow,
      targetMultipleHigh: listing.targetMultipleHigh,
      estimatedAgeRange: primaryContact?.estimatedAgeRange ?? null,
      keyPersonRisk: opp?.keyPersonRisk ?? null,
      recurringRevenuePct: opp?.recurringRevenuePct ?? null,
    });

    await prisma.listing.update({
      where: { id: listing.id },
      data: { fitScore },
    });
    console.log(`  ${listing.title}: fitScore = ${fitScore}`);
  }

  // Seed email templates as AppSettings
  const emailTemplates = [
    {
      key: "email_template_direct_outreach",
      value: `Subject: Confidential Inquiry — [Company Name]

Dear [Owner Name],

I hope this letter finds you well. My name is Liam Crawford, and I lead a Colorado-based investment group focused on building a premier data center and commercial technology services platform along the Front Range.

Your company's reputation for quality [trade] work caught our attention, and I'm reaching out to explore whether you might be open to a conversation about your long-term plans for the business.

We are not a private equity firm looking to strip costs — we're operators who want to preserve the culture, retain the team, and invest in growth. Our model is simple: keep the people who built the business, add resources and back-office support, and create career paths for technicians.

If you've ever considered what comes next — whether that's retirement, a partner buyout, or simply having a strategic conversation — I'd welcome the chance to meet for coffee and learn more about what you've built.

No brokers, no pressure, completely confidential.

Best regards,
Liam Crawford`,
    },
    {
      key: "email_template_broker_inquiry",
      value: `Subject: Buyer Registration — Colorado Low-Voltage / Data Center Trades

Dear [Broker Name],

I am actively acquiring Colorado-based businesses in the low-voltage, structured cabling, building automation, and security integration trades. My group operates an existing platform in the Denver Metro area and we're looking to add complementary capabilities through acquisition.

Our target profile:
• Revenue: $1M – $15M
• Location: Colorado (Front Range preferred)
• Trades: Structured cabling, security/surveillance, BMS/HVAC controls, fire alarm, electrical
• Structure: We can close quickly (60-90 days) with flexible deal structures

I'd appreciate being added to your distribution list for relevant listings. Please feel free to contact me at your convenience to discuss any current or upcoming opportunities.

Best regards,
Liam Crawford`,
    },
    {
      key: "email_template_referral_request",
      value: `Subject: Introduction Request — Colorado Data Center Trades

Dear [Contact Name],

I hope you're doing well. I'm reaching out because of your deep connections in the Colorado [industry] community.

My group is building a platform of complementary data center and commercial technology service providers along the Front Range. We recently acquired our first company and are now looking for our next 2-3 bolt-on acquisitions.

I'm specifically interested in meeting owners of:
• Structured cabling / fiber optic companies
• Building automation / BMS firms
• Security and surveillance integrators
• HVAC controls specialists

If you know of any business owners who might be thinking about succession planning or an eventual exit, I would greatly appreciate an introduction. All conversations are completely confidential.

Thank you for your time, and please don't hesitate to reach out if I can be of help in return.

Best regards,
Liam Crawford`,
    },
  ];

  for (const template of emailTemplates) {
    await prisma.appSetting.upsert({
      where: { key: template.key },
      update: { value: template.value },
      create: { key: template.key, value: template.value },
    });
  }

  console.log(`Seeded ${emailTemplates.length} email templates.`);

  // Seed keyword search sets
  const primaryKeywords = [
    '"structured cabling" AND (Colorado OR Denver OR "Front Range")',
    '"low voltage contractor" AND (Colorado OR Denver)',
    '"low voltage" AND (Colorado OR Denver) AND ("for sale" OR "acquisition" OR "business opportunity")',
    '"building automation" AND (Colorado OR Denver)',
    '"BAS controls" AND (Colorado OR Denver)',
    '"security systems installer" AND (Colorado OR Denver)',
    '"security integrator" AND (Colorado OR Denver)',
    '"fire alarm contractor" AND (Colorado OR Denver)',
    '"HVAC controls" AND (Colorado OR Denver)',
    '"access control" AND contractor AND (Colorado OR Denver)',
    '"electrical contractor" AND (Denver OR Colorado) AND ("for sale" OR "retirement" OR "succession")',
  ];

  const secondaryKeywords = [
    '"telecommunications contractor" AND Colorado',
    '"IT services" AND Colorado AND ("for sale" OR "acquisition")',
    '"data cabling" AND Colorado',
    '"fiber optic" AND contractor AND Colorado',
    '"surveillance" AND installer AND Colorado',
    '"network infrastructure" AND (Colorado OR Denver)',
    '"AV integrator" AND (Colorado OR Denver)',
    '"building controls" AND (Colorado OR Denver)',
    '"BMS" AND contractor AND Colorado',
    '"Distech" OR "Reliable Controls" OR "Tridium" OR "Niagara" AND Colorado',
    '"energy management" AND HVAC AND Colorado AND ("for sale" OR "business")',
  ];

  await prisma.appSetting.upsert({
    where: { key: "search_keywords_primary" },
    update: { value: JSON.stringify(primaryKeywords) },
    create: { key: "search_keywords_primary", value: JSON.stringify(primaryKeywords) },
  });

  await prisma.appSetting.upsert({
    where: { key: "search_keywords_secondary" },
    update: { value: JSON.stringify(secondaryKeywords) },
    create: { key: "search_keywords_secondary", value: JSON.stringify(secondaryKeywords) },
  });

  console.log(`Seeded ${primaryKeywords.length} primary keywords and ${secondaryKeywords.length} secondary keywords.`);

  // Seed broker contacts
  const brokerContacts = [
    { name: "Sunbelt Business Brokers", office: "Denver", specialty: "General lower middle market", registered: false },
    { name: "Transworld Business Advisors", office: "Multiple CO locations", specialty: "Franchise + independent businesses", registered: false },
    { name: "Murphy Business Sales", office: "Colorado", specialty: "Construction/trades specialty", registered: false },
    { name: "LINK Business Brokers", office: "National", specialty: "International network with CO deals", registered: false },
  ];

  await prisma.appSetting.upsert({
    where: { key: "broker_contacts" },
    update: { value: JSON.stringify(brokerContacts) },
    create: { key: "broker_contacts", value: JSON.stringify(brokerContacts) },
  });

  console.log(`Seeded ${brokerContacts.length} broker contacts.`);

  // Seed target email domains
  const targetEmailDomains = [
    "structuredplus.com",
    "intsysinst.com",
    "msicolorado.com",
    "colorado-controls.com",
    "anchornetworksolutions.com",
    "sunbeltnetwork.com",
    "tworld.com",
    "murphybusiness.com",
    "linkbusiness.com",
    "bicsi.org",
    "ashrae.org",
    "abcrmc.org",
    "agccolorado.org",
  ];

  await prisma.appSetting.upsert({
    where: { key: "target_email_domains" },
    update: { value: JSON.stringify(targetEmailDomains) },
    create: { key: "target_email_domains", value: JSON.stringify(targetEmailDomains) },
  });

  console.log(`Seeded ${targetEmailDomains.length} target email domains.`);
  console.log("Thesis seed data complete.");
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
