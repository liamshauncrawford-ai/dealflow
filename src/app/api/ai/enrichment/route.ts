import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runEnrichment } from "@/lib/ai/enrichment";
import { formatCurrency } from "@/lib/utils";
import { generateAnalysis, getLatestAnalysis, editAnalysis, deleteAnalysis } from "@/lib/ai/analysis-manager";
import { z } from "zod";

/**
 * POST /api/ai/enrichment
 * Run company enrichment for a listing — AI analyzes existing data and fills gaps.
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

    // Mark as in-progress
    await prisma.listing.update({
      where: { id: listingId },
      data: { enrichmentStatus: "in_progress" },
    });

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        opportunity: {
          include: { contacts: { where: { isPrimary: true }, take: 1 } },
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
      analysisType: "ENRICHMENT",
      cacheHours: 24,
      generateFn: async () => {
        const primaryContact = listing.opportunity?.contacts?.[0];

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
          listing.revenue
            ? `Revenue: ${formatCurrency(Number(listing.revenue))}`
            : null,
          listing.ebitda
            ? `EBITDA: ${formatCurrency(Number(listing.ebitda))}`
            : null,
          listing.established
            ? `Established: ${listing.established}`
            : null,
          listing.employees ? `Employees: ${listing.employees}` : null,
          (listing.certifications as string[])?.length
            ? `Certifications: ${(listing.certifications as string[]).join(", ")}`
            : null,
          listing.website ? `Website: ${listing.website}` : null,
          listing.reasonForSale ? `Reason for Sale: ${listing.reasonForSale}` : null,
          primaryContact?.name ? `Known Contact: ${primaryContact.name}` : null,
          primaryContact?.estimatedAgeRange
            ? `Contact Age Estimate: ${primaryContact.estimatedAgeRange}`
            : null,
        ].filter(Boolean) as string[];

        const { result, inputTokens, outputTokens } = await runEnrichment({
          companyName: listing.businessName || listing.title,
          companyData: dataLines.join("\n"),
        });

        // Apply enrichment to listing (only fill gaps, don't overwrite existing data)
        const updates: Record<string, unknown> = {
          enrichmentStatus: "complete",
          enrichmentDate: new Date(),
        };

        if (!listing.established && result.estimated_founding_year) {
          updates.established = result.estimated_founding_year;
        }
        if (!listing.employees && result.estimated_employee_count) {
          updates.employees = result.estimated_employee_count;
        }

        await prisma.listing.update({
          where: { id: listingId },
          data: updates,
        });

        // If we got owner info and there's an opportunity with no primary contact, create one
        if (
          result.owner_names.length > 0 &&
          listing.opportunity &&
          !primaryContact
        ) {
          const owner = result.owner_names[0];
          await prisma.contact.create({
            data: {
              opportunityId: listing.opportunity.id,
              name: owner.name,
              role: owner.title,
              estimatedAgeRange: owner.estimated_age,
              isPrimary: true,
            },
          });
        }

        // Check for significant score change — create notification if score changes by 10+
        const previousScore = listing.compositeScore ?? listing.fitScore;
        if (previousScore != null) {
          // Trigger score recomputation
          try {
            await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/listings/${listingId}/score`,
              { method: "POST" }
            );
          } catch {
            // Non-critical — score will be recalculated on next view
          }
        }

        // Log agent run
        await prisma.aIAgentRun.create({
          data: {
            agentName: "enrichment",
            status: "success",
            itemsProcessed: 1,
            itemsUpdated: 1,
            apiCallsMade: 1,
            totalTokens: inputTokens + outputTokens,
            totalCost:
              (inputTokens / 1_000_000) * 3.0 +
              (outputTokens / 1_000_000) * 15.0,
            summary: `Enrichment for ${listing.businessName || listing.title}`,
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
      enrichment: analysis.resultData,
      inputTokens: analysis.inputTokens,
      outputTokens: analysis.outputTokens,
      cached,
    });
  } catch (error) {
    console.error("Enrichment error:", error);

    // Mark as failed
    try {
      const body = await request.clone().json();
      if (body.listingId) {
        await prisma.listing.update({
          where: { id: body.listingId },
          data: { enrichmentStatus: "failed" },
        });
      }
    } catch {
      // Best effort
    }

    return NextResponse.json(
      {
        error: "Failed to run enrichment",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/enrichment?listingId=xxx
 * Retrieve the most recent enrichment result for a listing.
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

    const cached = await getLatestAnalysis({
      listingId,
      analysisType: "ENRICHMENT",
    });

    if (!cached) {
      return NextResponse.json({ enrichment: null });
    }

    return NextResponse.json({
      analysisId: cached.id,
      enrichment: cached.resultData,
      createdAt: cached.createdAt,
    });
  } catch (error) {
    console.error("Error fetching enrichment:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrichment" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PATCH /api/ai/enrichment
//
// Updates an existing enrichment's resultData.
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
        analysisType: "ENRICHMENT",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Enrichment analysis not found" },
        { status: 404 }
      );
    }

    const updated = await editAnalysis(analysisId, resultData);

    return NextResponse.json({
      analysisId: updated.id,
      result: updated.resultData,
    });
  } catch (err) {
    console.error("[enrichment] PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update enrichment analysis" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// DELETE /api/ai/enrichment
//
// Deletes a specific enrichment analysis by analysisId.
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
        analysisType: "ENRICHMENT",
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Enrichment analysis not found" },
        { status: 404 }
      );
    }

    await deleteAnalysis(analysisId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[enrichment] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete enrichment analysis" },
      { status: 500 }
    );
  }
}
