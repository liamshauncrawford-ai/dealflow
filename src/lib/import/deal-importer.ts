/**
 * Deal importer — orchestrates importing historical deals from iCloud Drive.
 *
 * For each deal folder:
 *  1. Check for existing Listing by businessName (skip if exists)
 *  2. Parse Excel model → financials
 *  3. Parse CIM PDF → business details + supplementary financials
 *  4. Merge (Excel takes priority)
 *  5. Create Listing (isManualEntry: true, platform: MANUAL)
 *  6. Create ListingSource (platform: MANUAL, sourceUrl: file:// path)
 *  7. Create Opportunity (with detected stage)
 *  8. Create DealDocument records for all catalogued files
 *  9. Run financial inference if EBITDA/SDE still null
 * 10. After all imports, run dedup engine to catch overlaps
 */

import { prisma } from "@/lib/db";
import { PipelineStage, DocumentCategory, Platform } from "@prisma/client";
import { inferFinancials } from "@/lib/financial/inference-engine";
import { runDeduplication } from "@/lib/dedup/dedup-engine";
import { isDenverMetro } from "@/lib/scrapers/parser-utils";
import { DEFAULT_METRO_AREA } from "@/lib/constants";
import type { ScannedDeal, ScannedFile } from "./file-scanner";
import { parseExcelFinancials, type ExtractedFinancials } from "./excel-parser";
import { parseCIMPdf, type ExtractedCIMData } from "./pdf-parser";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  details: ImportedDealDetail[];
}

export interface ImportedDealDetail {
  folderName: string;
  status: "imported" | "skipped" | "error";
  reason?: string;
  listingId?: string;
  opportunityId?: string;
  financialSource?: string; // "excel" | "pdf" | "none"
  stage?: string;
}

interface MergedFinancials {
  askingPrice: number | null;
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  cashFlow: number | null;
  employees: number | null;
  inventory: number | null;
  ffe: number | null;
  realEstate: number | null;
  businessName: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  established: number | null;
  reasonForSale: string | null;
  financialSource: string;
}

// ─────────────────────────────────────────────
// Main import function
// ─────────────────────────────────────────────

/**
 * Import a list of scanned deals into the database.
 *
 * @param deals - Deals to import (from scanDealFolders preview)
 * @param options - Import options
 */
