/**
 * File scanner for the Acquisition Targets iCloud Drive folder.
 *
 * Scans the folder structure, identifies deal folders (vs utility folders),
 * catalogs files by type and category, and detects the pipeline stage
 * for each deal based on the files present.
 */

import fs from "fs/promises";
import path from "path";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ScannedDeal {
  folderName: string;
  folderPath: string;
  files: ScannedFile[];
  detectedStage: string; // PipelineStage enum value
  hasCIM: boolean;
  hasFinancialModel: boolean;
  hasLOI: boolean;
  hasNDA: boolean;
  hasTaxReturns: boolean;
  hasFinancialStatements: boolean;
}

export interface ScannedFile {
  fileName: string;
  filePath: string;
  extension: string;
  fileSize: number;
  category: string; // DocumentCategory enum value
}

export interface ScanPreview {
  deals: ScannedDeal[];
  skippedFolders: string[];
  totalFiles: number;
}

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

/** Folders to skip (not deals) */
const SKIP_FOLDERS = new Set([
  "Acquisition Template",
  "App Development",
  "NDAs",
  "NDA",
  "LOI Materials",
  "Proof of Funds",
  ".DS_Store",
]);

/** File extensions we care about */
const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".xlsx",
  ".xls",
  ".xlsm",
  ".xltx",
  ".docx",
  ".doc",
  ".csv",
  ".pptx",
  ".ppt",
  ".html",
  ".md",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".heic",
  ".zip",
]);

// ─────────────────────────────────────────────
// Main scanner
// ─────────────────────────────────────────────

/**
 * Scan the Acquisition Targets folder and return a preview
 * of what will be imported.
 */
export async function scanDealFolders(
  basePath: string
): Promise<ScanPreview> {
  const deals: ScannedDeal[] = [];
  const skippedFolders: string[] = [];
  let totalFiles = 0;

  // Read top-level directory
  const entries = await fs.readdir(basePath, { withFileTypes: true });

  for (const entry of entries) {
    // Skip non-directories and hidden files
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    // Skip utility folders
    if (SKIP_FOLDERS.has(entry.name)) {
      skippedFolders.push(entry.name);
      continue;
    }

    const folderPath = path.join(basePath, entry.name);

    // Recursively scan for files
    const files = await scanFilesRecursive(folderPath);
    totalFiles += files.length;

    if (files.length === 0) {
      skippedFolders.push(entry.name + " (empty)");
      continue;
    }

    // Detect stage and features
    const hasCIM = files.some((f) => f.category === "CIM");
    const hasFinancialModel = files.some(
      (f) => f.category === "FINANCIAL_MODEL"
    );
    const hasLOI = files.some((f) => f.category === "LOI");
    const hasNDA = files.some((f) => f.category === "NDA");
    const hasTaxReturns = files.some((f) => f.category === "TAX_RETURN");
    const hasFinancialStatements = files.some(
      (f) => f.category === "FINANCIAL_STATEMENT"
    );

    const detectedStage = detectStage(files, {
      hasLOI,
      hasNDA,
      hasCIM,
      hasFinancialModel,
    });

    deals.push({
      folderName: entry.name,
      folderPath,
      files,
      detectedStage,
      hasCIM,
      hasFinancialModel,
      hasLOI,
      hasNDA,
      hasTaxReturns,
      hasFinancialStatements,
    });
  }

  // Sort by folder name
  deals.sort((a, b) => a.folderName.localeCompare(b.folderName));

  return { deals, skippedFolders, totalFiles };
}

// ─────────────────────────────────────────────
// Recursive file scanner
// ─────────────────────────────────────────────

