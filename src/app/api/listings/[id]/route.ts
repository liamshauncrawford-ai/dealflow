import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { updateListingSchema } from "@/lib/validations/listings";
import { computeFitScore, type FitScoreInput } from "@/lib/scoring";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        sources: true,
        tags: { include: { tag: true } },
        opportunity: {
          include: {
            stageHistory: { orderBy: { createdAt: "desc" } },
            notes: { orderBy: { createdAt: "desc" } },
            contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          },
        },
        notes: { orderBy: { createdAt: "desc" } },
        dedupGroup: {
          include: {
            listings: {
              where: { id: { not: id } },
              include: { sources: true },
            },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error("Error fetching listing:", error);
    return NextResponse.json(
      { error: "Failed to fetch listing" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(updateListingSchema, request);
    if (parsed.error) return parsed.error;

    // Build update from validated data
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const listing = await prisma.listing.update({
      where: { id },
      data: updateData,
      include: {
        sources: true,
        tags: { include: { tag: true } },
        opportunity: {
          include: {
            contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          },
        },
      },
    });

    // Auto-recompute fitScore when thesis-relevant fields change
    const thesisFields = [
      "primaryTrade", "secondaryTrades", "revenue", "established", "state",
      "metroArea", "certifications", "dcCertifications", "dcRelevanceScore",
      "askingPrice", "ebitda", "inferredEbitda", "targetMultipleHigh", "tier",
    ];
    const hasThesisChange = thesisFields.some(f => f in updateData);
    if (hasThesisChange) {
      const primaryContact = listing.opportunity?.contacts?.find((c: { isPrimary: boolean }) => c.isPrimary)
        || listing.opportunity?.contacts?.[0];

      const scoreInput: FitScoreInput = {
        primaryTrade: listing.primaryTrade,
        secondaryTrades: listing.secondaryTrades as string[],
        revenue: listing.revenue ? Number(listing.revenue) : null,
        established: listing.established,
        state: listing.state,
        metroArea: listing.metroArea,
        certifications: listing.certifications as string[],
        dcCertifications: listing.dcCertifications as string[],
        dcRelevanceScore: listing.dcRelevanceScore,
        askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
        ebitda: listing.ebitda ? Number(listing.ebitda) : null,
        inferredEbitda: listing.inferredEbitda ? Number(listing.inferredEbitda) : null,
        targetMultipleLow: listing.targetMultipleLow,
        targetMultipleHigh: listing.targetMultipleHigh,
        estimatedAgeRange: primaryContact?.estimatedAgeRange ?? null,
        keyPersonRisk: listing.opportunity?.keyPersonRisk ?? null,
        recurringRevenuePct: listing.opportunity?.recurringRevenuePct ?? null,
      };

      const { fitScore } = computeFitScore(scoreInput);
      await prisma.listing.update({
        where: { id },
        data: { fitScore },
      });
      (listing as Record<string, unknown>).fitScore = fitScore;
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error("Error updating listing:", error);
    return NextResponse.json(
      { error: "Failed to update listing" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete: mark as inactive
    const listing = await prisma.listing.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(listing);
  } catch (error) {
    console.error("Error deleting listing:", error);
    return NextResponse.json(
      { error: "Failed to delete listing" },
      { status: 500 }
    );
  }
}
