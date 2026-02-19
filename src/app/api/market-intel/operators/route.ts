import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { parseBody, parseSearchParams } from "@/lib/validations/common";
import { operatorQuerySchema, createOperatorSchema } from "@/lib/validations/market-intel";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(operatorQuerySchema, searchParams);
    if (parsed.error) return parsed.error;

    const { page, pageSize, search, tier, relationshipStatus, sortBy, sortDir } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.DataCenterOperatorWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { parentCompany: { contains: search, mode: "insensitive" } },
        { hqLocation: { contains: search, mode: "insensitive" } },
        { primaryContactName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (tier) where.tier = tier as Prisma.EnumOperatorTierFilter;
    if (relationshipStatus) where.relationshipStatus = relationshipStatus as Prisma.EnumOperatorRelationshipStatusFilter;

    const orderBy: Prisma.DataCenterOperatorOrderByWithRelationInput = { [sortBy]: sortDir };

    const [operators, total] = await Promise.all([
      prisma.dataCenterOperator.findMany({
        where,
        include: {
          facilities: { orderBy: { facilityName: "asc" } },
          _count: { select: { facilities: true, cablingOpportunities: true } },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.dataCenterOperator.count({ where }),
    ]);

    return NextResponse.json({
      operators,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching operators:", error);
    return NextResponse.json({ error: "Failed to fetch operators" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(createOperatorSchema, request);
    if (parsed.error) return parsed.error;

    const operator = await prisma.dataCenterOperator.create({
      data: parsed.data,
      include: {
        facilities: true,
        _count: { select: { facilities: true, cablingOpportunities: true } },
      },
    });

    return NextResponse.json(operator, { status: 201 });
  } catch (error) {
    console.error("Error creating operator:", error);
    return NextResponse.json({ error: "Failed to create operator" }, { status: 500 });
  }
}
