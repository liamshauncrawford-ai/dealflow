import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

function formatDecimal(value: Prisma.Decimal | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Filters
    const search = searchParams.get("search") || undefined;
    const industry = searchParams.get("industry") || undefined;
    const city = searchParams.get("city") || undefined;
    const state = searchParams.get("state") || undefined;
    const platform = searchParams.get("platform") || undefined;
    const hideHidden = searchParams.get("hideHidden");

    const minPrice = searchParams.get("minPrice")
      ? parseFloat(searchParams.get("minPrice")!)
      : undefined;
    const maxPrice = searchParams.get("maxPrice")
      ? parseFloat(searchParams.get("maxPrice")!)
      : undefined;
    const minEbitda = searchParams.get("minEbitda")
      ? parseFloat(searchParams.get("minEbitda")!)
      : undefined;

    // Build where clause
    const where: Prisma.ListingWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { businessName: { contains: search, mode: "insensitive" } },
        { industry: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    if (industry) where.industry = { contains: industry, mode: "insensitive" };
    if (city) where.city = { contains: city, mode: "insensitive" };
    if (state) where.state = state;

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.askingPrice = {
        ...(minPrice !== undefined ? { gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
      };
    }

    if (minEbitda !== undefined) {
      where.ebitda = { ...(where.ebitda as object ?? {}), gte: minEbitda };
    }

    if (platform) {
      where.sources = {
        some: {
          platform: platform as Prisma.EnumPlatformFilter,
        },
      };
    }

    // Default: hide hidden listings unless explicitly set to "false"
    if (hideHidden !== "false") {
      where.isHidden = false;
    }

    // Fetch all matching listings (no pagination)
    const listings = await prisma.listing.findMany({
      where,
      include: {
        sources: true,
      },
      orderBy: { lastSeenAt: "desc" },
    });

    // CSV header row
    const headers = [
      "Title",
      "Business Name",
      "Asking Price",
      "Revenue",
      "EBITDA",
      "SDE",
      "Cash Flow",
      "Industry",
      "Category",
      "City",
      "State",
      "County",
      "Zip",
      "Broker Name",
      "Broker Company",
      "Broker Phone",
      "Broker Email",
      "Employees",
      "Established",
      "Seller Financing",
      "Listed Date",
      "Last Seen",
      "Sources",
      "Source URLs",
    ];

    // Build CSV rows
    const rows = listings.map((listing) => {
      const sourcePlatforms = listing.sources
        .map((s) => s.platform)
        .join(", ");
      const sourceUrls = listing.sources
        .map((s) => s.sourceUrl)
        .join(", ");

      return [
        escapeCsvField(listing.title),
        escapeCsvField(listing.businessName),
        escapeCsvField(formatDecimal(listing.askingPrice)),
        escapeCsvField(formatDecimal(listing.revenue)),
        escapeCsvField(formatDecimal(listing.ebitda)),
        escapeCsvField(formatDecimal(listing.sde)),
        escapeCsvField(formatDecimal(listing.cashFlow)),
        escapeCsvField(listing.industry),
        escapeCsvField(listing.category),
        escapeCsvField(listing.city),
        escapeCsvField(listing.state),
        escapeCsvField(listing.county),
        escapeCsvField(listing.zipCode),
        escapeCsvField(listing.brokerName),
        escapeCsvField(listing.brokerCompany),
        escapeCsvField(listing.brokerPhone),
        escapeCsvField(listing.brokerEmail),
        escapeCsvField(listing.employees),
        escapeCsvField(listing.established),
        escapeCsvField(listing.sellerFinancing),
        escapeCsvField(formatDate(listing.listingDate)),
        escapeCsvField(formatDate(listing.lastSeenAt)),
        escapeCsvField(sourcePlatforms),
        escapeCsvField(sourceUrls),
      ].join(",");
    });

    // Combine header and rows
    const csv = [headers.join(","), ...rows].join("\n");

    // Generate filename with current date
    const today = new Date().toISOString().split("T")[0];
    const filename = `dealflow-listings-${today}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting listings:", error);
    return NextResponse.json(
      { error: "Failed to export listings" },
      { status: 500 }
    );
  }
}
