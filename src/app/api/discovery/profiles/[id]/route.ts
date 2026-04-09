import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeNextRun } from "@/lib/discovery/runner";

// ─────────────────────────────────────────────
// GET /api/discovery/profiles/[id]
// ─────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const profile = await prisma.searchProfile.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            discoveryListings: true,
            scrapeRuns: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Search profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Failed to get search profile:", error);
    return NextResponse.json(
      { error: "Failed to get search profile" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PUT /api/discovery/profiles/[id]
// Update a search profile
// ─────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.searchProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Search profile not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.platforms !== undefined) updateData.platforms = body.platforms;
    if (body.filters !== undefined) updateData.filters = body.filters;
    if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled;
    if (body.cronExpression !== undefined) {
      updateData.cronExpression = body.cronExpression;
      updateData.nextRunAt = body.cronExpression
        ? computeNextRun(body.cronExpression)
        : null;
    }

    const profile = await prisma.searchProfile.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Failed to update search profile:", error);
    return NextResponse.json(
      { error: "Failed to update search profile" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// DELETE /api/discovery/profiles/[id]
// ─────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.searchProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Search profile not found" },
        { status: 404 }
      );
    }

    await prisma.searchProfile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete search profile:", error);
    return NextResponse.json(
      { error: "Failed to delete search profile" },
      { status: 500 }
    );
  }
}
