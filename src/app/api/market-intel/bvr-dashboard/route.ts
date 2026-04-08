import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/* ─── Helpers ─── */

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function calcStats(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    p25: percentile(sorted, 25),
    median: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    max: sorted[sorted.length - 1],
    mean: values.reduce((a, b) => a + b, 0) / values.length,
  };
}

function buildHistogram(values: number[], bucketSize: number = 0.5) {
  if (values.length === 0) return [];
  const min = Math.floor(Math.min(...values) / bucketSize) * bucketSize;
  const max = Math.ceil(Math.max(...values) / bucketSize) * bucketSize;
  const buckets = [];
  for (let start = min; start < max; start += bucketSize) {
    const end = start + bucketSize;
    const label = `${start.toFixed(1)}x\u2013${end.toFixed(1)}x`;
    const count = values.filter((v) => v >= start && v < end).length;
    buckets.push({ bucket: label, count });
  }
  return buckets;
}

/* ─── Revenue distribution buckets ─── */

const revenueBuckets = [
  { label: "<$500K", min: 0, max: 500_000 },
  { label: "$500K\u2013$1M", min: 500_000, max: 1_000_000 },
  { label: "$1M\u2013$2M", min: 1_000_000, max: 2_000_000 },
  { label: "$2M\u2013$3M", min: 2_000_000, max: 3_000_000 },
  { label: "$3M+", min: 3_000_000, max: Infinity },
];

