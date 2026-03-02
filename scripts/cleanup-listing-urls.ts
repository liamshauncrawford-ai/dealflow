/**
 * One-off script: clean corrupted listing data where HTML attributes
 * or raw URLs leaked into text fields (title, businessName, city, state).
 *
 * Usage: npx tsx scripts/cleanup-listing-urls.ts
 */

import { config } from "dotenv";
config({ override: true });

function sanitize(text: string): string {
  // Remove HTML-attribute-like patterns: attr="value"
  let cleaned = text.replace(/\w+="[^"]*"/g, "");
  // Remove standalone URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "");
  // Collapse whitespace and trim
  return cleaned.replace(/\s+/g, " ").trim();
}

async function main() {
  const { prisma } = await import("../src/lib/db");

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

  console.log(`Found ${corrupted.length} listings with URL artifacts`);

  let fixed = 0;
  for (const listing of corrupted) {
    const updates: Record<string, string | null> = {};

    // Sanitize title
    if (listing.title && (/href=/i.test(listing.title) || /https?:\/\//i.test(listing.title))) {
      const cleaned = sanitize(listing.title);
      updates.title = cleaned || "Untitled Listing";
      console.log(`  [${listing.id}] title: "${listing.title.slice(0, 60)}..." → "${updates.title}"`);
    }

    // Sanitize businessName — null it out if entirely a URL
    if (listing.businessName && (/href=/i.test(listing.businessName) || /https?:\/\//i.test(listing.businessName))) {
      const cleaned = sanitize(listing.businessName);
      updates.businessName = cleaned || null;
      console.log(`  [${listing.id}] businessName: "${listing.businessName.slice(0, 60)}..." → "${updates.businessName}"`);
    }

    // Sanitize city — null it out if corrupted
    if (listing.city && (/http/i.test(listing.city) || /href=/i.test(listing.city))) {
      updates.city = null;
      console.log(`  [${listing.id}] city: "${listing.city}" → null`);
    }

    // Sanitize state — null it out if corrupted
    if (listing.state && (/http/i.test(listing.state) || /href=/i.test(listing.state))) {
      updates.state = null;
      console.log(`  [${listing.id}] state: "${listing.state}" → null`);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: updates,
      });
      fixed++;
    }
  }

  console.log(`\nCleaned ${fixed} listings`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
