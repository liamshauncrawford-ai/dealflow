import { NextRequest, NextResponse } from "next/server";
import type { PrimaryTrade } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeFitScore, type FitScoreInput } from "@/lib/scoring/fit-score-engine";
import { requireCronOrAuth } from "@/lib/auth-helpers";

/**
 * POST /api/admin/seed
 *
 * Seeds reference data into the production database.
 * Auth: accepts EITHER CRON_SECRET (for external/CI calls) OR a valid
 * user session (for dashboard "Seed Now" button). See requireCronOrAuth().
 *
 * Idempotent — all operations use upsert with deterministic IDs.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireCronOrAuth(request);
  if (!authResult.authorized) return authResult.error;

  const results: Record<string, number> = {};

  try {
    // ── 1. Industry Multiples ──────────────────────────────────
    const industryMultiples = [
      { industry: "Construction", category: "General Contractor", sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.5, ebitdaLow: 3.0, ebitdaMedian: 4.0, ebitdaHigh: 5.5, revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.8, ebitdaMarginLow: 0.08, ebitdaMarginMedian: 0.10, ebitdaMarginHigh: 0.12, source: "BIZCOMPS / Industry Estimates" },
      { industry: "Construction", category: "HVAC", sdeLow: 2.3, sdeMedian: 2.8, sdeHigh: 3.8, ebitdaLow: 3.5, ebitdaMedian: 4.5, ebitdaHigh: 6.0, revenueLow: 0.4, revenueMedian: 0.6, revenueHigh: 0.9, ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.13, ebitdaMarginHigh: 0.15, source: "BIZCOMPS" },
      { industry: "Construction", category: "Plumbing", sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.2, ebitdaLow: 3.0, ebitdaMedian: 4.0, ebitdaHigh: 5.0, revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.8, ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.12, ebitdaMarginHigh: 0.14, source: "BIZCOMPS" },
      { industry: "Construction", category: "Electrical", sdeLow: 2.1, sdeMedian: 2.6, sdeHigh: 3.3, ebitdaLow: 3.2, ebitdaMedian: 4.2, ebitdaHigh: 5.2, revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.8, ebitdaMarginLow: 0.09, ebitdaMarginMedian: 0.11, ebitdaMarginHigh: 0.13, source: "BIZCOMPS" },
      { industry: "Construction", category: "Landscaping", sdeLow: 1.8, sdeMedian: 2.3, sdeHigh: 3.0, ebitdaLow: 2.5, ebitdaMedian: 3.5, ebitdaHigh: 4.5, revenueLow: 0.3, revenueMedian: 0.4, revenueHigh: 0.7, ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.13, ebitdaMarginHigh: 0.15, source: "BIZCOMPS" },
      { industry: "Construction", category: "Painting", sdeLow: 1.8, sdeMedian: 2.2, sdeHigh: 2.8, ebitdaLow: 2.5, ebitdaMedian: 3.5, ebitdaHigh: 4.5, revenueLow: 0.3, revenueMedian: 0.4, revenueHigh: 0.6, ebitdaMarginLow: 0.12, ebitdaMarginMedian: 0.15, ebitdaMarginHigh: 0.18, source: "BIZCOMPS" },
      { industry: "Construction", category: "Demolition", sdeLow: 2.0, sdeMedian: 2.4, sdeHigh: 3.0, ebitdaLow: 3.0, ebitdaMedian: 3.8, ebitdaHigh: 4.8, revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.7, ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.13, ebitdaMarginHigh: 0.15, source: "Industry Estimate" },
      { industry: "Transportation", category: "Moving / Logistics", sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.2, ebitdaLow: 3.0, ebitdaMedian: 4.0, ebitdaHigh: 5.0, revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.7, ebitdaMarginLow: 0.08, ebitdaMarginMedian: 0.10, ebitdaMarginHigh: 0.12, source: "BIZCOMPS" },
      { industry: "Manufacturing", category: null, sdeLow: 2.5, sdeMedian: 3.0, sdeHigh: 4.5, ebitdaLow: 3.5, ebitdaMedian: 5.0, ebitdaHigh: 7.0, revenueLow: 0.4, revenueMedian: 0.7, revenueHigh: 1.2, ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.14, ebitdaMarginHigh: 0.18, source: "First Page Sage / BIZCOMPS" },
      { industry: "Food Service", category: "Restaurant", sdeLow: 1.5, sdeMedian: 2.0, sdeHigh: 2.8, ebitdaLow: 2.5, ebitdaMedian: 3.5, ebitdaHigh: 4.5, revenueLow: 0.25, revenueMedian: 0.4, revenueHigh: 0.6, ebitdaMarginLow: 0.05, ebitdaMarginMedian: 0.08, ebitdaMarginHigh: 0.10, source: "BizBuySell" },
      { industry: "Retail", category: null, sdeLow: 1.5, sdeMedian: 2.0, sdeHigh: 2.8, ebitdaLow: 2.5, ebitdaMedian: 3.5, ebitdaHigh: 4.5, revenueLow: 0.2, revenueMedian: 0.4, revenueHigh: 0.6, ebitdaMarginLow: 0.05, ebitdaMarginMedian: 0.08, ebitdaMarginHigh: 0.10, source: "BizBuySell" },
      { industry: "Professional Services", category: null, sdeLow: 2.2, sdeMedian: 2.8, sdeHigh: 4.0, ebitdaLow: 3.5, ebitdaMedian: 4.5, ebitdaHigh: 6.5, revenueLow: 0.5, revenueMedian: 0.8, revenueHigh: 1.5, ebitdaMarginLow: 0.15, ebitdaMarginMedian: 0.20, ebitdaMarginHigh: 0.25, source: "BizBuySell" },
      { industry: "Healthcare", category: "Dental", sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.5, ebitdaLow: 3.0, ebitdaMedian: 4.0, ebitdaHigh: 5.5, revenueLow: 0.5, revenueMedian: 0.8, revenueHigh: 1.2, ebitdaMarginLow: 0.15, ebitdaMarginMedian: 0.20, ebitdaMarginHigh: 0.25, source: "BIZCOMPS" },
      { industry: "Healthcare", category: null, sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.5, ebitdaLow: 3.5, ebitdaMedian: 5.0, ebitdaHigh: 7.0, revenueLow: 0.5, revenueMedian: 0.8, revenueHigh: 1.5, ebitdaMarginLow: 0.15, ebitdaMarginMedian: 0.20, ebitdaMarginHigh: 0.25, source: "BIZCOMPS" },
      { industry: "Technology", category: "Software / SaaS", sdeLow: 3.0, sdeMedian: 3.5, sdeHigh: 5.0, ebitdaLow: 5.0, ebitdaMedian: 7.0, ebitdaHigh: 12.0, revenueLow: 1.0, revenueMedian: 2.0, revenueHigh: 5.0, ebitdaMarginLow: 0.20, ebitdaMarginMedian: 0.28, ebitdaMarginHigh: 0.35, source: "First Page Sage" },
      { industry: "Automotive", category: "Auto Repair / Service", sdeLow: 1.8, sdeMedian: 2.3, sdeHigh: 3.0, ebitdaLow: 2.5, ebitdaMedian: 3.5, ebitdaHigh: 4.5, revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.7, ebitdaMarginLow: 0.10, ebitdaMarginMedian: 0.13, ebitdaMarginHigh: 0.15, source: "BIZCOMPS" },
      { industry: "Default", category: null, sdeLow: 2.0, sdeMedian: 2.5, sdeHigh: 3.5, ebitdaLow: 3.0, ebitdaMedian: 4.0, ebitdaHigh: 5.5, revenueLow: 0.3, revenueMedian: 0.5, revenueHigh: 0.8, ebitdaMarginLow: 0.08, ebitdaMarginMedian: 0.10, ebitdaMarginHigh: 0.15, source: "Conservative Estimate" },
    ];

    for (const m of industryMultiples) {
      await prisma.industryMultiple.upsert({
        where: { industry_category: { industry: m.industry, category: m.category ?? "" } },
        update: { ...m, category: m.category ?? undefined },
        create: { ...m, category: m.category ?? undefined },
      });
    }
    results.industryMultiples = industryMultiples.length;

    // ── 2. Scrape Schedules ───────────────────────────────────
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
        create: { platform: p.platform, cronExpression: p.cron, isEnabled: false },
      });
    }
    results.scrapeSchedules = platforms.length;

    // ── 3. Thesis Target Companies ────────────────────────────
    // Helper to safely create a listing source (skip if one already exists)
    async function ensureSource(listingId: string, platform: string, sourceUrl: string) {
      const existing = await prisma.listingSource.findFirst({
        where: { listingId, platform: platform as any },
      });
      if (!existing) {
        await prisma.listingSource.create({
          data: { listingId, platform: platform as any, sourceUrl },
        });
      }
    }

    // 1. OWNED — PMS Commercial Division
    const pms = await prisma.listing.upsert({
      where: { id: "seed-pms-commercial" },
      update: { latitude: 39.7392, longitude: -104.9903 },
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
        fitScore: 0,
        latitude: 39.7392,
        longitude: -104.9903,
      },
    });
    await ensureSource(pms.id, "MANUAL", "manual://seed-pms");

    // 2. Precision Media Solutions — Commercial Division (OWNED)
    const precisionMedia = await prisma.listing.upsert({
      where: { id: "seed-precision-media" },
      update: { latitude: 39.7392, longitude: -104.9903 },
      create: {
        id: "seed-precision-media",
        title: "Precision Media Solutions - Commercial Division",
        businessName: "Precision Media Solutions - Commercial Division",
        description: "Full-service AV integration and digital signage company serving commercial, hospitality, and corporate clients across the Denver Metro area. Specializes in conference room AV, digital signage networks, and building-wide audio/video distribution.",
        city: "Denver",
        state: "CO",
        metroArea: "Denver Metro",
        industry: "Construction / Low Voltage",
        category: "AV Integration & Digital Signage",
        revenue: 2_200_000,
        employees: 12,
        established: 2015,
        isManualEntry: true,
        primaryTrade: "AV_INTEGRATION",
        secondaryTrades: ["SECURITY_SURVEILLANCE"],
        tier: "OWNED",
        website: "https://precisionmediasolutions.com",
        certifications: ["CTS Certified", "Licensed", "Bonded", "Insured"],
        bonded: true,
        insured: true,
        dcExperience: false,
        dcRelevanceScore: 5,
        targetMultipleLow: 3.0,
        targetMultipleHigh: 5.0,
        fitScore: 0,
        latitude: 39.7392,
        longitude: -104.9903,
      },
    });
    await ensureSource(precisionMedia.id, "MANUAL", "manual://seed-precision-media");

    // 2b. Precision Media — Opportunity record
    await prisma.opportunity.upsert({
      where: { id: "seed-opp-precision-media" },
      update: {},
      create: {
        id: "seed-opp-precision-media",
        title: "Precision Media Solutions — Commercial Division",
        listingId: precisionMedia.id,
        stage: "DUE_DILIGENCE",
        priority: "HIGH",
        keyPersonRisk: "LOW",
        recurringRevenuePct: 0.30,
      },
    });

    // 3. TIER 1 — SPC Communications
    const spc = await prisma.listing.upsert({
      where: { id: "seed-spc-communications" },
      update: { latitude: 39.7294, longitude: -104.8319 },
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
        latitude: 39.7294,
        longitude: -104.8319,
      },
    });
    await ensureSource(spc.id, "MANUAL", "manual://seed-spc");

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

    // 4. TIER 1 — ISI Technology
    const isi = await prisma.listing.upsert({
      where: { id: "seed-isi-technology" },
      update: { latitude: 39.7047, longitude: -105.0814 },
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
        latitude: 39.7047,
        longitude: -105.0814,
      },
    });
    await ensureSource(isi.id, "MANUAL", "manual://seed-isi");

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

    // 5. TIER 1 — Mechanical Solutions Inc
    const msi = await prisma.listing.upsert({
      where: { id: "seed-mechanical-solutions" },
      update: { latitude: 39.7392, longitude: -104.9903 },
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
        latitude: 39.7392,
        longitude: -104.9903,
      },
    });
    await ensureSource(msi.id, "MANUAL", "manual://seed-msi");

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

    // 6. TIER 2 — Colorado Controls
    const coControls = await prisma.listing.upsert({
      where: { id: "seed-colorado-controls" },
      update: { latitude: 40.5853, longitude: -105.0844 },
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
        latitude: 40.5853,
        longitude: -105.0844,
      },
    });
    await ensureSource(coControls.id, "MANUAL", "manual://seed-cocontrols");

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

    // 7. TIER 2 — Anchor Network Solutions
    const anchor = await prisma.listing.upsert({
      where: { id: "seed-anchor-network" },
      update: { latitude: 39.5372, longitude: -104.8953 },
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
        latitude: 39.5372,
        longitude: -104.8953,
      },
    });
    await ensureSource(anchor.id, "MANUAL", "manual://seed-anchor");

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
    const tier3Targets: { id: string; title: string; city: string; state: string; primaryTrade: PrimaryTrade; reason: string; employees: number; established?: number; latitude: number; longitude: number }[] = [
      { id: "seed-control-systems-inc", title: "Control Systems Inc", city: "Denver", state: "CO", primaryTrade: "BUILDING_AUTOMATION_BMS", reason: "Multi-state platform, likely PE-backed. Too large for bolt-on acquisition.", employees: 200, latitude: 39.7392, longitude: -104.9903 },
      { id: "seed-electricians-llc", title: "The Electricians LLC", city: "Colorado Springs", state: "CO", primaryTrade: "ELECTRICAL", reason: "Founded 2020, only 5 years in business. Still growing, not mature enough.", employees: 12, established: 2020, latitude: 38.8339, longitude: -104.8214 },
      { id: "seed-townsend-mechanical", title: "Townsend Mechanical", city: "Greeley", state: "CO", primaryTrade: "HVAC_CONTROLS", reason: "Residential HVAC, not commercial BMS. Wrong trade fit for data center thesis.", employees: 15, latitude: 40.4233, longitude: -104.7091 },
      { id: "seed-climate-centennial", title: "Climate Engineering / Centennial Controls", city: "Denver", state: "CO", primaryTrade: "HVAC_CONTROLS", reason: "ABM/Linc Service franchise territory. Too entangled with franchisor agreements.", employees: 40, latitude: 39.7392, longitude: -104.9903 },
      { id: "seed-ikm-building", title: "IKM Building Solutions", city: "Milwaukee", state: "WI", primaryTrade: "BUILDING_AUTOMATION_BMS", reason: "Wisconsin-based, 114 employees, EMCOR-owned. Too large and geographically wrong.", employees: 114, latitude: 43.0389, longitude: -87.9065 },
    ];

    for (const t3 of tier3Targets) {
      await prisma.listing.upsert({
        where: { id: t3.id },
        update: { latitude: t3.latitude, longitude: t3.longitude },
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
          latitude: t3.latitude,
          longitude: t3.longitude,
        },
      });
      await ensureSource(t3.id, "MANUAL", `manual://${t3.id}`);
    }

    results.thesisTargets = 7 + tier3Targets.length; // OWNED (2) + TIER_1 (3) + TIER_2 (2) + TIER_3

    // ── Compute fit scores for scorable targets ───────────────
    const scorableListings = [spc, isi, msi, coControls, anchor, pms, precisionMedia];
    const oppMap: Record<string, typeof spcOpp> = {
      [spc.id]: spcOpp,
      [isi.id]: isiOpp,
      [msi.id]: msiOpp,
      [coControls.id]: coControlsOpp,
      [anchor.id]: anchorOpp,
    };

    for (const listing of scorableListings) {
      const opp = oppMap[listing.id];
      const primaryContact = opp
        ? await prisma.contact.findFirst({
            where: { opportunityId: opp.id, isPrimary: true },
          })
        : null;

      const input: FitScoreInput = {
        primaryTrade: listing.primaryTrade,
        secondaryTrades: (listing.secondaryTrades as string[]) ?? [],
        revenue: listing.revenue ? Number(listing.revenue) : null,
        established: listing.established,
        state: listing.state,
        metroArea: listing.metroArea,
        certifications: (listing.certifications as string[]) ?? [],
        dcCertifications: (listing.dcCertifications as string[]) ?? [],
        dcRelevanceScore: listing.dcRelevanceScore,
        askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
        ebitda: listing.ebitda ? Number(listing.ebitda) : null,
        inferredEbitda: listing.inferredEbitda ? Number(listing.inferredEbitda) : null,
        targetMultipleLow: listing.targetMultipleLow,
        targetMultipleHigh: listing.targetMultipleHigh,
        estimatedAgeRange: primaryContact?.estimatedAgeRange ?? null,
        keyPersonRisk: opp?.keyPersonRisk ?? null,
        recurringRevenuePct: opp?.recurringRevenuePct ?? null,
      };

      const { fitScore } = computeFitScore(input);
      await prisma.listing.update({
        where: { id: listing.id },
        data: { fitScore },
      });
    }
    results.fitScoresComputed = scorableListings.length;

    // ── 4. Email Templates ────────────────────────────────────
    const emailTemplates = [
      {
        key: "email_template_direct_outreach",
        value: "Subject: Confidential Inquiry — [Company Name]\n\nDear [Owner Name],\n\nI hope this letter finds you well. My name is Liam Crawford, and I lead a Colorado-based investment group focused on building a premier data center and commercial technology services platform along the Front Range.\n\nYour company's reputation for quality [trade] work caught our attention, and I'm reaching out to explore whether you might be open to a conversation about your long-term plans for the business.\n\nWe are not a private equity firm looking to strip costs — we're operators who want to preserve the culture, retain the team, and invest in growth. Our model is simple: keep the people who built the business, add resources and back-office support, and create career paths for technicians.\n\nIf you've ever considered what comes next — whether that's retirement, a partner buyout, or simply having a strategic conversation — I'd welcome the chance to meet for coffee and learn more about what you've built.\n\nNo brokers, no pressure, completely confidential.\n\nBest regards,\nLiam Crawford",
      },
      {
        key: "email_template_broker_inquiry",
        value: "Subject: Buyer Registration — Colorado Low-Voltage / Data Center Trades\n\nDear [Broker Name],\n\nI am actively acquiring Colorado-based businesses in the low-voltage, structured cabling, building automation, and security integration trades. My group operates an existing platform in the Denver Metro area and we're looking to add complementary capabilities through acquisition.\n\nOur target profile:\n• Revenue: $1M – $15M\n• Location: Colorado (Front Range preferred)\n• Trades: Structured cabling, security/surveillance, BMS/HVAC controls, fire alarm, electrical\n• Structure: We can close quickly (60-90 days) with flexible deal structures\n\nI'd appreciate being added to your distribution list for relevant listings. Please feel free to contact me at your convenience to discuss any current or upcoming opportunities.\n\nBest regards,\nLiam Crawford",
      },
      {
        key: "email_template_referral_request",
        value: "Subject: Introduction Request — Colorado Data Center Trades\n\nDear [Contact Name],\n\nI hope you're doing well. I'm reaching out because of your deep connections in the Colorado [industry] community.\n\nMy group is building a platform of complementary data center and commercial technology service providers along the Front Range. We recently acquired our first company and are now looking for our next 2-3 bolt-on acquisitions.\n\nI'm specifically interested in meeting owners of:\n• Structured cabling / fiber optic companies\n• Building automation / BMS firms\n• Security and surveillance integrators\n• HVAC controls specialists\n\nIf you know of any business owners who might be thinking about succession planning or an eventual exit, I would greatly appreciate an introduction. All conversations are completely confidential.\n\nThank you for your time, and please don't hesitate to reach out if I can be of help in return.\n\nBest regards,\nLiam Crawford",
      },
    ];

    for (const template of emailTemplates) {
      await prisma.appSetting.upsert({
        where: { key: template.key },
        update: { value: template.value },
        create: { key: template.key, value: template.value },
      });
    }
    results.emailTemplates = emailTemplates.length;

    // ── 5. Search Keywords ────────────────────────────────────
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
    results.searchKeywords = primaryKeywords.length + secondaryKeywords.length;

    // ── 6. Broker Contacts ────────────────────────────────────
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
    results.brokerContacts = brokerContacts.length;

    // ── 7. Target Email Domains ───────────────────────────────
    const targetEmailDomains = [
      "structuredplus.com", "intsysinst.com", "msicolorado.com",
      "colorado-controls.com", "anchornetworksolutions.com",
      "sunbeltnetwork.com", "tworld.com", "murphybusiness.com",
      "linkbusiness.com", "bicsi.org", "ashrae.org", "abcrmc.org", "agccolorado.org",
    ];

    await prisma.appSetting.upsert({
      where: { key: "target_email_domains" },
      update: { value: JSON.stringify(targetEmailDomains) },
      create: { key: "target_email_domains", value: JSON.stringify(targetEmailDomains) },
    });
    results.targetEmailDomains = targetEmailDomains.length;

    // ── 8. DC Operators ─────────────────────────────────────
    const dcOperators = [
      { name: "QTS Data Centers", parentCompany: "Blackstone", hqLocation: "Overland Park, KS", hqState: "KS", website: "https://qtsdatacenters.com", tier: "TIER_1_ACTIVE_CONSTRUCTION", cablingOpportunityScore: 10, estimatedAnnualCablingRevenue: 5_000_000, activeConstruction: true, constructionTimeline: "Ramping over ~10 years; Phase 1 under construction", phaseCount: 4, relationshipStatus: "IDENTIFIED", notes: "177 MW hyperscale campus across four buildings. Will be Xcel Energy's single largest customer. Construction budget $1B+. Holder Construction is GC." },
      { name: "CoreSite", parentCompany: "American Tower Corporation", hqLocation: "Denver, CO", hqState: "CO", website: "https://coresite.com", tier: "TIER_1_ACTIVE_CONSTRUCTION", cablingOpportunityScore: 9, estimatedAnnualCablingRevenue: 3_000_000, activeConstruction: true, constructionTimeline: "DE3 targeted for 2026; three-building campus", phaseCount: 3, relationshipStatus: "IDENTIFIED", notes: "HQ in Denver. DE3: 180K sqft, 18 MW. Full campus: 600K+ sqft, 60 MW. DPR Construction for new builds; Constructiv for retrofits." },
      { name: "Flexential", parentCompany: null as string | null, hqLocation: "Centennial, CO", hqState: "CO", website: "https://flexential.com", tier: "TIER_1_ACTIVE_CONSTRUCTION", cablingOpportunityScore: 8, estimatedAnnualCablingRevenue: 2_000_000, activeConstruction: true, constructionTimeline: "Parker facility broke ground Q2 2025; 2026 go-live", phaseCount: 1, relationshipStatus: "IDENTIFIED", notes: "Parker: 249K sqft, 22.5 MW on 17 acres. Standardized 36 MW chunk builds mean repeatable cabling scope. Colorado HQ = local sub preference." },
      { name: "Global AI / Humain", parentCompany: "Saudi AI Partnership", hqLocation: "Endicott, NY", hqState: "NY", website: null as string | null, tier: "TIER_1_ACTIVE_CONSTRUCTION", cablingOpportunityScore: 7, estimatedAnnualCablingRevenue: 1_000_000, activeConstruction: false, constructionTimeline: "Phase 1 operational by end 2026; up to 1 GW long-term", phaseCount: 1, relationshipStatus: "NO_CONTACT", notes: "438 acres near Windsor, Weld County. Phase 1: 18-24 MW. Long-term: up to 1 GW. $2B-$20B investment. No GC announced — early opportunity." },
      { name: "Iron Mountain Data Centers", parentCompany: "Iron Mountain", hqLocation: "Boston, MA", hqState: "MA", website: "https://ironmountain.com/data-centers", tier: "TIER_2_EXPANSION", cablingOpportunityScore: 5, estimatedAnnualCablingRevenue: 500_000, activeConstruction: false, constructionTimeline: null as string | null, phaseCount: null as number | null, relationshipStatus: "NO_CONTACT", notes: "DEN-1: 180K sqft, 14.4 MW. Uptime Institute Tier III Gold certified. Steady maintenance and upgrade cabling work." },
      { name: "STACK Infrastructure", parentCompany: "IPI Partners", hqLocation: "Denver, CO", hqState: "CO", website: "https://stackinfra.com", tier: "TIER_2_EXPANSION", cablingOpportunityScore: 4, estimatedAnnualCablingRevenue: 200_000, activeConstruction: false, constructionTimeline: null as string | null, phaseCount: null as number | null, relationshipStatus: "NO_CONTACT", notes: "HQ in Denver. Primarily building in NoVA/Chicago. Denver HQ positions for Colorado expansion." },
      { name: "RadiusDC", parentCompany: "IPI Partners", hqLocation: "Denver, CO", hqState: "CO", website: "https://radiusdc.com", tier: "TIER_2_EXPANSION", cablingOpportunityScore: 6, estimatedAnnualCablingRevenue: 400_000, activeConstruction: false, constructionTimeline: null as string | null, phaseCount: null as number | null, relationshipStatus: "NO_CONTACT", notes: "1500 Champa St. 138K sqft, 10 MW potential. Active expansion/upgrades." },
      { name: "Novva Data Centers", parentCompany: null as string | null, hqLocation: "Salt Lake City, UT", hqState: "UT", website: "https://novva.com", tier: "TIER_2_EXPANSION", cablingOpportunityScore: 7, estimatedAnnualCablingRevenue: 800_000, activeConstruction: false, constructionTimeline: "Expanding from 6 MW to 30 MW", phaseCount: null as number | null, relationshipStatus: "NO_CONTACT", notes: "Colorado Springs campus: 37 acres, expanding from 190K sqft/6 MW to 250K+ sqft/30 MW." },
      { name: "Expedient", parentCompany: null as string | null, hqLocation: "Pittsburgh, PA", hqState: "PA", website: "https://expedient.com", tier: "TIER_3_EXISTING_MAINTENANCE", cablingOpportunityScore: 2, estimatedAnnualCablingRevenue: 50_000, activeConstruction: false, constructionTimeline: null as string | null, phaseCount: null as number | null, relationshipStatus: "NO_CONTACT", notes: "Centennial, CO. 2 MW facility. Small scale but has unused expansion space." },
      { name: "CyrusOne (KKR/GIP)", parentCompany: "KKR / GIP", hqLocation: "Dallas, TX", hqState: "TX", website: "https://cyrusone.com", tier: "TIER_3_EXISTING_MAINTENANCE", cablingOpportunityScore: 5, estimatedAnnualCablingRevenue: 300_000, activeConstruction: false, constructionTimeline: null as string | null, phaseCount: null as number | null, relationshipStatus: "NO_CONTACT", notes: "Chandler, AZ campus with National Renewable Energy Lab partnership. Monitor for Colorado expansion." },
      { name: "Viaero Data Centers", parentCompany: null as string | null, hqLocation: "Fort Morgan, CO", hqState: "CO", website: "https://viaero.com", tier: "TIER_4_RUMORED", cablingOpportunityScore: 3, estimatedAnnualCablingRevenue: 100_000, activeConstruction: false, constructionTimeline: null as string | null, phaseCount: null as number | null, relationshipStatus: "NO_CONTACT", notes: "Regional carrier with data center services. Small scale but local Colorado presence." },
    ];

    for (const op of dcOperators) {
      await prisma.dataCenterOperator.upsert({
        where: { name: op.name },
        update: op as any,
        create: op as any,
      });
    }
    results.dcOperators = dcOperators.length;

    // ── 9. DC Facilities ────────────────────────────────────
    // Build operator name→id map
    const operatorMap = new Map<string, string>();
    const allOps = await prisma.dataCenterOperator.findMany({ select: { id: true, name: true } });
    for (const o of allOps) operatorMap.set(o.name, o.id);

    const dcFacilities = [
      { operatorName: "QTS Data Centers", facilityName: "QTS Aurora-Denver Campus", address: "1160 N. Gun Club Rd", city: "Aurora", state: "CO", latitude: 39.7086, longitude: -104.7109, capacityMW: 177, sqft: 500_000, status: "UNDER_CONSTRUCTION", tierCertification: "Hyperscale" },
      { operatorName: "CoreSite", facilityName: "DE1 - 910 15th Street", address: "910 15th Street", city: "Denver", state: "CO", latitude: 39.7478, longitude: -104.9963, status: "OPERATING" },
      { operatorName: "CoreSite", facilityName: "DE2 - 639 East 18th Avenue", address: "639 East 18th Avenue", city: "Denver", state: "CO", latitude: 39.7442, longitude: -104.9768, status: "OPERATING" },
      { operatorName: "CoreSite", facilityName: "DE3 - 4900 Race Street", address: "4900 Race Street", city: "Denver", state: "CO", latitude: 39.7839, longitude: -104.9668, capacityMW: 18, sqft: 180_000, status: "UNDER_CONSTRUCTION", yearExpectedCompletion: 2026 },
      { operatorName: "Flexential", facilityName: "Parker Facility", city: "Parker", state: "CO", latitude: 39.5186, longitude: -104.7613, capacityMW: 22.5, sqft: 249_000, status: "UNDER_CONSTRUCTION", yearExpectedCompletion: 2026 },
      { operatorName: "Flexential", facilityName: "Centennial Campus", address: "12500 East Arapahoe Rd", city: "Centennial", state: "CO", latitude: 39.5973, longitude: -104.8317, status: "OPERATING" },
      { operatorName: "Flexential", facilityName: "Compark", address: "15255 Compark Blvd", city: "Parker", state: "CO", latitude: 39.5280, longitude: -104.7947, status: "OPERATING" },
      { operatorName: "Global AI / Humain", facilityName: "Windsor Campus (Phase 1)", city: "Windsor", state: "CO", latitude: 40.4774, longitude: -104.9014, capacityMW: 24, status: "PLANNED", yearExpectedCompletion: 2026 },
      { operatorName: "Iron Mountain Data Centers", facilityName: "DEN-1", address: "4300 Brighton Blvd", city: "Denver", state: "CO", latitude: 39.7702, longitude: -104.9598, capacityMW: 14.4, sqft: 180_000, status: "OPERATING", yearOpened: 2001, tierCertification: "Tier III Gold (Uptime Institute)" },
      { operatorName: "RadiusDC", facilityName: "1500 Champa Street", address: "1500 Champa Street", city: "Denver", state: "CO", latitude: 39.7458, longitude: -104.9937, capacityMW: 10, sqft: 138_000, status: "OPERATING" },
      { operatorName: "Novva Data Centers", facilityName: "Colorado Springs Campus", city: "Colorado Springs", state: "CO", latitude: 38.8339, longitude: -104.8214, capacityMW: 6, sqft: 190_000, status: "OPERATING" },
    ];

    for (const f of dcFacilities) {
      const opId = operatorMap.get(f.operatorName);
      if (!opId) continue;
      const { operatorName, ...facilityData } = f;
      const data = { ...facilityData, operatorId: opId };
      const existing = await prisma.dCFacility.findFirst({
        where: { facilityName: f.facilityName, operatorId: opId },
      });
      if (existing) {
        await prisma.dCFacility.update({ where: { id: existing.id }, data: data as any });
      } else {
        await prisma.dCFacility.create({ data: data as any });
      }
    }
    results.dcFacilities = dcFacilities.length;

    // ── 10. General Contractors ──────────────────────────────
    const generalContractors = [
      { name: "Holder Construction", hqLocation: "Atlanta, GA", website: "https://holderconstruction.com", coloradoOffice: true, dcExperienceLevel: "SPECIALIST", notableDCProjects: ["QTS Aurora-Denver Campus (177 MW)", "Multiple hyperscale projects nationally"], priority: "HIGHEST", subQualificationStatus: "NOT_APPLIED", relationshipStatus: "IDENTIFIED", notes: "GC for QTS Aurora campus. One of the leading data center GCs nationally." },
      { name: "DPR Construction", hqLocation: "Redwood City, CA", website: "https://dpr.com", coloradoOffice: true, dcExperienceLevel: "SPECIALIST", notableDCProjects: ["CoreSite DE3 (18 MW)", "Extensive national DC portfolio"], priority: "HIGHEST", subQualificationStatus: "NOT_APPLIED", relationshipStatus: "IDENTIFIED", notes: "GC for CoreSite DE3 new construction. Top-tier DC-focused GC." },
      { name: "Constructiv", hqLocation: "Denver, CO", website: null as string | null, coloradoOffice: true, dcExperienceLevel: "EXPERIENCED", notableDCProjects: ["CoreSite DE1/DE2 retrofits and upgrades"], priority: "HIGH", subQualificationStatus: "NOT_APPLIED", relationshipStatus: "NO_CONTACT", notes: "GC of Record for CoreSite ongoing retrofits/upgrades. Local Denver firm." },
      { name: "JE Dunn Construction", hqLocation: "Kansas City, MO", website: "https://jedunn.com", coloradoOffice: true, dcExperienceLevel: "EXPERIENCED", notableDCProjects: ["Multiple mission-critical facilities"], priority: "HIGH", subQualificationStatus: "NOT_APPLIED", relationshipStatus: "NO_CONTACT", estimatedAnnualOpportunity: 2_000_000, notes: "Major national GC with Denver office. Active in mission-critical/data center construction." },
      { name: "Hensel Phelps", hqLocation: "Greeley, CO", website: "https://henselphelps.com", coloradoOffice: true, dcExperienceLevel: "EXPERIENCED", notableDCProjects: ["Various mission-critical facilities"], priority: "HIGH", subQualificationStatus: "NOT_APPLIED", relationshipStatus: "NO_CONTACT", estimatedAnnualOpportunity: 1_500_000, notes: "HQ in Greeley, CO. One of the largest employee-owned GCs." },
      { name: "Mortenson", hqLocation: "Minneapolis, MN", website: "https://mortenson.com", coloradoOffice: true, dcExperienceLevel: "SPECIALIST", notableDCProjects: ["Meta, Google, Microsoft data centers"], priority: "HIGHEST", subQualificationStatus: "NOT_APPLIED", relationshipStatus: "NO_CONTACT", estimatedAnnualOpportunity: 3_000_000, notes: "One of the top 3 DC GCs nationally. Denver office. Builds hyperscale for FAANG companies." },
      { name: "Swinerton", hqLocation: "San Francisco, CA", website: "https://swinerton.com", coloradoOffice: true, dcExperienceLevel: "EXPERIENCED", notableDCProjects: ["Various data center and mission-critical projects"], priority: "MODERATE", subQualificationStatus: "NOT_APPLIED", relationshipStatus: "NO_CONTACT", estimatedAnnualOpportunity: 1_000_000, notes: "Strong mission-critical/data center practice. Denver office." },
    ];

    for (const gc of generalContractors) {
      await prisma.generalContractor.upsert({
        where: { name: gc.name },
        update: gc as any,
        create: gc as any,
      });
    }
    results.generalContractors = generalContractors.length;

    return NextResponse.json({
      success: true,
      message: "Reference data seeded successfully",
      results,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seed failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/seed
 *
 * Returns current counts of seeded reference data.
 */
export async function GET() {
  try {
    const [
      industryMultiples,
      scrapeSchedules,
      thesisListings,
      opportunities,
      contacts,
      emailTemplates,
      keywords,
      dcOperators,
      dcFacilities,
      generalContractors,
    ] = await Promise.all([
      prisma.industryMultiple.count(),
      prisma.scrapeSchedule.count(),
      prisma.listing.count({ where: { isManualEntry: true } }),
      prisma.opportunity.count(),
      prisma.contact.count(),
      prisma.appSetting.count({ where: { key: { startsWith: "email_template_" } } }),
      prisma.appSetting.count({ where: { key: { startsWith: "search_keywords_" } } }),
      prisma.dataCenterOperator.count(),
      prisma.dCFacility.count(),
      prisma.generalContractor.count(),
    ]);

    return NextResponse.json({
      counts: {
        industryMultiples,
        scrapeSchedules,
        thesisListings,
        opportunities,
        contacts,
        emailTemplates,
        keywords,
        dcOperators,
        dcFacilities,
        generalContractors,
      },
    });
  } catch (error) {
    console.error("Seed count error:", error);
    return NextResponse.json(
      { error: "Failed to fetch counts" },
      { status: 500 },
    );
  }
}
