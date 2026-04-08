import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

interface PercentileStats {
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  mean: number;
}

function calcStats(values: number[]): PercentileStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: percentile(sorted, 50),
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: values.reduce((a, b) => a + b, 0) / values.length,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompsStats {
  count: number;
  confidence: "low" | "moderate" | "high";
  ebitdaMultiple: PercentileStats | null;
  revenueMultiple: PercentileStats | null;
  sdeMultiple: PercentileStats | null;
  dealStructure: {
    avgPctCashAtClose: number | null;
    avgSellerNoteTermYears: number | null;
    pctWithEarnout: number | null;
  };
  volumeByYear: Record<string, number>;
}

// ---------------------------------------------------------------------------
// GET /api/bvr/comps?listingId=...
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const listingId = request.nextUrl.searchParams.get("listingId");

  if (!listingId) {
    return NextResponse.json(
      { error: "listingId query parameter is required" },
      { status: 400 },
    );
  }

  // 1. Fetch the listing
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { targetRank: true, revenue: true },
  });

  if (!listing || listing.targetRank == null) {
    return NextResponse.json({ stats: null, transactions: [], count: 0 });
  }

  // 2. Build the BvrTransaction query filter
  const revenueFilter: Record<string, unknown> = {};
  if (listing.revenue != null) {
    const rev = Number(listing.revenue);
    revenueFilter.revenue = {
      gte: rev * 0.5,
      lte: rev * 1.5,
    };
  }

  // 3. Query matching transactions
  const transactions = await prisma.bvrTransaction.findMany({
    where: {
      targetRank: listing.targetRank,
      ...revenueFilter,
    },
    orderBy: { transactionDate: "desc" },
  });

  const count = transactions.length;

  if (count === 0) {
    return NextResponse.json({ stats: null, transactions: [], count: 0 });
  }

  // 4. Extract multiple arrays
  const ebitdaMultiples = transactions
    .map((t) => t.mvicEbitdaMultiple)
    .filter((v): v is number => v !== null);

  const revenueMultiples = transactions
    .map((t) => t.mvicRevenueMultiple)
    .filter((v): v is number => v !== null);

  const sdeMultiples = transactions
    .map((t) => t.mvicSdeMultiple)
    .filter((v): v is number => v !== null);

  // 5. Deal structure averages
  const cashAtCloseValues = transactions
    .map((t) => t.pctCashAtClose)
    .filter((v): v is number => v !== null);
  const avgPctCashAtClose =
    cashAtCloseValues.length > 0
      ? cashAtCloseValues.reduce((a, b) => a + b, 0) / cashAtCloseValues.length
      : null;

  const sellerNoteTermValues = transactions
    .map((t) => t.sellerNoteTermYears)
    .filter((v): v is number => v !== null);
  const avgSellerNoteTermYears =
    sellerNoteTermValues.length > 0
      ? sellerNoteTermValues.reduce((a, b) => a + b, 0) /
        sellerNoteTermValues.length
      : null;

  const earnoutCount = transactions.filter(
    (t) => t.earnoutAmount !== null,
  ).length;
  const pctWithEarnout = count > 0 ? earnoutCount / count : null;

  // 6. Volume by year
  const volumeByYear: Record<string, number> = {};
  for (const t of transactions) {
    if (t.transactionDate) {
      const year = new Date(t.transactionDate).getFullYear().toString();
      volumeByYear[year] = (volumeByYear[year] ?? 0) + 1;
    }
  }

  // 7. Confidence rating
  const confidence: CompsStats["confidence"] =
    count < 10 ? "low" : count <= 30 ? "moderate" : "high";

  // 8. Build stats object
  const stats: CompsStats = {
    count,
    confidence,
    ebitdaMultiple: calcStats(ebitdaMultiples),
    revenueMultiple: calcStats(revenueMultiples),
    sdeMultiple: calcStats(sdeMultiples),
    dealStructure: {
      avgPctCashAtClose,
      avgSellerNoteTermYears,
      pctWithEarnout,
    },
    volumeByYear,
  };

  // 9. Serialize transactions (Decimal -> number conversion), limit to 50
  const first50 = transactions.slice(0, 50).map((t) => ({
    id: t.id,
    sourceDatabase: t.sourceDatabase,
    industry: t.industry,
    sicCode: t.sicCode,
    naicsCode: t.naicsCode,
    transactionDate: t.transactionDate,
    mvic: t.mvic != null ? Number(t.mvic) : null,
    revenue: t.revenue != null ? Number(t.revenue) : null,
    ebitda: t.ebitda != null ? Number(t.ebitda) : null,
    sde: t.sde != null ? Number(t.sde) : null,
    ebitdaMarginPct: t.ebitdaMarginPct,
    mvicEbitdaMultiple: t.mvicEbitdaMultiple,
    mvicRevenueMultiple: t.mvicRevenueMultiple,
    mvicSdeMultiple: t.mvicSdeMultiple,
    pctCashAtClose: t.pctCashAtClose,
    sellerNoteAmount:
      t.sellerNoteAmount != null ? Number(t.sellerNoteAmount) : null,
    sellerNoteTermYears: t.sellerNoteTermYears,
    sellerNoteRate: t.sellerNoteRate,
    earnoutAmount: t.earnoutAmount != null ? Number(t.earnoutAmount) : null,
    employeeCount: t.employeeCount,
    yearsInBusiness: t.yearsInBusiness,
    state: t.state,
  }));

  return NextResponse.json({ stats, transactions: first50, count });
}
