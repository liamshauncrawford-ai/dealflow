/**
 * Centralized lifecycle manager for AI analysis results.
 *
 * Provides cache-aware generation (24h default), keep-latest-only semantics,
 * in-place editing (PATCH), and deletion for all AIAnalysisResult-based features.
 */
import { prisma } from "@/lib/db";
import type { AIAnalysisResult } from "@prisma/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface EntityKey {
  opportunityId?: string;
  listingId?: string;
  documentId?: string;
}

interface GenerateOpts extends EntityKey {
  analysisType: string;
  cacheHours?: number; // default 24
  generateFn: () => Promise<{
    resultData: unknown;
    inputTokens?: number;
    outputTokens?: number;
    modelUsed?: string;
  }>;
}

// ─────────────────────────────────────────────
// Get Latest
// ─────────────────────────────────────────────

export async function getLatestAnalysis(
  opts: EntityKey & { analysisType: string },
): Promise<AIAnalysisResult | null> {
  const where: Record<string, unknown> = { analysisType: opts.analysisType };
  if (opts.opportunityId) where.opportunityId = opts.opportunityId;
  if (opts.listingId) where.listingId = opts.listingId;
  if (opts.documentId) where.documentId = opts.documentId;

  return prisma.aIAnalysisResult.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
}

// ─────────────────────────────────────────────
// Generate (cache-aware, keep-latest-only)
// ─────────────────────────────────────────────

export async function generateAnalysis(
  opts: GenerateOpts,
): Promise<{ result: AIAnalysisResult; cached: boolean }> {
  const cacheMs = (opts.cacheHours ?? 24) * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - cacheMs);

  const where: Record<string, unknown> = { analysisType: opts.analysisType };
  if (opts.opportunityId) where.opportunityId = opts.opportunityId;
  if (opts.listingId) where.listingId = opts.listingId;
  if (opts.documentId) where.documentId = opts.documentId;

  // Check cache
  const cached = await prisma.aIAnalysisResult.findFirst({
    where: { ...where, createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
  });

  if (cached) {
    return { result: cached, cached: true };
  }

  // Generate new result
  const generated = await opts.generateFn();

  // Delete ALL previous results for this entity+type (keep-latest-only)
  await prisma.aIAnalysisResult.deleteMany({ where });

  // Insert new result
  const result = await prisma.aIAnalysisResult.create({
    data: {
      analysisType: opts.analysisType,
      resultData: generated.resultData as object,
      modelUsed: generated.modelUsed ?? "unknown",
      inputTokens: generated.inputTokens ?? 0,
      outputTokens: generated.outputTokens ?? 0,
      ...(opts.opportunityId ? { opportunityId: opts.opportunityId } : {}),
      ...(opts.listingId ? { listingId: opts.listingId } : {}),
      ...(opts.documentId ? { documentId: opts.documentId } : {}),
    },
  });

  return { result, cached: false };
}

// ─────────────────────────────────────────────
// Edit (PATCH resultData)
// ─────────────────────────────────────────────

export async function editAnalysis(
  analysisId: string,
  updates: Record<string, unknown>,
): Promise<AIAnalysisResult> {
  return prisma.aIAnalysisResult.update({
    where: { id: analysisId },
    data: { resultData: updates as object },
  });
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────

export async function deleteAnalysis(analysisId: string): Promise<void> {
  await prisma.aIAnalysisResult.delete({ where: { id: analysisId } });
}
