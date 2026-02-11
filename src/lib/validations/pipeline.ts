import { z } from "zod";

// ─────────────────────────────────────────────
// Enum values (must match Prisma enums)
// ─────────────────────────────────────────────

const pipelineStages = [
  "CONTACTING", "REQUESTED_CIM", "SIGNED_NDA",
  "DUE_DILIGENCE", "OFFER_SENT", "COUNTER_OFFER_RECEIVED",
  "UNDER_CONTRACT", "CLOSED_WON", "CLOSED_LOST", "ON_HOLD",
] as const;

const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const contactInterestLevels = ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;

const revenueTrends = ["GROWING", "STABLE", "DECLINING"] as const;
const integrationComplexities = ["LOW", "MEDIUM", "HIGH"] as const;
const keyPersonRisks = ["LOW", "MEDIUM", "HIGH"] as const;
const outreachStatuses = [
  "NOT_CONTACTED", "COLD_OUTREACH_SENT", "WARM_INTRO_MADE",
  "IN_DIALOGUE", "LOI_STAGE", "DUE_DILIGENCE", "CLOSED", "DEAD",
] as const;
const contactSentiments = [
  "COLD", "LUKEWARM", "WARM", "HOT", "ENGAGED", "COMMITTED",
] as const;

// ─────────────────────────────────────────────
// Pipeline / Opportunity
// ─────────────────────────────────────────────

export const pipelineQuerySchema = z.object({
  stage: z.enum(pipelineStages).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const createOpportunitySchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).nullable().optional(),
  listingId: z.string().nullable().optional(),
  stage: z.enum(pipelineStages).default("CONTACTING"),
  priority: z.enum(priorities).default("MEDIUM"),
});

const optionalDateString = z.string().datetime({ offset: true }).nullable().optional()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional());

export const updateOpportunitySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  stage: z.enum(pipelineStages).optional(),
  stageNote: z.string().max(1000).optional(),
  priority: z.enum(priorities).optional(),
  offerPrice: z.number().min(0).nullable().optional(),
  offerTerms: z.string().max(5000).nullable().optional(),
  contactedAt: optionalDateString,
  cimRequestedAt: optionalDateString,
  ndaSignedAt: optionalDateString,
  offerSentAt: optionalDateString,
  underContractAt: optionalDateString,
  closedAt: optionalDateString,
  // New fields (Phase 2)
  lostReason: z.string().max(1000).nullable().optional(),
  lostCategory: z.string().max(100).nullable().optional(),
  winProbability: z.number().min(0).max(1).nullable().optional(),
  dealValue: z.number().min(0).nullable().optional(),
  // Thesis deal fields
  actualRevenue: z.number().min(0).nullable().optional(),
  actualEbitda: z.number().nullable().optional(),
  actualEbitdaMargin: z.number().min(0).max(1).nullable().optional(),
  revenueTrend: z.enum(revenueTrends).nullable().optional(),
  recurringRevenuePct: z.number().min(0).max(1).nullable().optional(),
  customerConcentration: z.number().min(0).max(1).nullable().optional(),
  backlog: z.number().min(0).nullable().optional(),
  offeredMultiple: z.number().min(0).nullable().optional(),
  dealStructure: z.string().max(5000).nullable().optional(),
  synergyEstimate: z.number().min(0).nullable().optional(),
  integrationComplexity: z.enum(integrationComplexities).nullable().optional(),
  keyPersonRisk: z.enum(keyPersonRisks).nullable().optional(),
  certificationTransferRisk: z.string().max(5000).nullable().optional(),
  customerRetentionRisk: z.string().max(5000).nullable().optional(),
  loiDate: optionalDateString,
  dueDiligenceStart: optionalDateString,
  targetCloseDate: optionalDateString,
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" },
);

// ─────────────────────────────────────────────
// Stage History
// ─────────────────────────────────────────────

export const createStageHistorySchema = z.object({
  fromStage: z.enum(pipelineStages),
  toStage: z.enum(pipelineStages),
  note: z.string().max(1000).nullable().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
});

export const updateStageHistorySchema = z.object({
  note: z.string().max(1000).nullable().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
});

// ─────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────

export const createNoteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(10000),
});

// ─────────────────────────────────────────────
// Email Linking
// ─────────────────────────────────────────────

export const linkEmailSchema = z.object({
  emailId: z.string().min(1, "emailId is required"),
});

// ─────────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────────

export const createContactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email().max(320).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  role: z.string().max(200).nullable().optional(),
  interestLevel: z.enum(contactInterestLevels).default("UNKNOWN"),
  isPrimary: z.boolean().default(false),
  notes: z.string().max(5000).nullable().optional(),
  // Thesis contact fields
  linkedinUrl: z.string().max(500).nullable().optional(),
  estimatedAgeRange: z.string().max(50).nullable().optional(),
  yearsInIndustry: z.number().int().min(0).nullable().optional(),
  yearsAtCompany: z.number().int().min(0).nullable().optional(),
  foundedCompany: z.boolean().nullable().optional(),
  ownershipPct: z.number().min(0).max(1).nullable().optional(),
  hasPartner: z.boolean().nullable().optional(),
  partnerName: z.string().max(200).nullable().optional(),
  hasSuccessor: z.boolean().nullable().optional(),
  successorName: z.string().max(200).nullable().optional(),
  familyBusiness: z.boolean().nullable().optional(),
  education: z.string().max(500).nullable().optional(),
  priorEmployers: z.array(z.string().max(200)).optional(),
  outreachStatus: z.enum(outreachStatuses).nullable().optional(),
  sentiment: z.enum(contactSentiments).nullable().optional(),
  nextFollowUpDate: z.string().datetime({ offset: true }).nullable().optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional()),
});

export const updateContactSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  role: z.string().max(200).nullable().optional(),
  interestLevel: z.enum(contactInterestLevels).optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().max(5000).nullable().optional(),
  // Thesis contact fields
  linkedinUrl: z.string().max(500).nullable().optional(),
  estimatedAgeRange: z.string().max(50).nullable().optional(),
  yearsInIndustry: z.number().int().min(0).nullable().optional(),
  yearsAtCompany: z.number().int().min(0).nullable().optional(),
  foundedCompany: z.boolean().nullable().optional(),
  ownershipPct: z.number().min(0).max(1).nullable().optional(),
  hasPartner: z.boolean().nullable().optional(),
  partnerName: z.string().max(200).nullable().optional(),
  hasSuccessor: z.boolean().nullable().optional(),
  successorName: z.string().max(200).nullable().optional(),
  familyBusiness: z.boolean().nullable().optional(),
  education: z.string().max(500).nullable().optional(),
  priorEmployers: z.array(z.string().max(200)).optional(),
  outreachStatus: z.enum(outreachStatuses).nullable().optional(),
  sentiment: z.enum(contactSentiments).nullable().optional(),
  nextFollowUpDate: z.string().datetime({ offset: true }).nullable().optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional()),
});

// ─────────────────────────────────────────────
// Promote Listing to Pipeline
// ─────────────────────────────────────────────

const contactInPromoteSchema = z.object({
  name: z.string().min(1),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  interestLevel: z.enum(contactInterestLevels).optional(),
});

export const promoteToOpportunitySchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  stage: z.enum(pipelineStages).default("CONTACTING"),
  priority: z.enum(priorities).default("MEDIUM"),
  offerPrice: z.number().min(0).nullable().optional(),
  offerTerms: z.string().max(5000).nullable().optional(),
  contacts: z.array(contactInPromoteSchema).max(20).optional(),
});
