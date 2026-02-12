import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { parseBody, parseSearchParams } from "@/lib/validations/common";
import { pipelineQuerySchema, createOpportunitySchema } from "@/lib/validations/pipeline";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(pipelineQuerySchema, searchParams);
    if (parsed.error) return parsed.error;
    const { stage, page, limit } = parsed.data;

    const where: Prisma.OpportunityWhereInput = {};
    if (stage) {
      where.stage = stage as Prisma.EnumPipelineStageFilter;
    }

    const include = {
      listing: {
        include: {
          sources: true,
        },
      },
      contacts: {
        where: { isPrimary: true },
        take: 1,
        select: { name: true, nextFollowUpDate: true },
      },
      notes: { orderBy: { createdAt: "desc" as const }, take: 3 },
      emails: {
        include: { email: true },
        orderBy: { createdAt: "desc" as const },
        take: 5,
      },
      stageHistory: { orderBy: { createdAt: "desc" as const } },
      tags: { include: { tag: true } },
      _count: { select: { contacts: true } },
    };

    // If page+limit provided, paginate; otherwise return all (kanban compatibility)
    if (page !== undefined && limit !== undefined) {
      const offset = (page - 1) * limit;
      const [opportunities, total] = await Promise.all([
        prisma.opportunity.findMany({
          where,
          include,
          orderBy: { updatedAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.opportunity.count({ where }),
      ]);

      return NextResponse.json({
        opportunities,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    }

    const opportunities = await prisma.opportunity.findMany({
      where,
      include,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      opportunities,
      total: opportunities.length,
    });
  } catch (error) {
    console.error("Error fetching pipeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(createOpportunitySchema, request);
    if (parsed.error) return parsed.error;
    const { title, description, listingId, stage, priority } = parsed.data;

    const opportunity = await prisma.opportunity.create({
      data: {
        title,
        description: description || null,
        listingId: listingId || null,
        stage,
        priority,
      },
      include: {
        listing: { include: { sources: true } },
        notes: true,
        stageHistory: true,
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    console.error("Error creating opportunity:", error);
    return NextResponse.json(
      { error: "Failed to create opportunity" },
      { status: 500 }
    );
  }
}
