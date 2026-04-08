import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateOutreachDraft } from "@/lib/ai/outreach-draft";
import { formatCurrency } from "@/lib/utils";
import { generateAnalysis, getLatestAnalysis, editAnalysis, deleteAnalysis } from "@/lib/ai/analysis-manager";
import { z } from "zod";

/**
 * POST /api/ai/outreach-draft
 * Generate a personalized outreach letter for a listing's owner.
 *
 * Body: { listingId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, templateType, referralContactName } = body;

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

    const { result: analysis, cached } = await generateAnalysis({
      listingId,
      analysisType: "OUTREACH_DRAFT",
      cacheHours: 24,
      generateFn: async () => {
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
          // Template system fields
          templateType: templateType ?? undefined,
          targetRankLabel: listing.targetRankLabel ?? null,
          brokerName: listing.brokerName ?? null,
          brokerCompany: listing.brokerCompany ?? null,
          askingPrice: listing.askingPrice
            ? formatCurrency(Number(listing.askingPrice))
            : null,
          listingTitle: listing.title ?? null,
          referralContactName: referralContactName ?? null,
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

        return {
          resultData: result,
          inputTokens,
          outputTokens,
          modelUsed: "claude-sonnet-4-20250514",
        };
      },
    });

    return NextResponse.json({
      analysisId: analysis.id,
      draft: analysis.resultData,
      cached,
    });
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
 * Retrieve the latest cached outreach draft for a listing.
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

    const latest = await getLatestAnalysis({
      listingId,
      analysisType: "OUTREACH_DRAFT",
    });

    // Keep existing response shape (array of drafts) for frontend compat
    if (!latest) {
      return NextResponse.json({ drafts: [] });
    }

    return NextResponse.json({
      drafts: [
        {
          id: latest.id,
          draft: latest.resultData,
          createdAt: latest.createdAt,
        },
      ],
    });
  } catch (error) {
    console.error("Error fetching outreach drafts:", error);
    return NextResponse.json(
      { error: "Failed to fetch outreach drafts" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PATCH /api/ai/outreach-draft
//
// Updates an existing outreach draft's resultData.
// ─────────────────────────────────────────────

const patchSchema = z.object({
  analysisId: z.string(),
  listingId: z.string(),
  resultData: z.record(z.string(), z.unknown()),
});

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { analysisId, listingId, resultData } = parsed.data;

    // Verify the analysis belongs to this listing
    const existing = await prisma.aIAnalysisResult.findFirst({
      where: {
        id: analysisId,
        listingId,
        analysisType: "OUTREACH_DRAFT",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Outreach draft not found" },
        { status: 404 }
      );
    }

    const updated = await editAnalysis(analysisId, resultData);

    return NextResponse.json({
      analysisId: updated.id,
      result: updated.resultData,
    });
  } catch (err) {
    console.error("[outreach-draft] PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update outreach draft" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// DELETE /api/ai/outreach-draft
//
// Deletes a specific outreach draft by analysisId.
// ─────────────────────────────────────────────

const deleteSchema = z.object({
  analysisId: z.string(),
  listingId: z.string(),
});

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { analysisId, listingId } = parsed.data;

    // Verify the analysis belongs to this listing
    const existing = await prisma.aIAnalysisResult.findFirst({
      where: {
        id: analysisId,
        listingId,
        analysisType: "OUTREACH_DRAFT",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Outreach draft not found" },
        { status: 404 }
      );
    }

    await deleteAnalysis(analysisId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[outreach-draft] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete outreach draft" },
      { status: 500 }
    );
  }
}
