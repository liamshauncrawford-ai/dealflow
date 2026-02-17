import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

/**
 * GET /api/admin/users
 * List all users (admin only).
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isApproved: true,
      lastLoginAt: true,
      lastActiveAt: true,
      lastActivePath: true,
      createdAt: true,
      _count: {
        select: { auditLogs: true },
      },
    },
  });

  return NextResponse.json({ users });
}

/**
 * PATCH /api/admin/users
 * Update user role or approval status (admin only).
 */
export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const json = await request.json();
  const { userId, role, isApproved } = json;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (role === "ADMIN" || role === "USER") updateData.role = role;
  if (typeof isApproved === "boolean") updateData.isApproved = isApproved;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isApproved: true,
    },
  });

  // If approving a user, also update their access request
  if (isApproved === true) {
    await prisma.accessRequest.updateMany({
      where: { userId, status: "PENDING" },
      data: {
        status: "APPROVED",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      },
    });
  }

  return NextResponse.json(user);
}
