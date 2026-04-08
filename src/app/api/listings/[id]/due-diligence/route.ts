import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_DD_ITEMS } from "@/lib/due-diligence/defaults";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { opportunity: { select: { stage: true } } },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Lazy-seed default checklist items on first access
    const count = await prisma.dueDiligenceItem.count({ where: { listingId: id } });

    if (count === 0) {
      await prisma.dueDiligenceItem.createMany({
        data: DEFAULT_DD_ITEMS.map((item) => ({ listingId: id, ...item })),
      });
    }

    const items = await prisma.dueDiligenceItem.findMany({
      where: { listingId: id },
      orderBy: [{ stage: "asc" }, { order: "asc" }],
    });

    return NextResponse.json({
      items,
      pipelineStage: listing.opportunity?.stage ?? null,
    });
  } catch (error) {
    console.error("Error fetching due diligence items:", error);
    return NextResponse.json(
      { error: "Failed to fetch due diligence items" },
      { status: 500 }
    );
  }
}

const VALID_STAGES = new Set(["PRE_NDA", "POST_NDA", "LOI_DD"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { stage, itemText } = body;

    if (!stage || !itemText || !VALID_STAGES.has(stage)) {
      return NextResponse.json(
        { error: "Invalid stage or missing itemText" },
        { status: 400 }
      );
    }

    const maxOrder = await prisma.dueDiligenceItem.aggregate({
      where: { listingId: id, stage },
      _max: { order: true },
    });

    const item = await prisma.dueDiligenceItem.create({
      data: {
        listingId: id,
        stage,
        itemText,
        isCustom: true,
        order: (maxOrder._max.order ?? 0) + 1,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating due diligence item:", error);
    return NextResponse.json(
      { error: "Failed to create due diligence item" },
      { status: 500 }
    );
  }
}
