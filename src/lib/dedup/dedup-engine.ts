import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface DedupCandidate {
  listingId1: string;
  listingId2: string;
  score: number;
  matchedFields: string[];
}

interface DedupResult {
  candidatesFound: number;
  groupsCreated: number;
  errors: string[];
}

/** Lightweight listing shape used for in-memory scoring. */
interface ListingRecord {
  id: string;
  title: string;
  businessName: string | null;
  askingPrice: number | null;
  revenue: number | null;
  cashFlow: number | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  industry: string | null;
  brokerName: string | null;
  description: string | null;
  platform: string | null;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Minimum overall score for a pair to be recorded as a candidate. */
const CANDIDATE_THRESHOLD = 0.50;

/** Score at or above which auto-merge is triggered. */
const AUTO_MERGE_THRESHOLD = 0.85;

/** Blocking: price must be within this fraction to form a block. */
const PRICE_BLOCK_TOLERANCE = 0.10;

/** Blocking: minimum number of common title words. */
const TITLE_WORD_OVERLAP_MIN = 3;

/** Scoring: price fields considered matching if within this tolerance. */
const PRICE_SCORE_TOLERANCE = 0.05;

/** Scoring: revenue / cashFlow fields considered matching if within this tolerance. */
const REVENUE_SCORE_TOLERANCE = 0.10;

/** Bonus applied when two listings come from different data sources. */
const CROSS_SOURCE_BONUS = 0.10;

/** Business name suffixes to strip for normalized comparison. */
const BUSINESS_SUFFIXES = /\b(llc|inc|corp|co|ltd|company|incorporated|corporation|limited|enterprises?|services?|solutions?|group|holdings?)\b/gi;

/**
 * Normalize a business name for comparison by stripping legal suffixes,
 * punctuation, and extra whitespace.
 */
function normalizeBusinessName(name: string): string {
  return name
    .replace(BUSINESS_SUFFIXES, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Common words to skip when computing title word overlap for blocking. */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "in", "of", "to", "on", "at",
  "is", "it", "by", "with", "from", "as", "this", "that", "are", "was",
  "be", "has", "had", "have", "will", "but", "not", "no", "so", "if",
  "business", "sale", "sold",
]);

/** Field weights for the weighted similarity score. */
const FIELD_WEIGHTS = {
  title: 0.25,
  businessName: 0.15,
  askingPrice: 0.20,
  revenue: 0.10,
  cashFlow: 0.05,
  location: 0.10,
  industry: 0.05,
  brokerName: 0.05,
  description: 0.05,
} as const;

// ─────────────────────────────────────────────
// Jaro-Winkler string similarity
// ─────────────────────────────────────────────

/**
 * Compute the Jaro similarity between two strings.
 *
 * Jaro similarity = (matches/|s1| + matches/|s2| + (matches - transpositions)/matches) / 3
 *
 * The matching window is floor(max(|s1|,|s2|)/2) - 1.
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);

  const s1Matches = new Array<boolean>(s1.length).fill(false);
  const s2Matches = new Array<boolean>(s2.length).fill(false);

  let matches = 0;

  // Find matching characters within the window
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3;

  return jaro;
}

/**
 * Compute the Jaro-Winkler similarity between two strings.
 *
 * Applies a prefix bonus of up to 4 matching prefix characters,
 * scaled by a factor of 0.1.
 */
function jaroWinkler(s1: string, s2: string): number {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();

  const jaro = jaroSimilarity(a, b);

  // Find common prefix length (up to 4 characters)
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));
  let prefixLength = 0;
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  const scalingFactor = 0.1;
  return jaro + prefixLength * scalingFactor * (1 - jaro);
}

// ─────────────────────────────────────────────
// Token overlap similarity (for descriptions)
// ─────────────────────────────────────────────

/**
 * Compute token-level overlap similarity between two text strings.
 * Uses Jaccard coefficient: |intersection| / |union|.
 * Filters out stop words and very short tokens.
 */
function tokenOverlapSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0.0;

  const tokenize = (text: string): Set<string> => {
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    return new Set(tokens);
  };

  const set1 = tokenize(text1);
  const set2 = tokenize(text2);

  if (set1.size === 0 || set2.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const token of set1) {
    if (set2.has(token)) intersectionCount++;
  }

  const unionCount = set1.size + set2.size - intersectionCount;
  return unionCount === 0 ? 0.0 : intersectionCount / unionCount;
}

// ─────────────────────────────────────────────
// Numeric matching helpers
// ─────────────────────────────────────────────

/**
 * Check whether two numeric values are within a given percentage tolerance.
 * Returns 1.0 if within tolerance, 0.0 otherwise. Null values score 0.0.
 */
function numericMatch(
  a: number | null,
  b: number | null,
  tolerance: number
): number {
  if (a === null || b === null || a === 0 || b === 0) return 0.0;
  const diff = Math.abs(a - b);
  const avg = (Math.abs(a) + Math.abs(b)) / 2;
  return diff / avg <= tolerance ? 1.0 : 0.0;
}

// ─────────────────────────────────────────────
// Tokenization helpers for blocking
// ─────────────────────────────────────────────

/**
 * Extract meaningful words from a title for blocking purposes.
 */
function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/**
 * Count the number of common words between two sets.
 */
function countCommonWords(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const word of a) {
    if (b.has(word)) count++;
  }
  return count;
}

// ─────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────

/**
 * Compute the weighted similarity score for a pair of listings.
 * Returns the overall score (0.0 to 1.0) and the list of matched fields.
 */
function scorePair(
  a: ListingRecord,
  b: ListingRecord
): { score: number; matchedFields: string[]; fieldScores: Record<string, number> } {
  const matchedFields: string[] = [];
  const fieldScores: Record<string, number> = {};
  let totalScore = 0;

  // Title similarity (Jaro-Winkler)
  const titleScore = jaroWinkler(a.title, b.title);
  fieldScores.title = titleScore;
  totalScore += titleScore * FIELD_WEIGHTS.title;
  if (titleScore >= 0.8) matchedFields.push("title");

  // Business name similarity (Jaro-Winkler on normalized names)
  let nameScore = 0;
  if (a.businessName && b.businessName) {
    const normA = normalizeBusinessName(a.businessName);
    const normB = normalizeBusinessName(b.businessName);
    // Use normalized names for comparison to ignore LLC/Inc/Corp differences
    nameScore = normA.length > 0 && normB.length > 0
      ? jaroWinkler(normA, normB)
      : jaroWinkler(a.businessName, b.businessName);
  }
  fieldScores.businessName = nameScore;
  totalScore += nameScore * FIELD_WEIGHTS.businessName;
  if (nameScore >= 0.8) matchedFields.push("businessName");

  // Asking price match (within 5%)
  const priceScore = numericMatch(a.askingPrice, b.askingPrice, PRICE_SCORE_TOLERANCE);
  fieldScores.askingPrice = priceScore;
  totalScore += priceScore * FIELD_WEIGHTS.askingPrice;
  if (priceScore > 0) matchedFields.push("askingPrice");

  // Revenue match (within 10%)
  const revScore = numericMatch(a.revenue, b.revenue, REVENUE_SCORE_TOLERANCE);
  fieldScores.revenue = revScore;
  totalScore += revScore * FIELD_WEIGHTS.revenue;
  if (revScore > 0) matchedFields.push("revenue");

  // Cash flow match (within 10%)
  const cfScore = numericMatch(a.cashFlow, b.cashFlow, REVENUE_SCORE_TOLERANCE);
  fieldScores.cashFlow = cfScore;
  totalScore += cfScore * FIELD_WEIGHTS.cashFlow;
  if (cfScore > 0) matchedFields.push("cashFlow");

  // Location match (city + state exact match)
  let locScore = 0;
  if (a.city && b.city && a.state && b.state) {
    const cityMatch = a.city.toLowerCase() === b.city.toLowerCase();
    const stateMatch = a.state.toLowerCase() === b.state.toLowerCase();
    locScore = cityMatch && stateMatch ? 1.0 : 0.0;
  }
  fieldScores.location = locScore;
  totalScore += locScore * FIELD_WEIGHTS.location;
  if (locScore > 0) matchedFields.push("location");

  // Industry match (exact)
  let indScore = 0;
  if (a.industry && b.industry) {
    indScore = a.industry.toLowerCase() === b.industry.toLowerCase() ? 1.0 : 0.0;
  }
  fieldScores.industry = indScore;
  totalScore += indScore * FIELD_WEIGHTS.industry;
  if (indScore > 0) matchedFields.push("industry");

  // Broker name similarity (Jaro-Winkler)
  let brokerScore = 0;
  if (a.brokerName && b.brokerName) {
    brokerScore = jaroWinkler(a.brokerName, b.brokerName);
  }
  fieldScores.brokerName = brokerScore;
  totalScore += brokerScore * FIELD_WEIGHTS.brokerName;
  if (brokerScore >= 0.8) matchedFields.push("brokerName");

  // Description similarity (token overlap)
  let descScore = 0;
  if (a.description && b.description) {
    descScore = tokenOverlapSimilarity(a.description, b.description);
  }
  fieldScores.description = descScore;
  totalScore += descScore * FIELD_WEIGHTS.description;
  if (descScore >= 0.5) matchedFields.push("description");

  // Cross-source bonus: matches from different platforms are more likely real duplicates
  if (a.platform && b.platform && a.platform !== b.platform) {
    totalScore = Math.min(1.0, totalScore + CROSS_SOURCE_BONUS);
    matchedFields.push("crossSource");
  }

  return { score: totalScore, matchedFields, fieldScores };
}

