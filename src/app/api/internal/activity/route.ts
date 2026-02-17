import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/internal/activity
 *
 * Throttled activity tracking — updates user.lastActiveAt and lastActivePath
 * only if the last update was more than 5 minutes ago.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const json = await request.json().catch(() => ({}));
    const path = typeof json.path === "string" ? json.path.slice(0, 200) : null;

    // Throttle: only update if last activity > 5 min ago
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lastActiveAt: true },
    });

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (user?.lastActiveAt && user.lastActiveAt > fiveMinAgo) {
      return NextResponse.json({ ok: true, throttled: true });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastActiveAt: new Date(),
        lastActivePath: path,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Activity] Failed to update activity:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