/* ─── GET /api/market-intel/bvr-dashboard ─── */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rankStr = searchParams.get("rank");
    const revenueMin = searchParams.get("revenueMin");
    const revenueMax = searchParams.get("revenueMax");
    const dateRange = searchParams.get("dateRange") ?? "3yr";

    // Validate rank
    const rank = rankStr ? Number(rankStr) : NaN;
    if (!rankStr || isNaN(rank) || rank < 1 || rank > 4) {
      return NextResponse.json(
        { error: "rank is required and must be 1-4" },
        { status: 400 },
      );
    }

    // Build where clause
    const where: any = { targetRank: rank };

    if (revenueMin || revenueMax) {
      where.revenue = {};
      if (revenueMin) where.revenue.gte = Number(revenueMin);
      if (revenueMax) where.revenue.lte = Number(revenueMax);
    }

    if (dateRange !== "all") {
      const years = dateRange === "1yr" ? 1 : dateRange === "5yr" ? 5 : 3;
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - years);
      where.transactionDate = { gte: cutoff };
    }

    // Fetch transactions
    const transactions = await prisma.bvrTransaction.findMany({
      where,
      select: {
        transactionDate: true,
        revenue: true,
        mvic: true,
        ebitda: true,
        sde: true,
        mvicEbitdaMultiple: true,
        mvicRevenueMultiple: true,
        mvicSdeMultiple: true,
        pctCashAtClose: true,
        sellerNoteAmount: true,
        sellerNoteTermYears: true,
        earnoutAmount: true,
      },
    });

    // Convert Decimal fields to numbers
    const txns = transactions.map((t) => ({
      transactionDate: t.transactionDate,
      revenue: t.revenue ? Number(t.revenue) : null,
      mvic: t.mvic ? Number(t.mvic) : null,
      ebitda: t.ebitda ? Number(t.ebitda) : null,
      sde: t.sde ? Number(t.sde) : null,
      mvicEbitdaMultiple: t.mvicEbitdaMultiple,
      mvicRevenueMultiple: t.mvicRevenueMultiple,
      mvicSdeMultiple: t.mvicSdeMultiple,
      pctCashAtClose: t.pctCashAtClose,
      sellerNoteAmount: t.sellerNoteAmount ? Number(t.sellerNoteAmount) : null,
      sellerNoteTermYears: t.sellerNoteTermYears,
      earnoutAmount: t.earnoutAmount ? Number(t.earnoutAmount) : null,
    }));

    // Collect multiples arrays
    const ebitdaMultiples = txns
      .map((t) => t.mvicEbitdaMultiple)
      .filter((v): v is number => v != null);
    const revenueMultiples = txns
      .map((t) => t.mvicRevenueMultiple)
      .filter((v): v is number => v != null);
    const sdeMultiples = txns
      .map((t) => t.mvicSdeMultiple)
      .filter((v): v is number => v != null);

    // Stats
    const ebitdaStats = calcStats(ebitdaMultiples);
    const revenueStats = calcStats(revenueMultiples);
    const sdeStats = calcStats(sdeMultiples);

    // Histograms
    const ebitdaHistogram = buildHistogram(ebitdaMultiples);
    const revenueMultipleHistogram = buildHistogram(revenueMultiples);
    const sdeMultipleHistogram = buildHistogram(sdeMultiples);

    // Trend by year
    const yearMap = new Map<string, { total: number; count: number }>();
    for (const t of txns) {
      if (t.transactionDate && t.mvicEbitdaMultiple != null) {
        const year = new Date(t.transactionDate).getFullYear().toString();
        const entry = yearMap.get(year) ?? { total: 0, count: 0 };
        entry.total += t.mvicEbitdaMultiple;
        entry.count += 1;
        yearMap.set(year, entry);
      }
    }
    const trendByYear = Array.from(yearMap.entries())
      .map(([year, { total, count }]) => ({
        year,
        avgEbitdaMultiple: Math.round((total / count) * 100) / 100,
        count,
      }))
      .sort((a, b) => a.year.localeCompare(b.year));

    // Deal structure
    const cashValues = txns
      .map((t) => t.pctCashAtClose)
      .filter((v): v is number => v != null);
    const sellerNoteTerms = txns
      .map((t) => t.sellerNoteTermYears)
      .filter((v): v is number => v != null);
    const sellerNotePcts = txns
      .filter((t) => t.sellerNoteAmount != null && t.mvic != null && t.mvic > 0)
      .map((t) => (t.sellerNoteAmount! / t.mvic!) * 100);
    const earnoutCount = txns.filter((t) => t.earnoutAmount != null).length;

    const avg = (arr: number[]) =>
      arr.length > 0
        ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
        : null;

    const dealStructure = {
      avgPctCashAtClose: avg(cashValues),
      avgSellerNotePct: avg(sellerNotePcts),
      pctWithEarnout:
        txns.length > 0
          ? Math.round((earnoutCount / txns.length) * 10000) / 100
          : null,
      avgSellerNoteTermYears: avg(sellerNoteTerms),
    };

    // Revenue distribution
    const revenues = txns
      .map((t) => t.revenue)
      .filter((v): v is number => v != null);
    const revenueDistribution = revenueBuckets.map((b) => ({
      bucket: b.label,
      count: revenues.filter(
        (r) => r >= b.min && (b.max === Infinity ? true : r < b.max),
      ).length,
    }));

    // Date range
    const dates = txns
      .map((t) => t.transactionDate)
      .filter((d): d is Date => d != null)
      .map((d) => new Date(d).getTime());
    const dateRangeResult =
      dates.length > 0
        ? {
            earliest: new Date(Math.min(...dates)).toISOString(),
            latest: new Date(Math.max(...dates)).toISOString(),
          }
        : null;

    // Summary
    const summary = {
      transactionCount: txns.length,
      medianEbitdaMultiple: ebitdaStats?.median ?? null,
      medianRevenueMultiple: revenueStats?.median ?? null,
      dateRange: dateRangeResult,
    };

    return NextResponse.json({
      summary,
      ebitdaHistogram,
      revenueMultipleHistogram,
      sdeMultipleHistogram,
      ebitdaStats,
      revenueStats,
      sdeStats,
      trendByYear,
      dealStructure,
      revenueDistribution,
    });
  } catch (error) {
    console.error("BVR dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 },
    );
  }
}
