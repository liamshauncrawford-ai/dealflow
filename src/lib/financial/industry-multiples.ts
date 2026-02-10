import type { IndustryMultiple } from "@prisma/client";
import { prisma } from "@/lib/db";

// ─────────────────────────────────────────────
// Module-level cache with 30-minute TTL
// ─────────────────────────────────────────────

interface CacheEntry {
  data: IndustryMultiple | null;
  cachedAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const multiplesCache = new Map<string, CacheEntry>();

/** Build a deterministic cache key from industry + category. */
function cacheKey(industry: string | null, category: string | null): string {
  return `${(industry ?? "").toLowerCase().trim()}::${(category ?? "").toLowerCase().trim()}`;
}

/** Evict entries older than CACHE_TTL_MS. */
function pruneCache(): void {
  const now = Date.now();
  for (const [key, entry] of multiplesCache) {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      multiplesCache.delete(key);
    }
  }
}

// Schedule cache pruning every 30 minutes.
// Using setInterval here is safe because this is a long-lived server module.
if (typeof setInterval !== "undefined") {
  setInterval(pruneCache, CACHE_TTL_MS);
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Look up industry multiples using a cascading fallback strategy:
 *
 *  1. Exact match on (industry, category)
 *  2. Match on industry alone (any category)
 *  3. Fall back to the "Default" industry row
 *
 * Results are cached in a module-level Map that is pruned every 30 minutes.
 */
export async function getMultiplesForIndustry(
  industry: string | null,
  category: string | null,
): Promise<IndustryMultiple | null> {
  // Check cache first
  const key = cacheKey(industry, category);
  const cached = multiplesCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  let result: IndustryMultiple | null = null;

  // Strategy 1: exact match on industry + category
  if (industry && category) {
    result = await prisma.industryMultiple.findFirst({
      where: {
        industry: { equals: industry, mode: "insensitive" },
        category: { equals: category, mode: "insensitive" },
      },
    });
  }

  // Strategy 2: match on industry alone (any category)
  if (!result && industry) {
    result = await prisma.industryMultiple.findFirst({
      where: {
        industry: { equals: industry, mode: "insensitive" },
      },
    });
  }

  // Strategy 3: fall back to the "Default" industry row
  if (!result) {
    result = await prisma.industryMultiple.findFirst({
      where: {
        industry: { equals: "Default", mode: "insensitive" },
      },
    });
  }

  // Store in cache (even if null, to avoid repeated DB misses)
  multiplesCache.set(key, { data: result, cachedAt: Date.now() });

  return result;
}
