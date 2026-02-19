import { z } from "zod";

// ── Operator validations ──

export const operatorQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  tier: z.string().optional(),
  relationshipStatus: z.string().optional(),
  sortBy: z.string().default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const createOperatorSchema = z.object({
  name: z.string().min(1),
  parentCompany: z.string().optional(),
  hqLocation: z.string().optional(),
  hqState: z.string().optional(),
  website: z.string().optional(),
  tier: z.enum([
    "TIER_1_ACTIVE_CONSTRUCTION",
    "TIER_2_EXPANSION",
    "TIER_3_EXISTING_MAINTENANCE",
    "TIER_4_RUMORED",
  ]).optional(),
  cablingOpportunityScore: z.number().int().min(1).max(10).optional(),
  estimatedAnnualCablingRevenue: z.number().optional(),
  activeConstruction: z.boolean().optional(),
  constructionTimeline: z.string().optional(),
  phaseCount: z.number().int().optional(),
  relationshipStatus: z.enum([
    "NO_CONTACT", "IDENTIFIED", "INTRODUCTION_MADE", "MEETING_HELD",
    "RFQ_RECEIVED", "BID_SUBMITTED", "CONTRACT_AWARDED", "ACTIVE_WORK",
  ]).optional(),
  primaryContactName: z.string().optional(),
  primaryContactTitle: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal("")),
  primaryContactPhone: z.string().optional(),
  notes: z.string().optional(),
});

export const updateOperatorSchema = createOperatorSchema.partial();

// ── Facility validations ──

export const createFacilitySchema = z.object({
  operatorId: z.string().min(1),
  facilityName: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  capacityMW: z.number().optional(),
  sqft: z.number().int().optional(),
  status: z.enum(["OPERATING", "UNDER_CONSTRUCTION", "PLANNED", "RUMORED"]).optional(),
  yearOpened: z.number().int().optional(),
  yearExpectedCompletion: z.number().int().optional(),
  tierCertification: z.string().optional(),
  generalContractorId: z.string().optional(),
  estimatedCablingScopeValue: z.number().optional(),
});

export const updateFacilitySchema = createFacilitySchema.partial();

// ── GC validations ──

export const gcQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  priority: z.string().optional(),
  subQualificationStatus: z.string().optional(),
  sortBy: z.string().default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const createGCSchema = z.object({
  name: z.string().min(1),
  hqLocation: z.string().optional(),
  website: z.string().optional(),
  coloradoOffice: z.boolean().optional(),
  coloradoOfficeAddress: z.string().optional(),
  dcExperienceLevel: z.enum(["SPECIALIST", "EXPERIENCED", "SOME", "NONE"]).optional(),
  notableDCProjects: z.array(z.string()).optional(),
  nationalDCClients: z.array(z.string()).optional(),
  approvedSubList: z.boolean().optional(),
  subQualificationStatus: z.enum([
    "NOT_APPLIED", "APPLICATION_SUBMITTED", "QUALIFIED", "PREFERRED", "REJECTED",
  ]).optional(),
  prequalificationRequirements: z.string().optional(),
  relationshipStatus: z.enum([
    "NO_CONTACT", "IDENTIFIED", "INTRODUCTION_MADE", "MEETING_HELD",
    "BID_INVITED", "WORK_IN_PROGRESS",
  ]).optional(),
  primaryContactName: z.string().optional(),
  primaryContactTitle: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal("")),
  primaryContactPhone: z.string().optional(),
  notes: z.string().optional(),
  priority: z.enum(["HIGHEST", "HIGH", "MODERATE", "MONITOR"]).optional(),
  estimatedAnnualOpportunity: z.number().optional(),
});

export const updateGCSchema = createGCSchema.partial();

// ── Cabling Opportunity validations ──

export const cablingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  status: z.string().optional(),
  operatorId: z.string().optional(),
  gcId: z.string().optional(),
  sortBy: z.string().default("updatedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const createCablingSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  operatorId: z.string().optional(),
  gcId: z.string().optional(),
  facilityId: z.string().optional(),
  facilityAddress: z.string().optional(),
  facilitySizeMW: z.number().optional(),
  cablingScopes: z.array(z.enum([
    "BACKBONE_FIBER", "HORIZONTAL_COPPER", "CABLE_TRAY_PATHWAY",
    "CABINET_RACK_INSTALL", "MEET_ME_ROOM", "SECURITY_ACCESS_CONTROL",
    "CCTV_SURVEILLANCE", "ENVIRONMENTAL_MONITORING", "TESTING_CERTIFICATION", "OTHER",
  ])).optional(),
  estimatedValue: z.number().optional(),
  bidSubmittedValue: z.number().optional(),
  awardedValue: z.number().optional(),
  status: z.enum([
    "IDENTIFIED", "PRE_RFQ", "RFQ_RECEIVED", "ESTIMATING", "BID_SUBMITTED",
    "BID_UNDER_REVIEW", "AWARDED", "CONTRACT_NEGOTIATION", "MOBILIZING",
    "IN_PROGRESS", "PUNCH_LIST", "COMPLETED", "LOST", "NO_BID",
  ]).optional(),
  rfqDate: z.string().optional(),
  bidDueDate: z.string().optional(),
  constructionStart: z.string().optional(),
  constructionEnd: z.string().optional(),
  lossReason: z.string().optional(),
  competitorWhoWon: z.string().optional(),
});

export const updateCablingSchema = createCablingSchema.partial();
