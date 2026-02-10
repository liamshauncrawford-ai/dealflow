import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { parseSearchParams } from "@/lib/validations/common";
import { emailMessagesQuerySchema } from "@/lib/validations/listings";

// GET /api/email/messages — List emails with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(emailMessagesQuerySchema, searchParams);
    if (parsed.error) return parsed.error;
    const { page, limit, search, opportunityId } = parsed.data;
    const offset = (page - 1) * limit;

    const where: Prisma.EmailWhereInput = {};

    // Filter by opportunity via EmailLink join
    if (opportunityId) {
      where.links = {
        some: {
          opportunityId,
        },
      };
    }

    // Search by subject or fromAddress
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { fromAddress: { contains: search, mode: "insensitive" } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        include: {
          links: {
            include: {
              opportunity: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          attachments: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              size: true,
            },
          },
        },
        orderBy: { receivedAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.email.count({ where }),
    ]);

    return NextResponse.json({
      emails,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching email messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch email messages" },
      { status: 500 }
    );
  }
}
