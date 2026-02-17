import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

/**
 * GET /api/admin/access-requests
 * List all access requests (admin only).
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const requests = await prisma.accessRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({ requests });
}

/**
 * PATCH /api/admin/access-requests
 * Approve or deny an access request (admin only).
 */
export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const json = await request.json();
  const { requestId, status, reviewNote } = json;

  if (!requestId || typeof requestId !== "string") {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  if (status !== "APPROVED" && status !== "DENIED") {
    return NextResponse.json({ error: "status must be APPROVED or DENIED" }, { status: 400 });
  }

  const accessRequest = await prisma.accessRequest.update({
    where: { id: requestId },
    data: {
      status,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      reviewNote: typeof reviewNote === "string" ? reviewNote.slice(0, 500) : null,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // If approved, update the user's isApproved flag
  if (status === "APPROVED") {
    await prisma.user.update({
      where: { id: accessRequest.userId },
      data: { isApproved: true },
    });
  }

  return NextResponse.json(accessRequest);
}