// ─────────────────────────────────────────────
// Blocking
// ─────────────────────────────────────────────

/**
 * Build candidate pairs using blocking to avoid O(n^2) comparisons.
 *
 * Four blocking criteria -- a pair is a candidate if they share ANY block:
 *   1. Same city + state
 *   2. Same zip code
 *   3. Similar asking price (within 10%)
 *   4. Title word overlap (3+ common words)
 */
function buildCandidatePairs(listings: ListingRecord[]): Set<string> {
  const pairs = new Set<string>();

  /** Create a canonical pair key (lexicographically ordered) to avoid dupes. */
  const pairKey = (id1: string, id2: string): string =>
    id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;

  // ── Block 1: Same city + state ──
  const cityStateBlocks = new Map<string, string[]>();
  for (const listing of listings) {
    if (listing.city && listing.state) {
      const key = `${listing.city.toLowerCase()}|${listing.state.toLowerCase()}`;
      const block = cityStateBlocks.get(key);
      if (block) {
        block.push(listing.id);
      } else {
        cityStateBlocks.set(key, [listing.id]);
      }
    }
  }
  for (const block of cityStateBlocks.values()) {
    addBlockPairs(block, pairs, pairKey);
  }

  // ── Block 2: Same zip code ──
  const zipBlocks = new Map<string, string[]>();
  for (const listing of listings) {
    if (listing.zipCode) {
      const block = zipBlocks.get(listing.zipCode);
      if (block) {
        block.push(listing.id);
      } else {
        zipBlocks.set(listing.zipCode, [listing.id]);
      }
    }
  }
  for (const block of zipBlocks.values()) {
    addBlockPairs(block, pairs, pairKey);
  }

  // ── Block 3: Similar asking price (within 10%) ──
  // Sort by price, then compare adjacent listings within tolerance
  const withPrice = listings
    .filter((l) => l.askingPrice !== null && l.askingPrice > 0)
    .sort((a, b) => a.askingPrice! - b.askingPrice!);

  for (let i = 0; i < withPrice.length; i++) {
    for (let j = i + 1; j < withPrice.length; j++) {
      const priceA = withPrice[i].askingPrice!;
      const priceB = withPrice[j].askingPrice!;
      const avg = (priceA + priceB) / 2;
      if (Math.abs(priceA - priceB) / avg > PRICE_BLOCK_TOLERANCE) {
        // Since sorted, all further j will be even further away
        break;
      }
      pairs.add(pairKey(withPrice[i].id, withPrice[j].id));
    }
  }

  // ── Block 4: Normalized business name match ──
  const nameBlocks = new Map<string, string[]>();
  for (const listing of listings) {
    if (listing.businessName) {
      const normalized = normalizeBusinessName(listing.businessName);
      if (normalized.length >= 3) {
        const block = nameBlocks.get(normalized);
        if (block) {
          block.push(listing.id);
        } else {
          nameBlocks.set(normalized, [listing.id]);
        }
      }
    }
  }
  for (const block of nameBlocks.values()) {
    addBlockPairs(block, pairs, pairKey);
  }

  // ── Block 5: Title word overlap (3+ common words) ──
  const listingWords = new Map<string, Set<string>>();
  const wordIndex = new Map<string, string[]>();

  for (const listing of listings) {
    const words = titleWords(listing.title);
    listingWords.set(listing.id, words);
    for (const word of words) {
      const idx = wordIndex.get(word);
      if (idx) {
        idx.push(listing.id);
      } else {
        wordIndex.set(word, [listing.id]);
      }
    }
  }

  // For each listing, find others that share at least TITLE_WORD_OVERLAP_MIN words
  const overlapCounts = new Map<string, number>();
  for (const listing of listings) {
    const words = listingWords.get(listing.id)!;
    overlapCounts.clear();

    for (const word of words) {
      const coListings = wordIndex.get(word);
      if (!coListings) continue;
      for (const otherId of coListings) {
        if (otherId === listing.id) continue;
        overlapCounts.set(otherId, (overlapCounts.get(otherId) ?? 0) + 1);
      }
    }

    for (const [otherId, count] of overlapCounts) {
      if (count >= TITLE_WORD_OVERLAP_MIN) {
        pairs.add(pairKey(listing.id, otherId));
      }
    }
  }

  return pairs;
}

