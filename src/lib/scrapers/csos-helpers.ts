import { getEstablishedYear, type CsosEntity } from "./csos-scraper";
import type { RawListing } from "./base-scraper";

/**
 * Convert a CSOS entity into the standard RawListing format
 * for the post-processor pipeline.
 */
export function csosEntityToRawListing(entity: CsosEntity): RawListing {
  const established = getEstablishedYear(entity.formationDate);

  return {
    sourceId: entity.entityId,
    sourceUrl: `https://www.sos.state.co.us/biz/BusinessEntityDetail.do?entityId=${entity.entityId}`,
    platform: "MANUAL",
    title: entity.entityName,
    businessName: entity.entityName,
    askingPrice: null,
    revenue: null,
    cashFlow: null,
    ebitda: null,
    sde: null,
    industry: entity.searchTerm,
    category: "CSOS Public Records",
    city: entity.city,
    state: entity.state ?? "CO",
    zipCode: null,
    description: [
      `Colorado ${entity.entityType ?? "business entity"}`,
      entity.status ? `Status: ${entity.status}` : null,
      entity.registeredAgent ? `Registered Agent: ${entity.registeredAgent}` : null,
      entity.formationDate ? `Formation Date: ${entity.formationDate}` : null,
      `Discovered via CSOS search: "${entity.searchTerm}"`,
    ].filter(Boolean).join(". "),
    brokerName: null,
    brokerCompany: null,
    brokerPhone: null,
    brokerEmail: null,
    employees: null,
    established,
    sellerFinancing: null,
    inventory: null,
    ffe: null,
    realEstate: null,
    reasonForSale: null,
    facilities: entity.principalAddress,
    listingDate: null,
    rawData: {
      source: "csos",
      entityId: entity.entityId,
      entityType: entity.entityType,
      status: entity.status,
      formationDate: entity.formationDate,
      registeredAgent: entity.registeredAgent,
      principalAddress: entity.principalAddress,
      searchTerm: entity.searchTerm,
    },
  };
}
