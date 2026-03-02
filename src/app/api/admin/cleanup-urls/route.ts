import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/cleanup-urls
 *
 * One-off admin endpoint to clean corrupted listing data where HTML attributes
 * or raw URLs leaked into text fields (title, businessName, city, state).
 *
 * Idempotent — safe to call multiple times.
 */

function sanitize(text: string): string {
  // Remove HTML-attribute-like patterns: attr="value"
  let cleaned = text.replace(/\w+="[^"]*"/g, "");
  // Remove standalone URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "");
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");
  // Collapse whitespace and trim
  return cleaned.replace(/\s+/g, " ").trim();
}

export async function POST() {
  try {
    // Find listings with URL/HTML artifacts in key text fields
    const corrupted = await prisma.listing.findMany({
      where: {
        OR: [
          { title: { contains: "href=" } },
          { title: { contains: "http://" } },
          { title: { contains: "https://" } },
          { businessName: { contains: "href=" } },
          { businessName: { contains: "http://" } },
          { businessName: { contains: "https://" } },
          { city: { contains: "http" } },
          { city: { contains: "href=" } },
          { state: { contains: "http" } },
          { state: { contains: "href=" } },
        ],
      },
      select: {
        id: true,
        title: true,
        businessName: true,
        city: true,
        state: true,
      },
    });

    const results: Array<{ id: string; field: string; before: string; after: string | null }> = [];
    let fixed = 0;

    for (const listing of corrupted) {
      const updates: Record<string, string | null> = {};

      // Sanitize title
      if (listing.title && (/href=/i.test(listing.title) || /https?:\/\//i.test(listing.title))) {
        const cleaned = sanitize(listing.title);
        updates.title = cleaned || "Untitled Listing";
        results.push({ id: listing.id, field: "title", before: listing.title.slice(0, 80), after: updates.title });
      }

      // Sanitize businessName — null it out if entirely a URL
      if (listing.businessName && (/href=/i.test(listing.businessName) || /https?:\/\//i.test(listing.businessName))) {
        const cleaned = sanitize(listing.businessName);
        updates.businessName = cleaned || null;
        results.push({ id: listing.id, field: "businessName", before: listing.businessName.slice(0, 80), after: updates.businessName });
      }

      // Sanitize city — null it out if corrupted
      if (listing.city && (/http/i.test(listing.city) || /href=/i.test(listing.city))) {
        updates.city = null;
        results.push({ id: listing.id, field: "city", before: listing.city, after: null });
      }

      // Sanitize state — null it out if corrupted
      if (listing.state && (/http/i.test(listing.state) || /href=/i.test(listing.state))) {
        updates.state = null;
        results.push({ id: listing.id, field: "state", before: listing.state, after: null });
      }

      if (Object.keys(updates).length > 0) {
        await prisma.listing.update({
          where: { id: listing.id },
          data: updates,
        });
        fixed++;
      }
    }

    // Also backfill compositeScore where missing
    const backfilled = await prisma.$executeRaw`
      UPDATE "Listing"
      SET "compositeScore" = "fitScore"
      WHERE "compositeScore" IS NULL
        AND "fitScore" IS NOT NULL
    `;

    return NextResponse.json({
      message: "Cleanup complete",
      corruptedFound: corrupted.length,
      listingsFixed: fixed,
      compositeScoreBackfilled: Number(backfilled),
      details: results,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: String(error) },
      { status: 500 },
    );
  }
}