/**
 * Add all pairs from a block to the candidate set.
 * Limits block size to avoid combinatorial explosion on very large blocks.
 */
function addBlockPairs(
  block: string[],
  pairs: Set<string>,
  pairKey: (a: string, b: string) => string
): void {
  // Cap block size to prevent combinatorial blow-up (100 listings = 4,950 pairs max)
  const maxBlockSize = 100;
  const limited = block.length > maxBlockSize ? block.slice(0, maxBlockSize) : block;

  for (let i = 0; i < limited.length; i++) {
    for (let j = i + 1; j < limited.length; j++) {
      pairs.add(pairKey(limited[i], limited[j]));
    }
  }
}

// ─────────────────────────────────────────────
// Database helpers
// ─────────────────────────────────────────────

/**
 * Fetch all active listings as lightweight records for in-memory processing.
 */
async function fetchActiveListings(since?: Date): Promise<ListingRecord[]> {
  const listings = await prisma.listing.findMany({
    where: {
      isActive: true,
      isHidden: false,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: {
      id: true,
      title: true,
      businessName: true,
      askingPrice: true,
      revenue: true,
      cashFlow: true,
      city: true,
      state: true,
      zipCode: true,
      industry: true,
      brokerName: true,
      description: true,
      sources: {
        select: { platform: true },
        take: 1,
        orderBy: { firstScrapedAt: "asc" },
      },
    },
  });

  return listings.map((l) => ({
    id: l.id,
    title: l.title,
    businessName: l.businessName,
    askingPrice: l.askingPrice ? Number(l.askingPrice) : null,
    revenue: l.revenue ? Number(l.revenue) : null,
    cashFlow: l.cashFlow ? Number(l.cashFlow) : null,
    city: l.city,
    state: l.state,
    zipCode: l.zipCode,
    industry: l.industry,
    brokerName: l.brokerName,
    description: l.description,
    platform: l.sources[0]?.platform ?? null,
  }));
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Run deduplication across all active listings.
 *
 * 1. Loads all active listings.
 * 2. Builds candidate pairs via blocking.
 * 3. Scores each pair.
 * 4. Persists DedupCandidate records for pairs above the threshold.
 * 5. Creates DedupGroup records for related candidates.
 */
export async function runDeduplication(): Promise<DedupResult> {
  const errors: string[] = [];
  let candidatesFound = 0;
  let groupsCreated = 0;

  try {
    // 1. Fetch all active listings
    const listings = await fetchActiveListings();
    if (listings.length < 2) {
      return { candidatesFound: 0, groupsCreated: 0, errors: [] };
    }

    // Build a lookup map
    const listingMap = new Map<string, ListingRecord>();
    for (const listing of listings) {
      listingMap.set(listing.id, listing);
    }

    // 2. Build candidate pairs via blocking
    const candidatePairKeys = buildCandidatePairs(listings);

    // 3. Score each candidate pair
    const scoredCandidates: DedupCandidate[] = [];
    for (const key of candidatePairKeys) {
      const [id1, id2] = key.split("|");
      const listingA = listingMap.get(id1);
      const listingB = listingMap.get(id2);

      if (!listingA || !listingB) continue;

      const { score, matchedFields } = scorePair(listingA, listingB);

      if (score >= CANDIDATE_THRESHOLD) {
        scoredCandidates.push({
          listingId1: id1,
          listingId2: id2,
          score,
          matchedFields,
        });
      }
    }

    candidatesFound = scoredCandidates.length;

    if (scoredCandidates.length === 0) {
      return { candidatesFound: 0, groupsCreated: 0, errors: [] };
    }

    // 4. Persist candidates and create groups
    // Group candidates using union-find to cluster related listings
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
      return parent.get(x)!;
    };
    const union = (a: string, b: string): void => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent.set(rootA, rootB);
    };

    for (const candidate of scoredCandidates) {
      union(candidate.listingId1, candidate.listingId2);
    }

    // Build groups from the union-find structure
    const groups = new Map<string, Set<string>>();
    for (const candidate of scoredCandidates) {
      const root = find(candidate.listingId1);
      if (!groups.has(root)) groups.set(root, new Set());
      groups.get(root)!.add(candidate.listingId1);
      groups.get(root)!.add(candidate.listingId2);
    }

    // 5. Write to database in a transaction
    await prisma.$transaction(async (tx) => {
      for (const [_root, memberIds] of groups) {
        // Check if any of these listings already belong to a dedup group
        const existingGrouped = await tx.listing.findMany({
          where: {
            id: { in: [...memberIds] },
            dedupGroupId: { not: null },
          },
          select: { id: true, dedupGroupId: true },
        });

        let groupId: string;

        if (existingGrouped.length > 0) {
          // Use the existing group
          groupId = existingGrouped[0].dedupGroupId!;
        } else {
          // Create a new DedupGroup
          const group = await tx.dedupGroup.create({
            data: {},
          });
          groupId = group.id;
          groupsCreated++;
        }

        // Associate all listings with this group
        await tx.listing.updateMany({
          where: {
            id: { in: [...memberIds] },
            dedupGroupId: null,
          },
          data: { dedupGroupId: groupId },
        });

        // Upsert DedupCandidate records for pairs in this group
        const groupCandidates = scoredCandidates.filter(
          (c) => memberIds.has(c.listingId1) && memberIds.has(c.listingId2)
        );

        for (const candidate of groupCandidates) {
          // Ensure consistent ordering (listingAId < listingBId)
          const [aId, bId] =
            candidate.listingId1 < candidate.listingId2
              ? [candidate.listingId1, candidate.listingId2]
              : [candidate.listingId2, candidate.listingId1];

          const pairScores = scorePair(
            listingMap.get(aId)!,
            listingMap.get(bId)!
          );

          try {
            await tx.dedupCandidate.upsert({
              where: {
                listingAId_listingBId: { listingAId: aId, listingBId: bId },
              },
              create: {
                listingAId: aId,
                listingBId: bId,
                overallScore: candidate.score,
                nameScore: pairScores.fieldScores.businessName ?? null,
                locationScore: pairScores.fieldScores.location ?? null,
                priceScore: pairScores.fieldScores.askingPrice ?? null,
                revenueScore: pairScores.fieldScores.revenue ?? null,
                descriptionScore: pairScores.fieldScores.description ?? null,
                status: "PENDING",
              },
              update: {
                overallScore: candidate.score,
                nameScore: pairScores.fieldScores.businessName ?? null,
                locationScore: pairScores.fieldScores.location ?? null,
                priceScore: pairScores.fieldScores.askingPrice ?? null,
                revenueScore: pairScores.fieldScores.revenue ?? null,
                descriptionScore: pairScores.fieldScores.description ?? null,
              },
            });
          } catch (err) {
            const message =
              err instanceof Error ? err.message : String(err);
            errors.push(
              `Failed to upsert candidate ${aId} / ${bId}: ${message}`
            );
          }
        }
      }
    });

    return { candidatesFound, groupsCreated, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Fatal deduplication error: ${message}`);
    return { candidatesFound, groupsCreated, errors };
  }
}

/**
 * Run deduplication focused on recent listings (e.g., last 7 days).
 * Still compares recent listings against ALL active listings for cross-source matching.
 */
export async function runRecentDeduplication(days: number = 7): Promise<DedupResult> {
  const errors: string[] = [];
  let candidatesFound = 0;
  let groupsCreated = 0;

  try {
    // Load all active listings (needed for cross-reference)
    const allListings = await fetchActiveListings();
    if (allListings.length < 2) {
      return { candidatesFound: 0, groupsCreated: 0, errors: [] };
    }

    // Identify which are "recent"
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentIds = new Set<string>();
    const recentListings = await fetchActiveListings(cutoff);
    for (const l of recentListings) recentIds.add(l.id);

    if (recentIds.size === 0) {
      return { candidatesFound: 0, groupsCreated: 0, errors: [] };
    }

    const listingMap = new Map<string, ListingRecord>();
    for (const listing of allListings) {
      listingMap.set(listing.id, listing);
    }

    // Build all candidate pairs, but only score those involving at least one recent listing
    const candidatePairKeys = buildCandidatePairs(allListings);
    const scoredCandidates: DedupCandidate[] = [];

    for (const key of candidatePairKeys) {
      const [id1, id2] = key.split("|");

      // At least one must be recent
      if (!recentIds.has(id1) && !recentIds.has(id2)) continue;

      const listingA = listingMap.get(id1);
      const listingB = listingMap.get(id2);
      if (!listingA || !listingB) continue;

      const { score, matchedFields } = scorePair(listingA, listingB);

      if (score >= CANDIDATE_THRESHOLD) {
        scoredCandidates.push({
          listingId1: id1,
          listingId2: id2,
          score,
          matchedFields,
        });
      }
    }

    candidatesFound = scoredCandidates.length;

    if (scoredCandidates.length === 0) {
      return { candidatesFound: 0, groupsCreated: 0, errors: [] };
    }

    // Reuse the same persistence logic as runDeduplication
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
      return parent.get(x)!;
    };
    const union = (a: string, b: string): void => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent.set(rootA, rootB);
    };

    for (const candidate of scoredCandidates) {
      union(candidate.listingId1, candidate.listingId2);
    }

    const groups = new Map<string, Set<string>>();
    for (const candidate of scoredCandidates) {
      const root = find(candidate.listingId1);
      if (!groups.has(root)) groups.set(root, new Set());
      groups.get(root)!.add(candidate.listingId1);
      groups.get(root)!.add(candidate.listingId2);
    }

    await prisma.$transaction(async (tx) => {
      for (const [_root, memberIds] of groups) {
        const existingGrouped = await tx.listing.findMany({
          where: {
            id: { in: [...memberIds] },
            dedupGroupId: { not: null },
          },
          select: { id: true, dedupGroupId: true },
        });

        let groupId: string;
        if (existingGrouped.length > 0) {
          groupId = existingGrouped[0].dedupGroupId!;
        } else {
          const group = await tx.dedupGroup.create({ data: {} });
          groupId = group.id;
          groupsCreated++;
        }

        await tx.listing.updateMany({
          where: { id: { in: [...memberIds] }, dedupGroupId: null },
          data: { dedupGroupId: groupId },
        });

        const groupCandidates = scoredCandidates.filter(
          (c) => memberIds.has(c.listingId1) && memberIds.has(c.listingId2)
        );

        for (const candidate of groupCandidates) {
          const [aId, bId] =
            candidate.listingId1 < candidate.listingId2
              ? [candidate.listingId1, candidate.listingId2]
              : [candidate.listingId2, candidate.listingId1];

          const pairScores = scorePair(listingMap.get(aId)!, listingMap.get(bId)!);

          try {
            await tx.dedupCandidate.upsert({
              where: { listingAId_listingBId: { listingAId: aId, listingBId: bId } },
              create: {
                listingAId: aId,
                listingBId: bId,
                overallScore: candidate.score,
                nameScore: pairScores.fieldScores.businessName ?? null,
                locationScore: pairScores.fieldScores.location ?? null,
                priceScore: pairScores.fieldScores.askingPrice ?? null,
                revenueScore: pairScores.fieldScores.revenue ?? null,
                descriptionScore: pairScores.fieldScores.description ?? null,
                status: "PENDING",
              },
              update: {
                overallScore: candidate.score,
                nameScore: pairScores.fieldScores.businessName ?? null,
                locationScore: pairScores.fieldScores.location ?? null,
                priceScore: pairScores.fieldScores.askingPrice ?? null,
                revenueScore: pairScores.fieldScores.revenue ?? null,
                descriptionScore: pairScores.fieldScores.description ?? null,
              },
            });
          } catch (err) {
            errors.push(`Failed to upsert candidate ${aId} / ${bId}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    });

    return { candidatesFound, groupsCreated, errors };
  } catch (err) {
    errors.push(`Fatal deduplication error: ${err instanceof Error ? err.message : String(err)}`);
    return { candidatesFound, groupsCreated, errors };
  }
}