async function scanFilesRecursive(
  dirPath: string
): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    // Permission denied or other error
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectories
      const subFiles = await scanFilesRecursive(fullPath);
      results.push(...subFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!DOCUMENT_EXTENSIONS.has(ext)) continue;

      let fileSize = 0;
      try {
        const stat = await fs.stat(fullPath);
        fileSize = stat.size;
      } catch {
        // Skip files we can't stat
      }

      results.push({
        fileName: entry.name,
        filePath: fullPath,
        extension: ext,
        fileSize,
        category: categorizeFile(entry.name),
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// Stage detection
// ─────────────────────────────────────────────

interface StageFlags {
  hasLOI: boolean;
  hasNDA: boolean;
  hasCIM: boolean;
  hasFinancialModel: boolean;
}

/**
 * Detect the pipeline stage based on which files are present.
 * Uses a heuristic based on the deal lifecycle:
 * LOI > NDA > CIM > Financial Model > Default
 */
function detectStage(files: ScannedFile[], flags: StageFlags): string {
  const fileNames = files.map((f) => f.fileName.toLowerCase());
  const allText = fileNames.join(" ");

  // Check for LOI presence -> OFFER_SENT
  if (
    flags.hasLOI ||
    allText.includes("loi") ||
    allText.includes("letter of intent") ||
    allText.includes("final offer")
  ) {
    return "OFFER_SENT";
  }

  // Check for deal room or due diligence materials -> DUE_DILIGENCE
  if (
    allText.includes("deal room") ||
    allText.includes("due diligence") ||
    allText.includes("dd ")
  ) {
    return "DUE_DILIGENCE";
  }

  // Check for NDA presence -> SIGNED_NDA
  if (
    flags.hasNDA ||
    allText.includes("nda") ||
    allText.includes("confidentiality")
  ) {
    return "SIGNED_NDA";
  }

  // Check for CIM or financial documents -> REQUESTED_CIM
  if (
    flags.hasCIM ||
    allText.includes("cim") ||
    allText.includes("confidential information") ||
    allText.includes("confidential business review") ||
    allText.includes("exec summary") ||
    allText.includes("executive summary")
  ) {
    return "REQUESTED_CIM";
  }

  // Check for financial model -> INTERESTED
  if (
    flags.hasFinancialModel ||
    allText.includes("crawford acquisition") ||
    allText.includes("valuation") ||
    allText.includes("acquisition model")
  ) {
    return "INTERESTED";
  }

  // Default
  return "CONTACTING";
}

// ─────────────────────────────────────────────
// File categorization
// ─────────────────────────────────────────────

/**
 * Categorize a file based on its name into a DocumentCategory enum value.
 */
export function categorizeFile(fileName: string): string {
  const lower = fileName.toLowerCase();

  // CIM / Executive Summary
  if (
    lower.includes("cim") ||
    lower.includes("confidential information") ||
    lower.includes("confidential business review") ||
    lower.includes("cbr") ||
    lower.includes("exec summary") ||
    lower.includes("executive summary") ||
    lower.includes("teaser") ||
    lower.includes("business introductory")
  ) {
    return "CIM";
  }

  // Financial models
  if (
    lower.includes("crawford acquisition") ||
    lower.includes("acquisition model") ||
    lower.includes("acquisition template") ||
    lower.includes("valuation overview") ||
    lower.includes("m&a valuation") ||
    lower.includes("irr") ||
    (lower.includes("acquisition") && lower.endsWith(".xlsx"))
  ) {
    return "FINANCIAL_MODEL";
  }

  // Financial statements
  if (
    lower.includes("p&l") ||
    lower.includes("profit and loss") ||
    lower.includes("balance sheet") ||
    lower.includes("income statement") ||
    lower.includes("cash flow analysis") ||
    lower.includes("financial statement") ||
    lower.includes("aged ar") ||
    lower.includes("accounts receivable") ||
    lower.includes("wip") ||
    lower.includes("work in progress") ||
    lower.includes("backlog")
  ) {
    return "FINANCIAL_STATEMENT";
  }

  // Tax returns
  if (lower.includes("tax return") || lower.includes("tax ")) {
    return "TAX_RETURN";
  }

  // LOI
  if (
    lower.includes("loi") ||
    lower.includes("letter of intent") ||
    lower.includes("offer")
  ) {
    return "LOI";
  }

  // NDA
  if (
    lower.includes("nda") ||
    lower.includes("confidentiality agreement") ||
    lower.includes("non-disclosure") ||
    lower.includes("nondisclosure")
  ) {
    return "NDA";
  }

  // Valuation
  if (
    lower.includes("valuation") ||
    lower.includes("bizcomps") ||
    lower.includes("industry financial profile") ||
    lower.includes("industry report") ||
    lower.includes("comps")
  ) {
    return "VALUATION";
  }

  return "OTHER";
}
