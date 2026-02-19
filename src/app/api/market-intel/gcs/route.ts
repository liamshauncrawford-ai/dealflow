import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { parseBody, parseSearchParams } from "@/lib/validations/common";
import { gcQuerySchema, createGCSchema } from "@/lib/validations/market-intel";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(gcQuerySchema, searchParams);
    if (parsed.error) return parsed.error;

    const { page, pageSize, search, priority, subQualificationStatus, sortBy, sortDir } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.GeneralContractorWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { hqLocation: { contains: search, mode: "insensitive" } },
        { primaryContactName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (priority) where.priority = priority as Prisma.EnumGCPriorityFilter;
    if (subQualificationStatus) where.subQualificationStatus = subQualificationStatus as Prisma.EnumSubQualificationStatusFilter;

    const orderBy: Prisma.GeneralContractorOrderByWithRelationInput = { [sortBy]: sortDir };

    const [gcs, total] = await Promise.all([
      prisma.generalContractor.findMany({
        where,
        include: {
          _count: { select: { facilities: true, cablingOpportunities: true } },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.generalContractor.count({ where }),
    ]);

    return NextResponse.json({
      gcs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching GCs:", error);
    return NextResponse.json({ error: "Failed to fetch GCs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(createGCSchema, request);
    if (parsed.error) return parsed.error;

    const gc = await prisma.generalContractor.create({
      data: parsed.data,
      include: {
        _count: { select: { facilities: true, cablingOpportunities: true } },
      },
    });

    return NextResponse.json(gc, { status: 201 });
  } catch (error) {
    console.error("Error creating GC:", error);
    return NextResponse.json({ error: "Failed to create GC" }, { status: 500 });
  }
}
