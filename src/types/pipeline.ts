import type { Prisma } from "@prisma/client";

export type OpportunityWithRelations = Prisma.OpportunityGetPayload<{
  include: {
    listing: {
      include: {
        sources: true;
      };
    };
    notes: true;
    emails: {
      include: {
        email: true;
      };
    };
    stageHistory: true;
    tags: { include: { tag: true } };
    documents: true;
  };
}>;

export interface IndustryMultiplesData {
  id: string;
  industry: string;
  category: string | null;
  sdeLow: number | null;
  sdeMedian: number | null;
  sdeHigh: number | null;
  ebitdaLow: number | null;
  ebitdaMedian: number | null;
  ebitdaHigh: number | null;
  revenueLow: number | null;
  revenueMedian: number | null;
  revenueHigh: number | null;
  ebitdaMarginLow: number | null;
  ebitdaMarginMedian: number | null;
  ebitdaMarginHigh: number | null;
  source: string | null;
}

export interface PipelineResponse {
  opportunities: OpportunityWithRelations[];
  total: number;
}

export interface CreateOpportunityInput {
  title: string;
  description?: string;
  listingId?: string;
  stage?: string;
  priority?: string;
}

export interface UpdateOpportunityInput {
  stage?: string;
  priority?: string;
  title?: string;
  description?: string;
  offerPrice?: number;
  offerTerms?: string;
  contactedAt?: string;
  cimRequestedAt?: string;
  ndaSignedAt?: string;
  offerSentAt?: string;
  underContractAt?: string;
}
