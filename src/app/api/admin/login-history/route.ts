import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

/**
 * GET /api/admin/login-history
 * List login history (admin only).
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const skip = (page - 1) * limit;

  const [history, total] = await Promise.all([
    prisma.loginHistory.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    }),
    prisma.loginHistory.count(),
  ]);

  return NextResponse.json({
    history,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
