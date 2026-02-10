import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSearchParams } from "@/lib/validations/common";
import { dedupQuerySchema } from "@/lib/validations/listings";

// GET /api/dedup — List dedup candidates with listing details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(dedupQuerySchema, searchParams);
    if (parsed.error) return parsed.error;
    const { page, limit, status } = parsed.data;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [candidates, total] = await Promise.all([
      prisma.dedupCandidate.findMany({
        where,
        orderBy: { overallScore: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.dedupCandidate.count({ where }),
    ]);

    // Fetch listing details for all referenced listings
    const listingIds = new Set<string>();
    for (const c of candidates) {
      listingIds.add(c.listingAId);
      listingIds.add(c.listingBId);
    }

    const listings = await prisma.listing.findMany({
      where: { id: { in: [...listingIds] } },
      select: {
        id: true,
        title: true,
        businessName: true,
        askingPrice: true,
        revenue: true,
        city: true,
        state: true,
        industry: true,
        sources: {
          select: {
            platform: true,
            sourceUrl: true,
          },
        },
      },
    });

    const listingMap = Object.fromEntries(listings.map((l) => [l.id, l]));

    // Enrich candidates with listing data
    const enriched = candidates.map((c) => ({
      ...c,
      listingA: listingMap[c.listingAId] ?? null,
      listingB: listingMap[c.listingBId] ?? null,
    }));

    return NextResponse.json({
      candidates: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching dedup candidates:", error);
    return NextResponse.json(
      { error: "Failed to fetch dedup candidates" },
      { status: 500 }
    );
  }
}

// POST /api/dedup — Trigger deduplication run
export async function POST() {
  try {
    // Dynamic import to avoid loading dedup engine at build time
    const { runDeduplication } = await import("@/lib/dedup/dedup-engine");
    const result = await runDeduplication();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error running deduplication:", error);
    return NextResponse.json(
      { error: "Failed to run deduplication" },
      { status: 500 }
    );
  }
}
