import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { parseBody, parseSearchParams } from "@/lib/validations/common";

const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(0).max(100).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

const markNotificationsSchema = z.object({
  ids: z.array(z.string()).optional(),
  markAllRead: z.boolean().optional(),
}).refine(
  (data) => data.ids || data.markAllRead,
  { message: "Must provide 'ids' or 'markAllRead'" },
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(notificationQuerySchema, searchParams);
    if (parsed.error) return parsed.error;
    const { page, limit, unreadOnly } = parsed.data;
    const skip = (page - 1) * limit;

    const where = unreadOnly ? { isRead: false as const } : {};

    const [notifications, total, unreadCount] = await Promise.all([
      limit > 0
        ? prisma.notification.findMany({
            where,
            include: {
              listing: {
                select: { id: true, title: true },
              },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          })
        : [],
      limit > 0 ? prisma.notification.count({ where }) : 0,
      prisma.notification.count({ where: { isRead: false } }),
    ]);

    return NextResponse.json({
      notifications,
      total,
      unreadCount,
      page,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const parsed = await parseBody(markNotificationsSchema, request);
    if (parsed.error) return parsed.error;
    const { ids, markAllRead } = parsed.data;

    let updated = 0;

    if (markAllRead) {
      const result = await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
      updated = result.count;
    } else if (ids && ids.length > 0) {
      const result = await prisma.notification.updateMany({
        where: { id: { in: ids } },
        data: { isRead: true },
      });
      updated = result.count;
    }

    return NextResponse.json({ updated });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
