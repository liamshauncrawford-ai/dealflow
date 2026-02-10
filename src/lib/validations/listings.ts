import { z } from "zod";

// ─────────────────────────────────────────────
// Enum values
// ─────────────────────────────────────────────

const platforms = [
  "BIZBUYSELL", "BIZQUEST", "DEALSTREAM", "TRANSWORLD",
  "LOOPNET", "BUSINESSBROKER", "MANUAL",
] as const;

const validSortFields = [
  "title", "askingPrice", "revenue", "ebitda", "sde", "cashFlow",
  "inferredEbitda", "inferredSde", "city", "state", "industry",
  "brokerName", "brokerCompany", "employees", "established",
  "firstSeenAt", "lastSeenAt", "listingDate", "createdAt",
] as const;

// ─────────────────────────────────────────────
// Listing Query (GET /api/listings)
// ─────────────────────────────────────────────

export const listingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(validSortFields).default("lastSeenAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  metroArea: z.string().optional(),
  platform: z.enum(platforms).optional(),
  showHidden: z.coerce.boolean().default(false),
  showInactive: z.coerce.boolean().default(false),
  meetsThreshold: z.coerce.boolean().default(true),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minEbitda: z.coerce.number().min(0).optional(),
  maxEbitda: z.coerce.number().min(0).optional(),
  minSde: z.coerce.number().min(0).optional(),
  maxSde: z.coerce.number().min(0).optional(),
  minRevenue: z.coerce.number().min(0).optional(),
  maxRevenue: z.coerce.number().min(0).optional(),
});

// ─────────────────────────────────────────────
// Create Listing (POST /api/listings)
// ─────────────────────────────────────────────

export const createListingSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  businessName: z.string().max(500).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  askingPrice: z.number().min(0).nullable().optional(),
  revenue: z.number().min(0).nullable().optional(),
  ebitda: z.number().nullable().optional(),
  sde: z.number().nullable().optional(),
  cashFlow: z.number().nullable().optional(),
  inventory: z.number().min(0).nullable().optional(),
  ffe: z.number().min(0).nullable().optional(),
  realEstate: z.number().min(0).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  county: z.string().max(200).nullable().optional(),
  zipCode: z.string().max(20).nullable().optional(),
  metroArea: z.string().max(200).nullable().optional(),
  industry: z.string().max(200).nullable().optional(),
  category: z.string().max(200).nullable().optional(),
  brokerName: z.string().max(200).nullable().optional(),
  brokerCompany: z.string().max(200).nullable().optional(),
  brokerPhone: z.string().max(50).nullable().optional(),
  brokerEmail: z.string().email().max(320).nullable().optional(),
  sellerFinancing: z.boolean().nullable().optional(),
  employees: z.number().int().min(0).nullable().optional(),
  established: z.number().int().nullable().optional(),
  reasonForSale: z.string().max(5000).nullable().optional(),
  facilities: z.string().max(5000).nullable().optional(),
  sourceUrl: z.string().url().max(2000).optional(),
  platform: z.enum(platforms).optional(),
});

// ─────────────────────────────────────────────
// Update Listing (PATCH /api/listings/[id])
// ─────────────────────────────────────────────

export const updateListingSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  businessName: z.string().max(500).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  askingPrice: z.number().min(0).nullable().optional(),
  revenue: z.number().min(0).nullable().optional(),
  ebitda: z.number().nullable().optional(),
  sde: z.number().nullable().optional(),
  cashFlow: z.number().nullable().optional(),
  inventory: z.number().min(0).nullable().optional(),
  ffe: z.number().min(0).nullable().optional(),
  realEstate: z.number().min(0).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  county: z.string().max(200).nullable().optional(),
  zipCode: z.string().max(20).nullable().optional(),
  metroArea: z.string().max(200).nullable().optional(),
  industry: z.string().max(200).nullable().optional(),
  category: z.string().max(200).nullable().optional(),
  subcategory: z.string().max(200).nullable().optional(),
  naicsCode: z.string().max(20).nullable().optional(),
  brokerName: z.string().max(200).nullable().optional(),
  brokerCompany: z.string().max(200).nullable().optional(),
  brokerPhone: z.string().max(50).nullable().optional(),
  brokerEmail: z.string().email().max(320).nullable().optional(),
  sellerFinancing: z.boolean().nullable().optional(),
  employees: z.number().int().min(0).nullable().optional(),
  established: z.number().int().nullable().optional(),
  reasonForSale: z.string().max(5000).nullable().optional(),
  facilities: z.string().max(5000).nullable().optional(),
  isHidden: z.boolean().optional(),
  isActive: z.boolean().optional(),
  inferredEbitda: z.number().nullable().optional(),
  inferredSde: z.number().nullable().optional(),
  inferenceMethod: z.string().max(100).nullable().optional(),
  inferenceConfidence: z.number().min(0).max(1).nullable().optional(),
});

// ─────────────────────────────────────────────
// Dedup
// ─────────────────────────────────────────────

const dedupStatuses = ["PENDING", "CONFIRMED_DUPLICATE", "NOT_DUPLICATE", "MERGED"] as const;

export const dedupQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(dedupStatuses).optional(),
});

export const resolveDedupSchema = z.object({
  status: z.enum(["CONFIRMED_DUPLICATE", "NOT_DUPLICATE"]),
  primaryListingId: z.string().optional(),
});

// ─────────────────────────────────────────────
// Email Messages Query
// ─────────────────────────────────────────────

export const emailMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  opportunityId: z.string().optional(),
});

// ─────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});
