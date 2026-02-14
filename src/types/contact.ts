import type { Prisma } from "@prisma/client";

export type ContactWithOpportunity = Prisma.ContactGetPayload<{
  include: {
    opportunity: {
      select: {
        id: true;
        title: true;
        stage: true;
        priority: true;
      };
    };
  };
}>;

export interface ContactsPageResponse {
  contacts: ContactWithOpportunity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContactFilters {
  search?: string;
  interestLevel?: string;
  outreachStatus?: string;
  sentiment?: string;
  dealStage?: string;
  overdueOnly?: boolean;
}
