import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Platform, Prisma } from "@prisma/client";
import { computeNextRun } from "@/lib/discovery/runner";

// ─────────────────────────────────────────────
// GET /api/discovery/profiles
// List all search profiles with newCount and lastRun info
// ─────────────────────────────────────────────

export async function GET() {
  try {
    const profiles = await prisma.searchProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            discoveryListings: { where: { status: "NEW" } },
          },
        },
        scrapeRuns: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            listingsFound: true,
            errors: true,
          },
        },
      },
    });

    const result = profiles.map((p) => ({
      ...p,
      newCount: p._count.discoveryListings,
      lastRun: p.scrapeRuns[0] ?? null,
      _count: undefined,
      scrapeRuns: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to list search profiles:", error);
    return NextResponse.json(
      { error: "Failed to list search profiles" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// POST /api/discovery/profiles
// Create a new search profile
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, platforms, filters, cronExpression, isEnabled } = body as {
      name?: string;
      platforms?: Platform[];
      filters?: Record<string, unknown>;
      cronExpression?: string;
      isEnabled?: boolean;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: "platforms is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    const nextRunAt = cronExpression ? computeNextRun(cronExpression) : null;

    const profile = await prisma.searchProfile.create({
      data: {
        name: name.trim(),
        platforms,
        filters: (filters ?? {}) as Prisma.InputJsonValue,
        cronExpression: cronExpression ?? null,
        isEnabled: isEnabled ?? true,
        nextRunAt,
      },
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Failed to create search profile:", error);
    return NextResponse.json(
      { error: "Failed to create search profile" },
      { status: 500 }
    );
  }
}
