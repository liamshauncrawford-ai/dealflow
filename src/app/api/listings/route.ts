import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { MINIMUM_EBITDA, MINIMUM_SDE } from "@/lib/constants";
import { parseBody, parseSearchParams } from "@/lib/validations/common";
import { listingQuerySchema, createListingSchema } from "@/lib/validations/listings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(listingQuerySchema, searchParams);
    if (parsed.error) return parsed.error;

    const {
      page, pageSize, sortBy, sortDir, search, industry, city, state,
      metroArea, platform, showHidden, showInactive, meetsThreshold,
      minPrice, maxPrice, minEbitda, maxEbitda, minSde, maxSde,
      minRevenue, maxRevenue,
      tier, primaryTrade, minFitScore,
    } = parsed.data;

    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.ListingWhereInput = {
      ...(showHidden ? {} : { isHidden: false }),
      ...(showInactive ? {} : { isActive: true }),
    };

    // Search filter (across title, businessName, description, industry, brokerName)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { businessName: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { industry: { contains: search, mode: "insensitive" } },
        { brokerName: { contains: search, mode: "insensitive" } },
        { brokerCompany: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    if (industry) where.industry = { contains: industry, mode: "insensitive" };
    if (city) where.city = { contains: city, mode: "insensitive" };
    if (state) where.state = { equals: state, mode: "insensitive" };
    if (metroArea) where.metroArea = { contains: metroArea, mode: "insensitive" };

    // Platform filter (listings that have at least one source from this platform)
    if (platform) {
      where.sources = {
        some: {
          platform: platform as Prisma.EnumPlatformFilter,
        },
      };
    }

    // Price range
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.askingPrice = {
        ...(minPrice !== undefined ? { gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
      };
    }

    // EBITDA range (considers both reported and inferred)
    if (minEbitda !== undefined || maxEbitda !== undefined) {
      where.OR = [
        ...(where.OR || []),
        {
          ebitda: {
            ...(minEbitda !== undefined ? { gte: minEbitda } : {}),
            ...(maxEbitda !== undefined ? { lte: maxEbitda } : {}),
          },
        },
        {
          inferredEbitda: {
            ...(minEbitda !== undefined ? { gte: minEbitda } : {}),
            ...(maxEbitda !== undefined ? { lte: maxEbitda } : {}),
          },
        },
      ];
    }

    // SDE range (considers both reported and inferred)
    if (minSde !== undefined || maxSde !== undefined) {
      const sdeConditions = [];
      if (minSde !== undefined || maxSde !== undefined) {
        sdeConditions.push({
          sde: {
            ...(minSde !== undefined ? { gte: minSde } : {}),
            ...(maxSde !== undefined ? { lte: maxSde } : {}),
          },
        });
        sdeConditions.push({
          inferredSde: {
            ...(minSde !== undefined ? { gte: minSde } : {}),
            ...(maxSde !== undefined ? { lte: maxSde } : {}),
          },
        });
      }
      where.OR = [...(where.OR || []), ...sdeConditions];
    }

    // Revenue range
    if (minRevenue !== undefined || maxRevenue !== undefined) {
      where.revenue = {
        ...(minRevenue !== undefined ? { gte: minRevenue } : {}),
        ...(maxRevenue !== undefined ? { lte: maxRevenue } : {}),
      };
    }

    // Thesis filters
    if (tier) where.tier = tier;
    if (primaryTrade) where.primaryTrade = primaryTrade;
    if (minFitScore !== undefined) where.fitScore = { gte: minFitScore };

    // Threshold filter: only show listings that meet $600K EBITDA/SDE threshold
    if (meetsThreshold) {
      where.OR = [
        { ebitda: { gte: MINIMUM_EBITDA } },
        { sde: { gte: MINIMUM_SDE } },
        { inferredEbitda: { gte: MINIMUM_EBITDA } },
        { inferredSde: { gte: MINIMUM_SDE } },
        // Also include listings where we couldn't determine financials
        // (they may still qualify, user can review manually)
        {
          AND: [
            { ebitda: null },
            { sde: null },
            { inferredEbitda: null },
            { inferredSde: null },
          ],
        },
      ];
    }

    // Build orderBy (sortBy already validated by Zod schema)
    const orderBy: Prisma.ListingOrderByWithRelationInput = { [sortBy]: sortDir };

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          sources: true,
          tags: { include: { tag: true } },
          opportunity: true,
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.listing.count({ where }),
    ]);

    return NextResponse.json({
      listings,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching listings:", error);
    return NextResponse.json(
      { error: "Failed to fetch listings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(createListingSchema, request);
    if (parsed.error) return parsed.error;
    const { sourceUrl, platform: sourcePlatform, ...fields } = parsed.data;

    const listing = await prisma.listing.create({
      data: {
        ...fields,
        isManualEntry: true,
        sources: {
          create: {
            platform: sourcePlatform || "MANUAL",
            sourceUrl: sourceUrl || `manual://${Date.now()}`,
          },
        },
      },
      include: {
        sources: true,
        tags: { include: { tag: true } },
        opportunity: true,
      },
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    console.error("Error creating listing:", error);
    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 }
    );
  }
}
