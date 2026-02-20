import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedMarketIntel() {
  console.log("Seeding market intelligence data...");

  // ── DC Operators ──

  const operators = [
    // Tier 1 — Active Construction
    {
      name: "QTS Data Centers",
      parentCompany: "Blackstone",
      hqLocation: "Overland Park, KS",
      hqState: "KS",
      website: "https://qtsdatacenters.com",
      tier: "TIER_1_ACTIVE_CONSTRUCTION",
      cablingOpportunityScore: 10,
      estimatedAnnualCablingRevenue: 5_000_000,
      activeConstruction: true,
      constructionTimeline: "Ramping over ~10 years; Phase 1 under construction",
      phaseCount: 4,
      relationshipStatus: "IDENTIFIED",
      notes: "177 MW hyperscale campus across four buildings. Will be Xcel Energy's single largest customer. Construction budget $1B+. 400-600 construction workers. Holder Construction is GC.",
    },
    {
      name: "CoreSite",
      parentCompany: "American Tower Corporation",
      hqLocation: "Denver, CO",
      hqState: "CO",
      website: "https://coresite.com",
      tier: "TIER_1_ACTIVE_CONSTRUCTION",
      cablingOpportunityScore: 9,
      estimatedAnnualCablingRevenue: 3_000_000,
      activeConstruction: true,
      constructionTimeline: "DE3 targeted for 2026; three-building campus",
      phaseCount: 3,
      relationshipStatus: "IDENTIFIED",
      notes: "HQ in Denver. DE3: 180K sqft, 18 MW. Full campus: 600K+ sqft, 60 MW. DPR Construction for new builds; Constructiv for retrofits.",
    },
    {
      name: "Flexential",
      parentCompany: null,
      hqLocation: "Centennial, CO",
      hqState: "CO",
      website: "https://flexential.com",
      tier: "TIER_1_ACTIVE_CONSTRUCTION",
      cablingOpportunityScore: 8,
      estimatedAnnualCablingRevenue: 2_000_000,
      activeConstruction: true,
      constructionTimeline: "Parker facility broke ground Q2 2025; 2026 go-live",
      phaseCount: 1,
      relationshipStatus: "IDENTIFIED",
      notes: "Parker: 249K sqft, 22.5 MW on 17 acres. Standardized 36 MW chunk builds mean repeatable cabling scope. Colorado HQ = local sub preference.",
    },
    {
      name: "Global AI / Humain",
      parentCompany: "Saudi AI Partnership",
      hqLocation: "Endicott, NY",
      hqState: "NY",
      website: null,
      tier: "TIER_1_ACTIVE_CONSTRUCTION",
      cablingOpportunityScore: 7,
      estimatedAnnualCablingRevenue: 1_000_000,
      activeConstruction: false,
      constructionTimeline: "Phase 1 operational by end 2026; up to 1 GW long-term",
      phaseCount: 1,
      relationshipStatus: "NO_CONTACT",
      notes: "438 acres near Windsor, Weld County. Phase 1: 18-24 MW. Long-term: up to 1 GW. $2B-$20B investment. No GC announced — early opportunity. Wildcard / very high potential.",
    },
    // Tier 2 — Expansion Plans
    {
      name: "Iron Mountain Data Centers",
      parentCompany: "Iron Mountain",
      hqLocation: "Boston, MA",
      hqState: "MA",
      website: "https://ironmountain.com/data-centers",
      tier: "TIER_2_EXPANSION",
      cablingOpportunityScore: 5,
      estimatedAnnualCablingRevenue: 500_000,
      activeConstruction: false,
      constructionTimeline: null,
      phaseCount: null,
      relationshipStatus: "NO_CONTACT",
      notes: "DEN-1: 180K sqft, 14.4 MW. Uptime Institute Tier III Gold certified. Steady maintenance and upgrade cabling work.",
    },
    {
      name: "STACK Infrastructure",
      parentCompany: "IPI Partners",
      hqLocation: "Denver, CO",
      hqState: "CO",
      website: "https://stackinfra.com",
      tier: "TIER_2_EXPANSION",
      cablingOpportunityScore: 4,
      estimatedAnnualCablingRevenue: 200_000,
      activeConstruction: false,
      constructionTimeline: null,
      phaseCount: null,
      relationshipStatus: "NO_CONTACT",
      notes: "HQ in Denver. Primarily building in NoVA/Chicago. Denver HQ positions for Colorado expansion. Monitor for announced builds.",
    },
    {
      name: "RadiusDC",
      parentCompany: "IPI Partners",
      hqLocation: "Denver, CO",
      hqState: "CO",
      website: "https://radiusdc.com",
      tier: "TIER_2_EXPANSION",
      cablingOpportunityScore: 6,
      estimatedAnnualCablingRevenue: 400_000,
      activeConstruction: false,
      constructionTimeline: null,
      phaseCount: null,
      relationshipStatus: "NO_CONTACT",
      notes: "1500 Champa St. 138K sqft, 10 MW potential. Active expansion/upgrades. High-profile tenants: Apple, Facebook, Disney.",
    },
    {
      name: "Novva Data Centers",
      parentCompany: null,
      hqLocation: "Salt Lake City, UT",
      hqState: "UT",
      website: "https://novva.com",
      tier: "TIER_2_EXPANSION",
      cablingOpportunityScore: 7,
      estimatedAnnualCablingRevenue: 800_000,
      activeConstruction: false,
      constructionTimeline: "Expanding from 6 MW to 30 MW",
      phaseCount: null,
      relationshipStatus: "NO_CONTACT",
      notes: "Colorado Springs campus: 37 acres, expanding from 190K sqft/6 MW to 250K+ sqft/30 MW. Geographic diversification outside Denver metro.",
    },
    {
      name: "Expedient",
      parentCompany: null,
      hqLocation: "Pittsburgh, PA",
      hqState: "PA",
      website: "https://expedient.com",
      tier: "TIER_3_EXISTING_MAINTENANCE",
      cablingOpportunityScore: 2,
      estimatedAnnualCablingRevenue: 50_000,
      activeConstruction: false,
      constructionTimeline: null,
      phaseCount: null,
      relationshipStatus: "NO_CONTACT",
      notes: "Centennial, CO. 2 MW facility. Small scale but has unused expansion space. Maintenance and tenant improvement work.",
    },
    // Tier 3 — Existing
    {
      name: "CyrusOne (KKR/GIP)",
      parentCompany: "KKR / GIP",
      hqLocation: "Dallas, TX",
      hqState: "TX",
      website: "https://cyrusone.com",
      tier: "TIER_3_EXISTING_MAINTENANCE",
      cablingOpportunityScore: 5,
      estimatedAnnualCablingRevenue: 300_000,
      activeConstruction: false,
      constructionTimeline: null,
      phaseCount: null,
      relationshipStatus: "NO_CONTACT",
      notes: "Chandler, AZ campus with National Renewable Energy Lab partnership. Monitor for Colorado expansion.",
    },
    {
      name: "Viaero Data Centers",
      parentCompany: null,
      hqLocation: "Fort Morgan, CO",
      hqState: "CO",
      website: "https://viaero.com",
      tier: "TIER_4_RUMORED",
      cablingOpportunityScore: 3,
      estimatedAnnualCablingRevenue: 100_000,
      activeConstruction: false,
      constructionTimeline: null,
      phaseCount: null,
      relationshipStatus: "NO_CONTACT",
      notes: "Regional carrier with data center services. Small scale but local Colorado presence.",
    },
  ];

  for (const op of operators) {
    await prisma.dataCenterOperator.upsert({
      where: { name: op.name },
      update: op as any,
      create: op as any,
    });
  }
  console.log(`  Seeded ${operators.length} DC operators.`);

  // ── Facilities ──

  const operatorMap = new Map<string, string>();
  const allOps = await prisma.dataCenterOperator.findMany({ select: { id: true, name: true } });
  for (const o of allOps) operatorMap.set(o.name, o.id);

  const facilities = [
    // QTS
    {
      operatorId: operatorMap.get("QTS Data Centers")!,
      facilityName: "QTS Aurora-Denver Campus",
      address: "1160 N. Gun Club Rd",
      city: "Aurora",
      state: "CO",
      latitude: 39.7086,
      longitude: -104.7109,
      capacityMW: 177,
      sqft: 500_000,
      status: "UNDER_CONSTRUCTION",
      tierCertification: "Hyperscale",
    },
    // CoreSite
    {
      operatorId: operatorMap.get("CoreSite")!,
      facilityName: "DE1 - 910 15th Street",
      address: "910 15th Street",
      city: "Denver",
      state: "CO",
      latitude: 39.7478,
      longitude: -104.9963,
      status: "OPERATING",
    },
    {
      operatorId: operatorMap.get("CoreSite")!,
      facilityName: "DE2 - 639 East 18th Avenue",
      address: "639 East 18th Avenue",
      city: "Denver",
      state: "CO",
      latitude: 39.7442,
      longitude: -104.9768,
      status: "OPERATING",
    },
    {
      operatorId: operatorMap.get("CoreSite")!,
      facilityName: "DE3 - 4900 Race Street",
      address: "4900 Race Street",
      city: "Denver",
      state: "CO",
      latitude: 39.7839,
      longitude: -104.9668,
      capacityMW: 18,
      sqft: 180_000,
      status: "UNDER_CONSTRUCTION",
      yearExpectedCompletion: 2026,
    },
    // Flexential
    {
      operatorId: operatorMap.get("Flexential")!,
      facilityName: "Parker Facility",
      city: "Parker",
      state: "CO",
      latitude: 39.5186,
      longitude: -104.7613,
      capacityMW: 22.5,
      sqft: 249_000,
      status: "UNDER_CONSTRUCTION",
      yearExpectedCompletion: 2026,
    },
    {
      operatorId: operatorMap.get("Flexential")!,
      facilityName: "Centennial Campus",
      address: "12500 East Arapahoe Rd",
      city: "Centennial",
      state: "CO",
      latitude: 39.5973,
      longitude: -104.8317,
      status: "OPERATING",
    },
    {
      operatorId: operatorMap.get("Flexential")!,
      facilityName: "Compark",
      address: "15255 Compark Blvd",
      city: "Parker",
      state: "CO",
      latitude: 39.5280,
      longitude: -104.7947,
      status: "OPERATING",
    },
    // Global AI
    {
      operatorId: operatorMap.get("Global AI / Humain")!,
      facilityName: "Windsor Campus (Phase 1)",
      city: "Windsor",
      state: "CO",
      latitude: 40.4774,
      longitude: -104.9014,
      capacityMW: 24,
      status: "PLANNED",
      yearExpectedCompletion: 2026,
    },
    // Iron Mountain
    {
      operatorId: operatorMap.get("Iron Mountain Data Centers")!,
      facilityName: "DEN-1",
      address: "4300 Brighton Blvd",
      city: "Denver",
      state: "CO",
      latitude: 39.7702,
      longitude: -104.9598,
      capacityMW: 14.4,
      sqft: 180_000,
      status: "OPERATING",
      yearOpened: 2001,
      tierCertification: "Tier III Gold (Uptime Institute)",
    },
    // RadiusDC
    {
      operatorId: operatorMap.get("RadiusDC")!,
      facilityName: "1500 Champa Street",
      address: "1500 Champa Street",
      city: "Denver",
      state: "CO",
      latitude: 39.7458,
      longitude: -104.9937,
      capacityMW: 10,
      sqft: 138_000,
      status: "OPERATING",
    },
    // Novva
    {
      operatorId: operatorMap.get("Novva Data Centers")!,
      facilityName: "Colorado Springs Campus",
      city: "Colorado Springs",
      state: "CO",
      latitude: 38.8339,
      longitude: -104.8214,
      capacityMW: 6,
      sqft: 190_000,
      status: "OPERATING",
    },
  ];

  for (const f of facilities) {
    if (!f.operatorId) continue;
    const existing = await prisma.dCFacility.findFirst({
      where: { facilityName: f.facilityName, operatorId: f.operatorId },
    });
    if (existing) {
      await prisma.dCFacility.update({ where: { id: existing.id }, data: f as any });
    } else {
      await prisma.dCFacility.create({ data: f as any });
    }
  }
  console.log(`  Seeded ${facilities.length} facilities.`);

  // ── General Contractors ──

  const gcs = [
    {
      name: "Holder Construction",
      hqLocation: "Atlanta, GA",
      website: "https://holderconstruction.com",
      coloradoOffice: true,
      dcExperienceLevel: "SPECIALIST",
      notableDCProjects: ["QTS Aurora-Denver Campus (177 MW)", "Multiple hyperscale projects nationally"],
      priority: "HIGHEST",
      subQualificationStatus: "NOT_APPLIED",
      relationshipStatus: "IDENTIFIED",
      notes: "GC for QTS Aurora campus. One of the leading data center GCs nationally. Key relationship to develop.",
    },
    {
      name: "DPR Construction",
      hqLocation: "Redwood City, CA",
      website: "https://dpr.com",
      coloradoOffice: true,
      dcExperienceLevel: "SPECIALIST",
      notableDCProjects: ["CoreSite DE3 (18 MW)", "Extensive national DC portfolio"],
      priority: "HIGHEST",
      subQualificationStatus: "NOT_APPLIED",
      relationshipStatus: "IDENTIFIED",
      notes: "GC for CoreSite DE3 new construction. Top-tier DC-focused GC with strong self-perform capabilities.",
    },
    {
      name: "Constructiv",
      hqLocation: "Denver, CO",
      website: null,
      coloradoOffice: true,
      dcExperienceLevel: "EXPERIENCED",
      notableDCProjects: ["CoreSite DE1/DE2 retrofits and upgrades"],
      priority: "HIGH",
      subQualificationStatus: "NOT_APPLIED",
      relationshipStatus: "NO_CONTACT",
      notes: "GC of Record for CoreSite ongoing retrofits/upgrades. Local Denver firm. Good entry point for ongoing maintenance cabling work.",
    },
    {
      name: "JE Dunn Construction",
      hqLocation: "Kansas City, MO",
      website: "https://jedunn.com",
      coloradoOffice: true,
      dcExperienceLevel: "EXPERIENCED",
      notableDCProjects: ["Multiple mission-critical facilities"],
      priority: "HIGH",
      subQualificationStatus: "NOT_APPLIED",
      relationshipStatus: "NO_CONTACT",
      estimatedAnnualOpportunity: 2_000_000,
      notes: "Major national GC with Denver office. Active in mission-critical/data center construction. Strong in Colorado market.",
    },
    {
      name: "Hensel Phelps",
      hqLocation: "Greeley, CO",
      website: "https://henselphelps.com",
      coloradoOffice: true,
      dcExperienceLevel: "EXPERIENCED",
      notableDCProjects: ["Various mission-critical facilities"],
      priority: "HIGH",
      subQualificationStatus: "NOT_APPLIED",
      relationshipStatus: "NO_CONTACT",
      estimatedAnnualOpportunity: 1_500_000,
      notes: "HQ in Greeley, CO. One of the largest employee-owned GCs. Strong local presence and relationships.",
    },
    {
      name: "Mortenson",
      hqLocation: "Minneapolis, MN",
      website: "https://mortenson.com",
      coloradoOffice: true,
      dcExperienceLevel: "SPECIALIST",
      notableDCProjects: ["Meta, Google, Microsoft data centers"],
      priority: "HIGHEST",
      subQualificationStatus: "NOT_APPLIED",
      relationshipStatus: "NO_CONTACT",
      estimatedAnnualOpportunity: 3_000_000,
      notes: "One of the top 3 DC GCs nationally. Denver office. Builds hyperscale for FAANG companies. Critical relationship.",
    },
    {
      name: "Swinerton",
      hqLocation: "San Francisco, CA",
      website: "https://swinerton.com",
      coloradoOffice: true,
      dcExperienceLevel: "EXPERIENCED",
      notableDCProjects: ["Various data center and mission-critical projects"],
      priority: "MODERATE",
      subQualificationStatus: "NOT_APPLIED",
      relationshipStatus: "NO_CONTACT",
      estimatedAnnualOpportunity: 1_000_000,
      notes: "Strong mission-critical/data center practice. Denver office. Growing DC portfolio.",
    },
  ];

  for (const gc of gcs) {
    await prisma.generalContractor.upsert({
      where: { name: gc.name },
      update: gc as any,
      create: gc as any,
    });
  }
  console.log(`  Seeded ${gcs.length} general contractors.`);

  // ── Cabling Opportunities ──

  const gcMap = new Map<string, string>();
  const allGCs = await prisma.generalContractor.findMany({ select: { id: true, name: true } });
  for (const g of allGCs) gcMap.set(g.name, g.id);

  // Get facility IDs
  const qtsAurora = await prisma.dCFacility.findFirst({ where: { facilityName: { contains: "QTS Aurora" } } });
  const coreSiteDE3 = await prisma.dCFacility.findFirst({ where: { facilityName: { contains: "DE3" } } });
  const flexParker = await prisma.dCFacility.findFirst({ where: { facilityName: { contains: "Parker Facility" } } });
  const novvaCOS = await prisma.dCFacility.findFirst({ where: { facilityName: { contains: "Colorado Springs" } } });

  const opportunities = [
    {
      name: "QTS Aurora Phase 1 - Backbone Fiber & Structured Cabling",
      description: "Phase 1 structured cabling for the QTS Aurora hyperscale campus. Includes backbone fiber, horizontal copper (Cat6A), cable tray/ladder rack, patch panels, and testing/certification.",
      operatorId: operatorMap.get("QTS Data Centers"),
      gcId: gcMap.get("Holder Construction"),
      facilityId: qtsAurora?.id,
      facilityAddress: "1160 N. Gun Club Rd, Aurora, CO",
      facilitySizeMW: 45,
      cablingScopes: ["BACKBONE_FIBER", "HORIZONTAL_COPPER", "CABLE_TRAY_PATHWAY", "CABINET_RACK_INSTALL", "TESTING_CERTIFICATION"],
      estimatedValue: 3_500_000,
      status: "IDENTIFIED",
    },
    {
      name: "CoreSite DE3 - Complete Structured Cabling",
      description: "Full structured cabling for CoreSite DE3 new construction. Three computer rooms at 6 MW each. Includes all low-voltage infrastructure.",
      operatorId: operatorMap.get("CoreSite"),
      gcId: gcMap.get("DPR Construction"),
      facilityId: coreSiteDE3?.id,
      facilityAddress: "4900 Race Street, Denver, CO",
      facilitySizeMW: 18,
      cablingScopes: ["BACKBONE_FIBER", "HORIZONTAL_COPPER", "CABLE_TRAY_PATHWAY", "CABINET_RACK_INSTALL", "MEET_ME_ROOM", "TESTING_CERTIFICATION"],
      estimatedValue: 2_000_000,
      status: "IDENTIFIED",
    },
    {
      name: "Flexential Parker - Cabling Infrastructure",
      description: "Structured cabling for Flexential's new Parker facility. Standardized 36 MW chunk build model. Repeatable cabling scope across future builds.",
      operatorId: operatorMap.get("Flexential"),
      facilityId: flexParker?.id,
      facilityAddress: "Parker, CO",
      facilitySizeMW: 22.5,
      cablingScopes: ["BACKBONE_FIBER", "HORIZONTAL_COPPER", "CABLE_TRAY_PATHWAY", "CABINET_RACK_INSTALL", "TESTING_CERTIFICATION"],
      estimatedValue: 1_500_000,
      status: "PRE_RFQ",
    },
    {
      name: "Novva Colorado Springs Expansion - Cabling",
      description: "Cabling for Novva's expansion from 6 MW to 30 MW. Geographic diversification outside Denver metro.",
      operatorId: operatorMap.get("Novva Data Centers"),
      facilityId: novvaCOS?.id,
      facilityAddress: "Colorado Springs, CO",
      facilitySizeMW: 30,
      cablingScopes: ["BACKBONE_FIBER", "HORIZONTAL_COPPER", "CABLE_TRAY_PATHWAY", "TESTING_CERTIFICATION"],
      estimatedValue: 1_200_000,
      status: "IDENTIFIED",
    },
  ];

  for (const opp of opportunities) {
    await prisma.cablingOpportunity.create({ data: opp as any });
  }
  console.log(`  Seeded ${opportunities.length} cabling opportunities.`);

  console.log("Market intelligence seed data complete.");
}
