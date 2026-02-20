import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { parseSearchParams } from "@/lib/validations/common";

const agentRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  agentName: z.string().optional(),
  status: z.string().optional(),
});

/**
 * GET /api/ai/agent-runs — List AI agent run history
 *
 * Query params:
 *   page      — page number (default 1)
 *   limit     — items per page (default 20, max 100)
 *   agentName — filter by agent name (e.g., "daily_scan", "news_monitor")
 *   status    — filter by status (e.g., "success", "error")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(agentRunsQuerySchema, searchParams);
    if (parsed.error) return parsed.error;
    const { page, limit, agentName, status } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (agentName) where.agentName = agentName;
    if (status) where.status = status;

    const [runs, total] = await Promise.all([
      prisma.aIAgentRun.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.aIAgentRun.count({ where }),
    ]);

    return NextResponse.json({
      runs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching agent runs:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent runs" },
      { status: 500 },
    );
  }
}
