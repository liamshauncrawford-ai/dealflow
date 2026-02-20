import type { Prisma } from "@prisma/client";

// Listing with all relations included
export type ListingWithSources = Prisma.ListingGetPayload<{
  include: {
    sources: true;
    tags: { include: { tag: true } };
    opportunity: true;
  };
}>;

// API response types
export interface ListingsResponse {
  listings: ListingWithSources[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ListingFilters {
  source?: "target" | "scraped";
  search?: string;
  industry?: string;
  city?: string;
  state?: string;
  metroArea?: string;
  platform?: string;
  minPrice?: number;
  maxPrice?: number;
  minEbitda?: number;
  maxEbitda?: number;
  minSde?: number;
  maxSde?: number;
  minRevenue?: number;
  maxRevenue?: number;
  showHidden?: boolean;
  showInactive?: boolean;
  hasInferredFinancials?: boolean;
  meetsThreshold?: boolean;
  // Thesis filters
  tier?: string;
  primaryTrade?: string;
  minFitScore?: number;
}

export interface ListingSortConfig {
  sortBy: string;
  sortDir: "asc" | "desc";
}

export interface CreateListingInput {
  title: string;
  businessName?: string;
  description?: string;
  askingPrice?: number;
  revenue?: number;
  ebitda?: number;
  sde?: number;
  cashFlow?: number;
  inventory?: number;
  ffe?: number;
  realEstate?: number;
  city?: string;
  state?: string;
  county?: string;
  zipCode?: string;
  metroArea?: string;
  industry?: string;
  category?: string;
  brokerName?: string;
  brokerCompany?: string;
  brokerPhone?: string;
  brokerEmail?: string;
  sellerFinancing?: boolean;
  employees?: number;
  established?: number;
  reasonForSale?: string;
  facilities?: string;
  sourceUrl?: string;
  platform?: string;
}
