import { z } from "zod";

// ─────────────────────────────────────────────
// Enum values (must match Prisma enums)
// ─────────────────────────────────────────────

const financialPeriodTypes = ["ANNUAL", "QUARTERLY", "LTM", "YTD", "PROJECTED"] as const;
const financialDataSources = ["MANUAL", "CSV_IMPORT", "AI_EXTRACTION", "CIM_PARSER"] as const;
const addBackCategories = [
  "OWNER_COMPENSATION", "PERSONAL_EXPENSES", "ONE_TIME_COSTS",
  "DISCRETIONARY", "RELATED_PARTY", "NON_CASH", "OTHER",
] as const;
const lineItemCategories = [
  "REVENUE", "COGS", "OPEX", "D_AND_A", "INTEREST",
  "TAX", "OTHER_INCOME", "OTHER_EXPENSE",
] as const;

// ─────────────────────────────────────────────
// Financial Period
// ─────────────────────────────────────────────

export const createFinancialPeriodSchema = z.object({
  periodType: z.enum(financialPeriodTypes),
  year: z.number().int().min(1990).max(2100),
  quarter: z.number().int().min(1).max(4).nullable().optional(),
  label: z.string().max(100).nullable().optional(),
  dataSource: z.enum(financialDataSources).optional(),
  sourceDocumentId: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  lineItems: z.array(z.object({
    category: z.enum(lineItemCategories),
    subcategory: z.string().max(100).nullable().optional(),
    rawLabel: z.string().min(1).max(500),
    displayOrder: z.number().int().optional(),
    amount: z.number(),
    isNegative: z.boolean().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })).optional(),
  addBacks: z.array(z.object({
    category: z.enum(addBackCategories),
    description: z.string().min(1).max(500),
    amount: z.number().min(0),
    confidence: z.number().min(0).max(1).nullable().optional(),
    includeInSde: z.boolean().optional(),
    includeInEbitda: z.boolean().optional(),
    notes: z.string().max(1000).nullable().optional(),
    sourceLabel: z.string().max(500).nullable().optional(),
  })).optional(),
});

export const updateFinancialPeriodSchema = z.object({
  label: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  isLocked: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// Line Items
// ─────────────────────────────────────────────

export const createLineItemSchema = z.object({
  category: z.enum(lineItemCategories),
  subcategory: z.string().max(100).nullable().optional(),
  rawLabel: z.string().min(1).max(500),
  displayOrder: z.number().int().optional(),
  amount: z.number(),
  isNegative: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const batchCreateLineItemsSchema = z.object({
  items: z.array(createLineItemSchema).min(1).max(100),
});

export const updateLineItemSchema = z.object({
  category: z.enum(lineItemCategories).optional(),
  subcategory: z.string().max(100).nullable().optional(),
  rawLabel: z.string().min(1).max(500).optional(),
  displayOrder: z.number().int().optional(),
  amount: z.number().optional(),
  isNegative: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// ─────────────────────────────────────────────
// Add-Backs
// ─────────────────────────────────────────────

export const createAddBackSchema = z.object({
  category: z.enum(addBackCategories),
  description: z.string().min(1).max(500),
  amount: z.number().min(0),
  confidence: z.number().min(0).max(1).nullable().optional(),
  isVerified: z.boolean().optional(),
  includeInSde: z.boolean().optional(),
  includeInEbitda: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
  sourceLabel: z.string().max(500).nullable().optional(),
});

export const updateAddBackSchema = z.object({
  category: z.enum(addBackCategories).optional(),
  description: z.string().min(1).max(500).optional(),
  amount: z.number().min(0).optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  isVerified: z.boolean().optional(),
  includeInSde: z.boolean().optional(),
  includeInEbitda: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
  sourceLabel: z.string().max(500).nullable().optional(),
});

// ─────────────────────────────────────────────
// DSCR
// ─────────────────────────────────────────────

export const dscrInputSchema = z.object({
  cashFlow: z.number().positive("Cash flow must be positive"),
  purchasePrice: z.number().positive("Purchase price must be positive"),
  equityInjectionPct: z.number().min(0).max(1),
  interestRate: z.number().min(0).max(1),
  termYears: z.number().int().min(1).max(30),
  managementSalary: z.number().min(0).optional(),
  capexReserve: z.number().min(0).optional(),
});

// ─────────────────────────────────────────────
// AI Extraction
// ─────────────────────────────────────────────

export const extractFinancialsSchema = z.object({
  documentId: z.string().min(1),
});

export const applyExtractionSchema = z.object({
  analysisId: z.string().min(1),
  selectedPeriods: z.array(z.number().int()).min(1),
});

// ─────────────────────────────────────────────
// Import
// ─────────────────────────────────────────────

export const importMappingSchema = z.object({
  periodType: z.enum(financialPeriodTypes),
  year: z.number().int().min(1990).max(2100),
  columnMapping: z.record(z.string(), z.string()),
});
