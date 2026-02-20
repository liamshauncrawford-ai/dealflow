import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateOutreachDraft } from "@/lib/ai/outreach-draft";
import { formatCurrency } from "@/lib/utils";

/**
 * POST /api/ai/outreach-draft
 * Generate a personalized outreach letter for a listing's owner.
 *
 * Body: { listingId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId } = body;

    if (!listingId || typeof listingId !== "string") {
      return NextResponse.json(
        { error: "listingId is required" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        opportunity: {
          include: {
            contacts: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    const primaryContact = listing.opportunity?.contacts?.[0];

    const { result, inputTokens, outputTokens } = await generateOutreachDraft({
      ownerName: primaryContact?.name ?? null,
      estimatedAge: primaryContact?.estimatedAgeRange ?? null,
      companyName: listing.businessName || listing.title,
      yearsInBusiness: listing.established
        ? new Date().getFullYear() - listing.established
        : null,
      primaryTrade: listing.primaryTrade,
      city: listing.city,
      state: listing.state,
      revenue: listing.revenue
        ? formatCurrency(Number(listing.revenue))
        : null,
      certifications: (listing.certifications as string[]) ?? [],
      knownProjects: listing.synergyNotes,
      additionalContext: null,
    });

    // Cache the result
    await prisma.aIAnalysisResult.create({
      data: {
        listingId,
        analysisType: "OUTREACH_DRAFT",
        resultData: result as object,
        modelUsed: "claude-sonnet-4-20250514",
        inputTokens,
        outputTokens,
      },
    });

    // Log the agent run
    await prisma.aIAgentRun.create({
      data: {
        agentName: "outreach_draft",
        status: "success",
        itemsProcessed: 1,
        apiCallsMade: 1,
        totalTokens: inputTokens + outputTokens,
        totalCost:
          (inputTokens / 1_000_000) * 3.0 +
          (outputTokens / 1_000_000) * 15.0,
        summary: `Outreach draft for ${listing.businessName || listing.title}`,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ draft: result });
  } catch (error) {
    console.error("Outreach draft error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate outreach draft",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/outreach-draft?listingId=xxx
 * Retrieve all cached outreach drafts for a listing.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");

    if (!listingId) {
      return NextResponse.json(
        { error: "listingId query param is required" },
        { status: 400 }
      );
    }

    const drafts = await prisma.aIAnalysisResult.findMany({
      where: { listingId, analysisType: "OUTREACH_DRAFT" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      drafts: drafts.map((d) => ({
        id: d.id,
        draft: d.resultData,
        createdAt: d.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching outreach drafts:", error);
    return NextResponse.json(
      { error: "Failed to fetch outreach drafts" },
      { status: 500 }
    );
  }
}
