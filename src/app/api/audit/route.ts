import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSearchParams } from "@/lib/validations/common";
import { auditLogQuerySchema } from "@/lib/validations/audit";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(auditLogQuerySchema, searchParams);
    if (parsed.error) return parsed.error;

    const { page, limit, opportunityId, entityType, eventType } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (opportunityId) where.opportunityId = opportunityId;
    if (entityType) where.entityType = entityType;
    if (eventType) where.eventType = eventType;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          opportunity: {
            select: { id: true, title: true },
          },
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[API] GET /api/audit error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
