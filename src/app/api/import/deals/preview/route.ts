import { NextResponse } from "next/server";
import { scanDealFolders } from "@/lib/import/file-scanner";

/**
 * GET /api/import/deals/preview
 *
 * Scan the iCloud Drive Acquisition Targets folder and return
 * a preview of what will be imported — without modifying the database.
 */

const DEFAULT_BASE_PATH =
  "/Users/liamcrawford/Library/Mobile Documents/com~apple~CloudDocs/Acquisition Targets";

export async function GET() {
  try {
    const basePath = process.env.IMPORT_BASE_PATH || DEFAULT_BASE_PATH;

    const preview = await scanDealFolders(basePath);

    return NextResponse.json({
      basePath,
      totalDeals: preview.deals.length,
      totalFiles: preview.totalFiles,
      skippedFolders: preview.skippedFolders,
      deals: preview.deals.map((deal) => ({
        folderName: deal.folderName,
        folderPath: deal.folderPath,
        fileCount: deal.files.length,
        detectedStage: deal.detectedStage,
        hasCIM: deal.hasCIM,
        hasFinancialModel: deal.hasFinancialModel,
        hasLOI: deal.hasLOI,
        hasNDA: deal.hasNDA,
        hasTaxReturns: deal.hasTaxReturns,
        hasFinancialStatements: deal.hasFinancialStatements,
        files: deal.files.map((f) => ({
          fileName: f.fileName,
          extension: f.extension,
          fileSize: f.fileSize,
          category: f.category,
        })),
      })),
    });
  } catch (error) {
    console.error("Error scanning deal folders:", error);
    return NextResponse.json(
      {
        error: "Failed to scan deal folders",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
