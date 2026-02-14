import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { parseSearchParams } from "@/lib/validations/common";
import { contactsQuerySchema } from "@/lib/validations/pipeline";

/**
 * GET /api/contacts
 * Cross-opportunity contacts list with filtering, sorting, and pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(contactsQuerySchema, searchParams);
    if (parsed.error) return parsed.error;

    const {
      page, pageSize, sortBy, sortDir,
      search, interestLevel, outreachStatus, sentiment, dealStage, overdueOnly,
    } = parsed.data;

    // Build where clause
    const where: Prisma.ContactWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ];
    }

    if (interestLevel) {
      where.interestLevel = interestLevel as Prisma.EnumContactInterestFilter;
    }
    if (outreachStatus) {
      where.outreachStatus = outreachStatus as Prisma.EnumOutreachStatusNullableFilter;
    }
    if (sentiment) {
      where.sentiment = sentiment as Prisma.EnumContactSentimentNullableFilter;
    }
    if (dealStage) {
      where.opportunity = {
        stage: dealStage as Prisma.EnumPipelineStageFilter,
      };
    }
    if (overdueOnly) {
      where.nextFollowUpDate = { lt: new Date() };
    }

    // Build orderBy
    const orderBy: Prisma.ContactOrderByWithRelationInput = {
      [sortBy]: sortDir,
    };

    const skip = (page - 1) * pageSize;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          opportunity: {
            select: {
              id: true,
              title: true,
              stage: true,
              priority: true,
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({
      contacts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}
