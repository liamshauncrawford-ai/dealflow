import { NextRequest, NextResponse } from "next/server";
import { scanDealFolders } from "@/lib/import/file-scanner";
import { importDeals } from "@/lib/import/deal-importer";

/**
 * POST /api/import/deals
 *
 * Run the historical deal import from iCloud Drive.
 *
 * Body (optional):
 *  - folderNames: string[] — specific folders to import (all if omitted)
 *  - skipExisting: boolean — skip deals that match existing listings (default true)
 *  - runDedup: boolean — run dedup engine after import (default true)
 */

// Allow up to 5 minutes for large imports (26+ deals with PDF parsing)
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_BASE_PATH =
  "/Users/liamcrawford/Library/Mobile Documents/com~apple~CloudDocs/Acquisition Targets";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const folderNames = body.folderNames as string[] | undefined;
    const skipExisting = body.skipExisting !== false; // default true
    const runDedup = body.runDedup !== false; // default true

    const basePath = process.env.IMPORT_BASE_PATH || DEFAULT_BASE_PATH;

    // 1. Scan the folder structure
    const preview = await scanDealFolders(basePath);

    // 2. Filter to specific folders if requested
    let dealsToImport = preview.deals;
    if (folderNames && folderNames.length > 0) {
      const nameSet = new Set(folderNames.map((n) => n.toLowerCase()));
      dealsToImport = dealsToImport.filter((d) =>
        nameSet.has(d.folderName.toLowerCase())
      );

      if (dealsToImport.length === 0) {
        return NextResponse.json(
          { error: "No matching deal folders found" },
          { status: 404 }
        );
      }
    }

    // 3. Run the import
    const result = await importDeals(dealsToImport, {
      skipExisting,
      runDedup,
    });

    return NextResponse.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      details: result.details,
    });
  } catch (error) {
    console.error("Error importing deals:", error);
    return NextResponse.json(
      {
        error: "Failed to import deals",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
