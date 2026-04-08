import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAcquisitionThesis } from "@/lib/ai/acquisition-thesis-generator";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// ─────────────────────────────────────────────
// GET — Retrieve existing Priority A package
// ─────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const pkg = await prisma.priorityAPackage.findUnique({
      where: { listingId: id },
    });

    if (!pkg) {
      return NextResponse.json(
        { error: "No package generated yet" },
        { status: 404 },
      );
    }

    // Check staleness — if listing was updated after package generation
    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { updatedAt: true },
    });

    const isStale = listing ? listing.updatedAt > pkg.generatedAt : false;

    return NextResponse.json({ package: pkg, isStale });
  } catch (err) {
    console.error("[Priority A GET]", err);
    return NextResponse.json(
      { error: "Failed to retrieve package" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// POST — Generate or regenerate Priority A package
// ─────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Fetch listing with all profile fields
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        opportunity: true,
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 },
      );
    }

    // 2. Fetch AcquisitionThesisConfig for synergy description
    const thesisConfig = listing.targetRank
      ? await prisma.acquisitionThesisConfig.findUnique({
          where: { targetRank: listing.targetRank },
        })
      : null;

    // 3. Fetch BVR comps — query by targetRank, compute median EBITDA multiple
    const comps = listing.targetRank
      ? await prisma.bvrTransaction.findMany({
          where: { targetRank: listing.targetRank },
          select: {
            mvicEbitdaMultiple: true,
            mvicRevenueMultiple: true,
            mvicSdeMultiple: true,
          },
        })
      : [];

    const ebitdaMultiples = comps
      .map((c) => c.mvicEbitdaMultiple)
      .filter((v): v is number => v !== null);
    const sorted = [...ebitdaMultiples].sort((a, b) => a - b);

    const medianEbitdaMultiple =
      sorted.length > 0 ? percentile(sorted, 50) : null;

    // 4. Call AI thesis generator
    const yearsInBusiness = listing.established
      ? new Date().getFullYear() - listing.established
      : null;

    const thesisResult = await generateAcquisitionThesis({
      companyName: listing.businessName || listing.title,
      city: listing.city,
      state: listing.state,
      targetRankLabel: listing.targetRankLabel,
      revenue: listing.revenue ? Number(listing.revenue) : null,
      ebitda: listing.ebitda ? Number(listing.ebitda) : null,
      askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
      employees: listing.employees,
      yearsInBusiness,
      acquisitionScore: listing.acquisitionScore,
      financialScore: listing.financialScore,
      strategicScore: listing.strategicScore,
      operatorScore: listing.operatorScore,
      disqualifiers: listing.acquisitionDisqualifiers ?? [],
      synergyDescription: thesisConfig?.synergyDescription ?? null,
      medianEbitdaMultiple,
      comparableCount: ebitdaMultiples.length,
    });

    // 5. Build executive summary (template string, no AI)
    const executiveSummary = [
      `**${listing.businessName || listing.title}**`,
      listing.city && listing.state
        ? `${listing.city}, ${listing.state}`
        : null,
      listing.targetRankLabel
        ? `Target Type: ${listing.targetRankLabel}`
        : null,
      listing.revenue
        ? `Revenue: $${Number(listing.revenue).toLocaleString()}`
        : null,
      listing.ebitda
        ? `EBITDA: $${Number(listing.ebitda).toLocaleString()}`
        : null,
      listing.askingPrice
        ? `Asking Price: $${Number(listing.askingPrice).toLocaleString()}`
        : null,
      listing.acquisitionScore
        ? `Acquisition Score: ${listing.acquisitionScore}/100 (${listing.acquisitionTier})`
        : null,
      `Financial: ${listing.financialScore ?? "N/A"} | Strategic: ${listing.strategicScore ?? "N/A"} | Operator: ${listing.operatorScore ?? "N/A"}`,
      listing.acquisitionDisqualifiers?.length
        ? `Disqualifiers: ${listing.acquisitionDisqualifiers.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    // 6. Build valuation snapshot from BVR percentiles
    const adjustedEbitda = listing.ebitda ? Number(listing.ebitda) : null;
    // If earningsType is SDE, the reported figure includes owner comp — deduct $95K for EBITDA equivalent
    const normalizedEbitda =
      listing.earningsType === "SDE" && adjustedEbitda
        ? adjustedEbitda - 95000
        : adjustedEbitda;

    const p25 = sorted.length > 0 ? percentile(sorted, 25) : null;
    const median = sorted.length > 0 ? percentile(sorted, 50) : null;
    const p75 = sorted.length > 0 ? percentile(sorted, 75) : null;

    const valuationSnapshot = {
      adjustedEbitda: normalizedEbitda,
      earningsType: listing.earningsType,
      conservative:
        p25 && normalizedEbitda
          ? { multiple: p25, impliedPrice: normalizedEbitda * p25 }
          : null,
      target:
        median && normalizedEbitda
          ? { multiple: median, impliedPrice: normalizedEbitda * median }
          : null,
      stretch:
        p75 && normalizedEbitda
          ? { multiple: p75, impliedPrice: normalizedEbitda * p75 }
          : null,
      comparableCount: ebitdaMultiples.length,
    };

    // 7. Upsert PriorityAPackage
    const pkg = await prisma.priorityAPackage.upsert({
      where: { listingId: id },
      create: {
        listingId: id,
        executiveSummary,
        acquisitionThesis: thesisResult.result.thesis,
        valuationSnapshot,
        generatedAt: new Date(),
      },
      update: {
        executiveSummary,
        acquisitionThesis: thesisResult.result.thesis,
        valuationSnapshot,
        generatedAt: new Date(),
      },
    });

    // 8. Return package + full thesis result
    return NextResponse.json({ package: pkg, thesis: thesisResult.result });
  } catch (err) {
    console.error("[Priority A POST]", err);
    return NextResponse.json(
      { error: "Failed to generate package" },
      { status: 500 },
    );
  }
}
