import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/auth/access-request
 * Returns the current user's access request status.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const request = await prisma.accessRequest.findUnique({
    where: { userId: session.user.id },
  });

  if (!request) {
    return NextResponse.json({ status: "PENDING", reason: null, reviewNote: null });
  }

  return NextResponse.json({
    status: request.status,
    reason: request.reason,
    reviewNote: request.reviewNote,
  });
}

/**
 * PATCH /api/auth/access-request
 * Allows user to add a reason to their access request.
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const reason = typeof json.reason === "string" ? json.reason.slice(0, 1000) : null;

  const request = await prisma.accessRequest.upsert({
    where: { userId: session.user.id },
    update: { reason },
    create: {
      userId: session.user.id,
      reason,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    status: request.status,
    reason: request.reason,
  });
}