export async function importDeals(
  deals: ScannedDeal[],
  options: {
    /** Skip deals that already exist by business name */
    skipExisting?: boolean;
    /** Run deduplication after import */
    runDedup?: boolean;
  } = {}
): Promise<ImportResult> {
  const { skipExisting = true, runDedup = true } = options;

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  for (const deal of deals) {
    try {
      const detail = await importOneDeal(deal, skipExisting);
      result.details.push(detail);

      if (detail.status === "imported") {
        result.imported++;
      } else if (detail.status === "skipped") {
        result.skipped++;
      } else {
        result.errors.push(`${deal.folderName}: ${detail.reason}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${deal.folderName}: ${message}`);
      result.details.push({
        folderName: deal.folderName,
        status: "error",
        reason: message,
      });
    }
  }

  // Run dedup after all imports to catch overlaps with scraped listings
  if (runDedup && result.imported > 0) {
    try {
      await runDeduplication();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Dedup failed: ${message}`);
    }
  }

  // Create notification for import results
  if (result.imported > 0) {
    try {
      await prisma.notification.create({
        data: {
          type: "IMPORT",
          title: "Historical Deal Import Complete",
          message: `Imported ${result.imported} deals (${result.skipped} skipped, ${result.errors.length} errors)`,
        },
      });
    } catch {
      // Non-critical
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// Single deal import
// ─────────────────────────────────────────────

async function importOneDeal(
  deal: ScannedDeal,
  skipExisting: boolean
): Promise<ImportedDealDetail> {
  const businessName = deal.folderName;

  // Check for existing listing by business name
  if (skipExisting) {
    const existing = await prisma.listing.findFirst({
      where: {
        OR: [
          { businessName: { equals: businessName, mode: "insensitive" } },
          { title: { equals: businessName, mode: "insensitive" } },
        ],
      },
    });

    if (existing) {
      return {
        folderName: deal.folderName,
        status: "skipped",
        reason: "Listing already exists",
        listingId: existing.id,
      };
    }
  }

  // Parse financial data from files
  const merged = await extractAndMergeFinancials(deal);

  // Determine metro area
  const metroArea = isDenverMetro(merged.city) ? DEFAULT_METRO_AREA : null;

  // Determine the source URL (file:// path)
  const sourceUrl = `file://${deal.folderPath}`;

  // Create Listing + ListingSource + Opportunity + DealDocuments in a transaction
  const { listing, opportunity } = await prisma.$transaction(async (tx) => {
    // 1. Create Listing
    const newListing = await tx.listing.create({
      data: {
        title: businessName,
        businessName: merged.businessName || businessName,
        description: merged.description,
        askingPrice: merged.askingPrice,
        revenue: merged.revenue,
        ebitda: merged.ebitda,
        sde: merged.sde,
        cashFlow: merged.cashFlow,
        inventory: merged.inventory,
        ffe: merged.ffe,
        realEstate: merged.realEstate,
        employees: merged.employees,
        established: merged.established,
        reasonForSale: merged.reasonForSale,
        city: merged.city,
        state: merged.state,
        industry: merged.industry,
        metroArea,
        isManualEntry: true,
        sources: {
          create: {
            platform: Platform.MANUAL,
            sourceUrl,
            rawData: {
              importedFrom: deal.folderPath,
              financialSource: merged.financialSource,
              detectedStage: deal.detectedStage,
              fileCount: deal.files.length,
            },
            rawTitle: businessName,
            rawPrice: merged.askingPrice,
            rawRevenue: merged.revenue,
            rawCashFlow: merged.cashFlow,
          },
        },
      },
    });

    // 2. Create Opportunity with detected stage
    const stage = deal.detectedStage as PipelineStage;
    const newOpportunity = await tx.opportunity.create({
      data: {
        listingId: newListing.id,
        title: businessName,
        stage,
        priority: "MEDIUM",
        // Set key dates based on detected stage
        ...(["SIGNED_NDA", "DUE_DILIGENCE", "OFFER_SENT", "COUNTER_OFFER_RECEIVED", "UNDER_CONTRACT", "CLOSED_WON"].includes(stage)
          ? { ndaSignedAt: new Date() }
          : {}),
        ...(["REQUESTED_CIM", "SIGNED_NDA", "DUE_DILIGENCE", "OFFER_SENT", "COUNTER_OFFER_RECEIVED", "UNDER_CONTRACT", "CLOSED_WON"].includes(stage)
          ? { cimRequestedAt: new Date() }
          : {}),
        ...(["OFFER_SENT", "COUNTER_OFFER_RECEIVED", "UNDER_CONTRACT", "CLOSED_WON"].includes(stage)
          ? { offerSentAt: new Date() }
          : {}),
      },
    });

    // 3. Create DealDocument records for all files
    if (deal.files.length > 0) {
      await tx.dealDocument.createMany({
        data: deal.files.map((file: ScannedFile) => ({
          opportunityId: newOpportunity.id,
          filePath: file.filePath,
          fileName: file.fileName,
          fileType: file.extension,
          fileSize: file.fileSize || null,
          category: file.category as DocumentCategory,
        })),
      });
    }

    return { listing: newListing, opportunity: newOpportunity };
  });

  // 4. Run financial inference if EBITDA/SDE still null (outside transaction)
  if (listing.ebitda === null || listing.sde === null) {
    try {
      const inferenceResult = await inferFinancials({
        askingPrice: merged.askingPrice,
        revenue: merged.revenue,
        ebitda: merged.ebitda,
        sde: merged.sde,
        cashFlow: merged.cashFlow,
        industry: merged.industry,
        category: null,
        priceToSde: null,
        priceToEbitda: null,
      });

      if (inferenceResult) {
        await prisma.listing.update({
          where: { id: listing.id },
          data: {
            inferredEbitda: inferenceResult.inferredEbitda,
            inferredSde: inferenceResult.inferredSde,
            inferenceMethod: inferenceResult.inferenceMethod,
            inferenceConfidence: inferenceResult.inferenceConfidence,
          },
        });
      }
    } catch (err) {
      console.warn(
        `[IMPORT] Inference failed for ${businessName}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    folderName: deal.folderName,
    status: "imported",
    listingId: listing.id,
    opportunityId: opportunity.id,
    financialSource: merged.financialSource,
    stage: deal.detectedStage,
  };
}

// ─────────────────────────────────────────────
// Financial extraction & merging
// ─────────────────────────────────────────────

/**
 * Extract financial data from a deal's files and merge.
 * Excel models take priority over PDF extraction.
 */
async function extractAndMergeFinancials(
  deal: ScannedDeal
): Promise<MergedFinancials> {
  const merged: MergedFinancials = {
    askingPrice: null,
    revenue: null,
    ebitda: null,
    sde: null,
    cashFlow: null,
    employees: null,
    inventory: null,
    ffe: null,
    realEstate: null,
    businessName: null,
    description: null,
    city: null,
    state: null,
    industry: null,
    established: null,
    reasonForSale: null,
    financialSource: "none",
  };

  // 1. Try Excel models first (highest confidence)
  //    Priority: FINANCIAL_MODEL files first, then all other .xlsx files as fallback
  let excelData: ExtractedFinancials | null = null;
  const allExcelFiles = deal.files.filter(
    (f) => [".xlsx", ".xls", ".xlsm"].includes(f.extension) && !f.fileName.startsWith("~$")
  );
  const modelFiles = allExcelFiles.filter((f) => f.category === "FINANCIAL_MODEL");
  const otherExcelFiles = allExcelFiles.filter((f) => f.category !== "FINANCIAL_MODEL");
  // Try financial models first, then fall back to other xlsx files
  const excelFiles = [...modelFiles, ...otherExcelFiles];

  for (const file of excelFiles) {
    try {
      const data = parseExcelFinancials(file.filePath);
      if (data.fieldsFound.length > 0 && (!excelData || data.confidence > excelData.confidence)) {
        excelData = data;
      }
    } catch (err) {
      console.warn(
        `[IMPORT] Excel parse failed for ${file.fileName}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (excelData) {
    merged.financialSource = "excel";
    merged.askingPrice = excelData.askingPrice;
    merged.revenue = excelData.revenue;
    merged.ebitda = excelData.ebitda;
    merged.sde = excelData.sde;
    merged.cashFlow = excelData.cashFlow;
    merged.employees = excelData.employees;
    merged.inventory = excelData.inventory;
    merged.ffe = excelData.ffe;
    merged.realEstate = excelData.realEstate;
  }

  // 2. Try CIM PDFs (lower confidence, fill gaps)
  let cimData: ExtractedCIMData | null = null;
  const cimFiles = deal.files.filter(
    (f) => f.category === "CIM" && f.extension === ".pdf"
  );

  for (const file of cimFiles) {
    try {
      const data = await parseCIMPdf(file.filePath);
      if (data.fieldsFound.length > 0 && (!cimData || data.confidence > cimData.confidence)) {
        cimData = data;
      }
    } catch (err) {
      console.warn(
        `[IMPORT] PDF parse failed for ${file.fileName}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (cimData) {
    if (merged.financialSource === "none") {
      merged.financialSource = "pdf";
    }

    // Fill in gaps from PDF (Excel takes priority)
    merged.askingPrice ??= cimData.askingPrice;
    merged.revenue ??= cimData.revenue;
    merged.ebitda ??= cimData.ebitda;
    merged.sde ??= cimData.sde;
    merged.cashFlow ??= cimData.cashFlow;
    merged.employees ??= cimData.employees;
    merged.inventory ??= cimData.inventory;
    merged.ffe ??= cimData.ffe;
    merged.realEstate ??= cimData.realEstate;

    // Business details from CIM (PDF is primary for these)
    merged.businessName ??= cimData.businessName;
    merged.description ??= cimData.description;
    merged.city ??= cimData.city;
    merged.state ??= cimData.state;
    merged.industry ??= cimData.industry;
    merged.established ??= cimData.established;
    merged.reasonForSale ??= cimData.reasonForSale;
  }

  return merged;
}