/**
 * Find duplicates for a specific listing.
 *
 * Loads all active listings, builds blocking pairs that include the target,
 * and returns scored candidates.
 */
export async function findDuplicatesForListing(
  listingId: string
): Promise<DedupCandidate[]> {
  const listings = await fetchActiveListings();
  const target = listings.find((l) => l.id === listingId);
  if (!target) return [];

  const listingMap = new Map<string, ListingRecord>();
  for (const listing of listings) {
    listingMap.set(listing.id, listing);
  }

  // Build all candidate pairs, then filter to those involving the target
  const allPairs = buildCandidatePairs(listings);

  const results: DedupCandidate[] = [];
  for (const key of allPairs) {
    const [id1, id2] = key.split("|");

    // Only consider pairs involving the target listing
    if (id1 !== listingId && id2 !== listingId) continue;

    const listingA = listingMap.get(id1);
    const listingB = listingMap.get(id2);
    if (!listingA || !listingB) continue;

    const { score, matchedFields } = scorePair(listingA, listingB);

    if (score >= CANDIDATE_THRESHOLD) {
      results.push({
        listingId1: id1,
        listingId2: id2,
        score,
        matchedFields,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Merge two listings: keep the primary, mark the secondary as inactive,
 * and move all ListingSources from secondary to primary.
 */
export async function mergeDuplicates(
  primaryId: string,
  secondaryId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Verify both listings exist
    const [primary, secondary] = await Promise.all([
      tx.listing.findUniqueOrThrow({ where: { id: primaryId } }),
      tx.listing.findUniqueOrThrow({ where: { id: secondaryId } }),
    ]);

    // Move all ListingSources from secondary to primary
    await tx.listingSource.updateMany({
      where: { listingId: secondaryId },
      data: { listingId: primaryId },
    });

    // Mark secondary as inactive
    await tx.listing.update({
      where: { id: secondaryId },
      data: { isActive: false },
    });

    // Ensure both listings are in the same DedupGroup
    let groupId = primary.dedupGroupId ?? secondary.dedupGroupId;
    if (!groupId) {
      const group = await tx.dedupGroup.create({ data: {} });
      groupId = group.id;
    }

    // Set the primary listing on the group and associate both listings
    await tx.dedupGroup.update({
      where: { id: groupId },
      data: { primaryListingId: primaryId },
    });

    await tx.listing.updateMany({
      where: { id: { in: [primaryId, secondaryId] } },
      data: { dedupGroupId: groupId },
    });

    // Update the DedupCandidate status for this pair
    const [aId, bId] =
      primaryId < secondaryId
        ? [primaryId, secondaryId]
        : [secondaryId, primaryId];

    await tx.dedupCandidate
      .update({
        where: { listingAId_listingBId: { listingAId: aId, listingBId: bId } },
        data: {
          status: "MERGED",
          resolvedBy: "system",
          resolvedAt: new Date(),
        },
      })
      .catch(() => {
        // Candidate record may not exist if merge was triggered manually
      });

    // Update lastSeenAt on primary to reflect the most recent data
    const latestSeenAt =
      primary.lastSeenAt > secondary.lastSeenAt
        ? primary.lastSeenAt
        : secondary.lastSeenAt;

    await tx.listing.update({
      where: { id: primaryId },
      data: { lastSeenAt: latestSeenAt },
    });

    // Fill in missing fields on primary from secondary
    const fieldsToMerge = [
      "businessName",
      "revenue",
      "ebitda",
      "sde",
      "cashFlow",
      "inventory",
      "ffe",
      "realEstate",
      "industry",
      "category",
      "subcategory",
      "naicsCode",
      "county",
      "zipCode",
      "fullAddress",
      "brokerName",
      "brokerCompany",
      "brokerPhone",
      "brokerEmail",
      "employees",
      "established",
      "reasonForSale",
      "facilities",
    ] as const;

    const updateData: Record<string, unknown> = {};
    for (const field of fieldsToMerge) {
      const primaryVal = primary[field as keyof typeof primary];
      const secondaryVal = secondary[field as keyof typeof secondary];
      if (primaryVal === null && secondaryVal !== null) {
        updateData[field] = secondaryVal;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await tx.listing.update({
        where: { id: primaryId },
        data: updateData,
      });
    }
  });
}

/**
 * Auto-merge all DedupCandidate records above a given threshold.
 *
 * For each qualifying candidate pair, the listing with more sources
 * (or the older listing) is chosen as the primary.
 *
 * Returns the number of merges performed.
 */
export async function autoMergeCandidates(
  threshold: number = AUTO_MERGE_THRESHOLD
): Promise<number> {
  const pendingCandidates = await prisma.dedupCandidate.findMany({
    where: {
      status: "PENDING",
      overallScore: { gte: threshold },
    },
    orderBy: { overallScore: "desc" },
  });

  let mergeCount = 0;
  const mergedIds = new Set<string>();

  for (const candidate of pendingCandidates) {
    // Skip if either listing was already merged in this run
    if (mergedIds.has(candidate.listingAId) || mergedIds.has(candidate.listingBId)) {
      continue;
    }

    try {
      // Determine which listing should be primary based on source count
      const [sourcesA, sourcesB] = await Promise.all([
        prisma.listingSource.count({
          where: { listingId: candidate.listingAId },
        }),
        prisma.listingSource.count({
          where: { listingId: candidate.listingBId },
        }),
      ]);

      let primaryId: string;
      let secondaryId: string;

      if (sourcesA > sourcesB) {
        primaryId = candidate.listingAId;
        secondaryId = candidate.listingBId;
      } else if (sourcesB > sourcesA) {
        primaryId = candidate.listingBId;
        secondaryId = candidate.listingAId;
      } else {
        // Equal sources -- prefer the older listing (first seen)
        const [listingA, listingB] = await Promise.all([
          prisma.listing.findUnique({
            where: { id: candidate.listingAId },
            select: { firstSeenAt: true },
          }),
          prisma.listing.findUnique({
            where: { id: candidate.listingBId },
            select: { firstSeenAt: true },
          }),
        ]);

        if (listingA && listingB && listingA.firstSeenAt <= listingB.firstSeenAt) {
          primaryId = candidate.listingAId;
          secondaryId = candidate.listingBId;
        } else {
          primaryId = candidate.listingBId;
          secondaryId = candidate.listingAId;
        }
      }

      await mergeDuplicates(primaryId, secondaryId);
      mergedIds.add(secondaryId);
      mergeCount++;
    } catch (err) {
      // Log error but continue processing other candidates
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[dedup] Failed to auto-merge ${candidate.listingAId} / ${candidate.listingBId}: ${message}`
      );
    }
  }

  return mergeCount;
}
