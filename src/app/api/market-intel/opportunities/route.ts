import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { parseBody, parseSearchParams } from "@/lib/validations/common";
import { cablingQuerySchema, createCablingSchema } from "@/lib/validations/market-intel";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(cablingQuerySchema, searchParams);
    if (parsed.error) return parsed.error;

    const { page, pageSize, search, status, operatorId, gcId, sortBy, sortDir } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CablingOpportunityWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { facilityAddress: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) where.status = status as Prisma.EnumCablingOpportunityStatusFilter;
    if (operatorId) where.operatorId = operatorId;
    if (gcId) where.gcId = gcId;

    const orderBy: Prisma.CablingOpportunityOrderByWithRelationInput = { [sortBy]: sortDir };

    const [opportunities, total] = await Promise.all([
      prisma.cablingOpportunity.findMany({
        where,
        include: {
          operator: { select: { id: true, name: true, tier: true } },
          gc: { select: { id: true, name: true } },
          facility: { select: { id: true, facilityName: true, capacityMW: true } },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.cablingOpportunity.count({ where }),
    ]);

    return NextResponse.json({
      opportunities,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching cabling opportunities:", error);
    return NextResponse.json({ error: "Failed to fetch cabling opportunities" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(createCablingSchema, request);
    if (parsed.error) return parsed.error;

    // Convert date strings to Date objects
    const { rfqDate, bidDueDate, constructionStart, constructionEnd, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (rfqDate) data.rfqDate = new Date(rfqDate);
    if (bidDueDate) data.bidDueDate = new Date(bidDueDate);
    if (constructionStart) data.constructionStart = new Date(constructionStart);
    if (constructionEnd) data.constructionEnd = new Date(constructionEnd);

    const opportunity = await prisma.cablingOpportunity.create({
      data: data as Prisma.CablingOpportunityCreateInput,
      include: {
        operator: { select: { id: true, name: true, tier: true } },
        gc: { select: { id: true, name: true } },
        facility: { select: { id: true, facilityName: true, capacityMW: true } },
      },
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    console.error("Error creating cabling opportunity:", error);
    return NextResponse.json({ error: "Failed to create cabling opportunity" }, { status: 500 });
  }
}
