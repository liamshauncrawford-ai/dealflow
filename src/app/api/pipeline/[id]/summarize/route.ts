import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { callClaude, isAIEnabled } from "@/lib/ai/claude-client";

// ─────────────────────────────────────────────
// POST /api/pipeline/[id]/summarize
//
// Generates a concise AI-powered description for a pipeline opportunity
// using available listing data. Saves to opportunity.description.
//
// Uses Claude Haiku for fast, cheap generation (~$0.001 per call).
// ─────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: "AI features are not configured (missing ANTHROPIC_API_KEY)" },
        { status: 503 },
      );
    }

    const { id: opportunityId } = await params;

    // Load opportunity with linked listing
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        listing: {
          select: {
            title: true,
            businessName: true,
            description: true,
            industry: true,
            category: true,
            primaryTrade: true,
            city: true,
            state: true,
            askingPrice: true,
            revenue: true,
            ebitda: true,
            inferredEbitda: true,
            sde: true,
            cashFlow: true,
            employees: true,
            established: true,
            website: true,
            reasonForSale: true,
            certifications: true,
          },
        },
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    if (!opportunity.listing) {
      return NextResponse.json(
        { error: "No linked listing to generate description from" },
        { status: 400 },
      );
    }

    const listing = opportunity.listing;

    // Build context from available listing data
    const details: string[] = [];

    if (listing.businessName) details.push(`Business name: ${listing.businessName}`);
    if (listing.title) details.push(`Listing title: ${listing.title}`);
    if (listing.description) {
      // Truncate very long descriptions to save tokens
      const desc = listing.description.length > 1500
        ? listing.description.slice(0, 1500) + "..."
        : listing.description;
      details.push(`Original description: ${desc}`);
    }
    if (listing.industry) details.push(`Industry: ${listing.industry}`);
    if (listing.category) details.push(`Category: ${listing.category}`);
    if (listing.primaryTrade) details.push(`Primary trade: ${listing.primaryTrade}`);

    const location = [listing.city, listing.state].filter(Boolean).join(", ");
    if (location) details.push(`Location: ${location}`);

    if (listing.askingPrice) details.push(`Asking price: $${Number(listing.askingPrice).toLocaleString()}`);
    if (listing.revenue) details.push(`Revenue: $${Number(listing.revenue).toLocaleString()}`);

    const ebitda = listing.ebitda ?? listing.inferredEbitda;
    if (ebitda) details.push(`EBITDA: $${Number(ebitda).toLocaleString()}${!listing.ebitda ? " (estimated)" : ""}`);
    if (listing.sde) details.push(`SDE: $${Number(listing.sde).toLocaleString()}`);
    if (listing.cashFlow) details.push(`Cash flow: $${Number(listing.cashFlow).toLocaleString()}`);

    if (listing.employees) details.push(`Employees: ${listing.employees}`);
    if (listing.established) details.push(`Established: ${listing.established}`);
    if (listing.website) details.push(`Website: ${listing.website}`);
    if (listing.reasonForSale) details.push(`Reason for sale: ${listing.reasonForSale}`);
    if (listing.certifications?.length) details.push(`Certifications: ${listing.certifications.join(", ")}`);

    const response = await callClaude({
      model: "haiku",
      system:
        "You are a business acquisition analyst writing concise pipeline card descriptions for a CRM. " +
        "Write a 2-3 sentence description that captures the most important aspects of the acquisition opportunity: " +
        "what the business does, its key financial metrics, location, and anything notable. " +
        "Be factual and direct. Do not use marketing language. Do not include the business name in the description (it's already in the title). " +
        "Output only the description text with no headers, labels, or formatting.",
      messages: [
        {
          role: "user",
          content: `Generate a concise CRM pipeline description for this acquisition opportunity:\n\n${details.join("\n")}`,
        },
      ],
      maxTokens: 256,
      temperature: 0.3,
    });

    const description = response.text.trim();

    // Save to opportunity
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { description },
    });

    return NextResponse.json({ description });
  } catch (err) {
    console.error("[summarize] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
