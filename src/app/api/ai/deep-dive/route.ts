import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runDeepDive } from "@/lib/ai/deep-dive";
import { formatCurrency } from "@/lib/utils";

/**
 * POST /api/ai/deep-dive
 * Run an AI-powered investment memo ("Deep Dive") for a listing.
 *
 * Body: { listingId: string }
 * Returns the structured DeepDiveResult + caches it in AIAnalysisResult.
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

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 503 }
      );
    }

    // Fetch the listing with all related data
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        sources: true,
        tags: { include: { tag: true } },
        opportunity: {
          include: {
            contacts: true,
            notes: { orderBy: { createdAt: "desc" }, take: 10 },
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

    // Build the company data string from all available fields
    const primaryContact = listing.opportunity?.contacts?.find(
      (c) => c.isPrimary
    );

    const dataLines: string[] = [
      `Business Name: ${listing.businessName || listing.title}`,
      listing.description ? `Description: ${listing.description}` : null,
      listing.primaryTrade ? `Primary Trade: ${listing.primaryTrade}` : null,
      (listing.secondaryTrades as string[])?.length
        ? `Secondary Trades: ${(listing.secondaryTrades as string[]).join(", ")}`
        : null,
      listing.city || listing.state
        ? `Location: ${[listing.city, listing.state].filter(Boolean).join(", ")}`
        : null,
      listing.metroArea ? `Metro Area: ${listing.metroArea}` : null,
      listing.revenue
        ? `Revenue: ${formatCurrency(Number(listing.revenue))}`
        : null,
      listing.ebitda
        ? `EBITDA: ${formatCurrency(Number(listing.ebitda))}`
        : null,
      listing.inferredEbitda
        ? `Inferred EBITDA: ${formatCurrency(Number(listing.inferredEbitda))}`
        : null,
      listing.sde
        ? `SDE: ${formatCurrency(Number(listing.sde))}`
        : null,
      listing.askingPrice
        ? `Asking Price: ${formatCurrency(Number(listing.askingPrice))}`
        : null,
      listing.established
        ? `Established: ${listing.established} (${new Date().getFullYear() - listing.established} years)`
        : null,
      listing.employees ? `Employees: ${listing.employees}` : null,
      (listing.certifications as string[])?.length
        ? `Certifications: ${(listing.certifications as string[]).join(", ")}`
        : null,
      (listing.dcCertifications as string[])?.length
        ? `DC-Specific Certifications: ${(listing.dcCertifications as string[]).join(", ")}`
        : null,
      listing.dcExperience != null
        ? `Data Center Experience: ${listing.dcExperience ? "Yes" : "No"}`
        : null,
      listing.dcRelevanceScore
        ? `DC Relevance Score: ${listing.dcRelevanceScore}/10`
        : null,
      listing.tier ? `Tier: ${listing.tier}` : null,
      listing.sellerFinancing != null
        ? `Seller Financing Available: ${listing.sellerFinancing ? "Yes" : "Unknown"}`
        : null,
      listing.reasonForSale
        ? `Reason for Sale: ${listing.reasonForSale}`
        : null,
      listing.facilities
        ? `Facilities: ${listing.facilities}`
        : null,
      listing.bonded != null ? `Bonded: ${listing.bonded ? "Yes" : "No"}` : null,
      listing.insured != null ? `Insured: ${listing.insured ? "Yes" : "No"}` : null,
      listing.website ? `Website: ${listing.website}` : null,
      listing.compositeScore != null
        ? `Current Composite Score: ${listing.compositeScore}/100`
        : null,
      listing.thesisAlignment
        ? `Thesis Alignment: ${listing.thesisAlignment}`
        : null,
      listing.synergyNotes
        ? `Synergy Notes: ${listing.synergyNotes}`
        : null,
      // Contact info
      primaryContact?.name
        ? `Primary Contact: ${primaryContact.name}`
        : null,
      primaryContact?.role ? `Contact Role: ${primaryContact.role}` : null,
      primaryContact?.estimatedAgeRange
        ? `Estimated Owner Age: ${primaryContact.estimatedAgeRange}`
        : null,
      // Broker info
      listing.brokerName ? `Broker: ${listing.brokerName}` : null,
      listing.brokerCompany
        ? `Broker Company: ${listing.brokerCompany}`
        : null,
    ].filter(Boolean) as string[];

    // Recent activity from notes
    const recentActivity = listing.opportunity?.notes
      ?.slice(0, 5)
      .map(
        (n) =>
          `[${new Date(n.createdAt).toLocaleDateString()}] ${n.content?.slice(0, 200)}`
      )
      .join("\n");

    // Run the deep dive
    const { result, inputTokens, outputTokens } = await runDeepDive({
      companyName: listing.businessName || listing.title,
      companyData: dataLines.join("\n"),
      recentActivity: recentActivity || undefined,
    });

    // Cache the result
    await prisma.aIAnalysisResult.create({
      data: {
        listingId,
        analysisType: "DEEP_DIVE",
        resultData: result as object,
        modelUsed: "claude-sonnet-4-20250514",
        inputTokens,
        outputTokens,
      },
    });

    // Update listing enrichment status
    await prisma.listing.update({
      where: { id: listingId },
      data: {
        enrichmentStatus: "complete",
        enrichmentDate: new Date(),
      },
    });

    // Log the agent run
    await prisma.aIAgentRun.create({
      data: {
        agentName: "deep_dive",
        status: "success",
        itemsProcessed: 1,
        apiCallsMade: 1,
        totalTokens: inputTokens + outputTokens,
        totalCost:
          (inputTokens / 1_000_000) * 3.0 +
          (outputTokens / 1_000_000) * 15.0,
        summary: `Deep dive analysis for ${listing.businessName || listing.title}`,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      analysis: result,
      inputTokens,
      outputTokens,
      cached: false,
    });
  } catch (error) {
    console.error("Deep dive error:", error);

    // Log failed run
    try {
      await prisma.aIAgentRun.create({
        data: {
          agentName: "deep_dive",
          status: "error",
          errorMessage:
            error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
    } catch {
      // Don't fail the response if logging fails
    }

    return NextResponse.json(
      {
        error: "Failed to run deep dive analysis",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/deep-dive?listingId=xxx
 * Retrieve the most recent cached deep dive for a listing.
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

    const cached = await prisma.aIAnalysisResult.findFirst({
      where: { listingId, analysisType: "DEEP_DIVE" },
      orderBy: { createdAt: "desc" },
    });

    if (!cached) {
      return NextResponse.json({ analysis: null, cached: false });
    }

    return NextResponse.json({
      analysis: cached.resultData,
      createdAt: cached.createdAt,
      inputTokens: cached.inputTokens,
      outputTokens: cached.outputTokens,
      cached: true,
    });
  } catch (error) {
    console.error("Error fetching cached deep dive:", error);
    return NextResponse.json(
      { error: "Failed to fetch deep dive" },
      { status: 500 }
    );
  }
}
