import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { loadThesisConfig } from "@/lib/thesis-loader";
import { THESIS_KEYS } from "@/lib/thesis-defaults";

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

const patchSchema = z.object({
  pipelineValueStages: z
    .array(z.string())
    .min(1, "At least one stage must be selected")
    .optional(),
  platformListingId: z.string().nullable().optional(),
  platformOpportunityId: z.string().nullable().optional(),
  exitMultipleLow: z.number().min(1).max(50).optional(),
  exitMultipleHigh: z.number().min(1).max(50).optional(),
  minimumEbitda: z.number().min(0).optional(),
  minimumSde: z.number().min(0).optional(),
  fitScoreWeights: z.record(z.string(), z.number().min(0).max(1)).optional(),
});

// ─────────────────────────────────────────────
// GET /api/settings/thesis
// ─────────────────────────────────────────────

export async function GET() {
  try {
    const config = await loadThesisConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching thesis config:", error);
    return NextResponse.json(
      { error: "Failed to fetch thesis configuration" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PATCH /api/settings/thesis
// ─────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates = parsed.data;

    // Validate exit multiples relationship
    if (updates.exitMultipleLow !== undefined && updates.exitMultipleHigh !== undefined) {
      if (updates.exitMultipleLow > updates.exitMultipleHigh) {
        return NextResponse.json(
          { error: "Exit multiple low must be less than or equal to high" },
          { status: 400 }
        );
      }
    }

    // Validate fit score weights sum to ~1.0 if provided
    if (updates.fitScoreWeights) {
      const sum = Object.values(updates.fitScoreWeights).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        return NextResponse.json(
          { error: `Fit score weights must sum to 1.0 (currently ${sum.toFixed(2)})` },
          { status: 400 }
        );
      }
    }

    // Handle platform change — resolve opportunity to listing, then update tier flags
    if (updates.platformOpportunityId !== undefined) {
      const resolvedListingId = await resolveOpportunityToListing(updates.platformOpportunityId);
      updates.platformListingId = resolvedListingId;
      await handlePlatformChange(resolvedListingId);
    } else if (updates.platformListingId !== undefined) {
      // Legacy path: direct listing ID (for backward compatibility)
      await handlePlatformChange(updates.platformListingId);
    }

    // Upsert each changed key into AppSetting
    const upserts = [];
    for (const [field, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      const dbKey = THESIS_KEYS[field as keyof typeof THESIS_KEYS];
      if (!dbKey) continue;

      upserts.push(
        prisma.appSetting.upsert({
          where: { key: dbKey },
          create: { key: dbKey, value: JSON.stringify(value) },
          update: { value: JSON.stringify(value) },
        })
      );
    }

    await Promise.all(upserts);

    // Return the updated full config
    const config = await loadThesisConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating thesis config:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update thesis configuration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// Platform Company Change Handler
// ─────────────────────────────────────────────

/**
 * Resolve an opportunity ID to a listing ID.
 *
 * If the opportunity already has an associated listing, returns that ID.
 * If not, auto-creates a minimal listing from the opportunity data and links them.
 * Returns null if the opportunity ID is null (clearing the platform).
 */
async function resolveOpportunityToListing(opportunityId: string | null): Promise<string | null> {
  if (!opportunityId) return null;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true,
      listingId: true,
      title: true,
      description: true,
      actualRevenue: true,
      actualEbitda: true,
    },
  });

  if (!opportunity) {
    throw new Error("Opportunity not found");
  }

  // Already has a listing — use it
  if (opportunity.listingId) {
    return opportunity.listingId;
  }

  // No listing yet — create one from opportunity data and link it
  const listing = await prisma.listing.create({
    data: {
      title: opportunity.title,
      description: opportunity.description,
      revenue: opportunity.actualRevenue,
      ebitda: opportunity.actualEbitda,
      tier: "TIER_1_ACTIVE", // will be set to OWNED by handlePlatformChange
      opportunity: { connect: { id: opportunity.id } },
    },
  });

  return listing.id;
}

async function handlePlatformChange(newPlatformId: string | null) {
  // Remove OWNED tier from current platform listing(s)
  await prisma.listing.updateMany({
    where: { tier: "OWNED" },
    data: { tier: "TIER_1_ACTIVE" },
  });

  // Set the new listing as OWNED (if a listing ID was provided)
  if (newPlatformId) {
    const listing = await prisma.listing.findUnique({
      where: { id: newPlatformId },
      select: { id: true },
    });

    if (!listing) {
      throw new Error("Platform listing not found");
    }

    await prisma.listing.update({
      where: { id: newPlatformId },
      data: { tier: "OWNED" },
    });
  }
}
