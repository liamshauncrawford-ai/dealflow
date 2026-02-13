import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { classifyEmailsBatch } from "@/lib/ai/email-intelligence";
import { isAIEnabled } from "@/lib/ai/claude-client";

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

const classifySchema = z.object({
  emailIds: z.array(z.string()).min(1).max(100).optional(),
  // If no emailIds provided, classify all uncategorized emails
});

// ─────────────────────────────────────────────
// POST /api/email/classify
//
// On-demand AI email classification. Can target specific emails
// by ID or classify all uncategorized emails.
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: "AI features are not configured (missing ANTHROPIC_API_KEY)" },
        { status: 503 },
      );
    }

    const { data, error } = await parseBody(classifySchema, request);
    if (error) return error;

    // Fetch emails to classify
    const whereClause = data.emailIds
      ? { id: { in: data.emailIds } }
      : { emailCategory: null, aiClassifiedAt: null };

    const emails = await prisma.email.findMany({
      where: whereClause,
      select: {
        id: true,
        fromAddress: true,
        fromName: true,
        toAddresses: true,
        subject: true,
        bodyPreview: true,
      },
      take: 100, // Safety limit
      orderBy: { sentAt: "desc" },
    });

    if (emails.length === 0) {
      return NextResponse.json({
        classified: 0,
        summarized: 0,
        message: "No emails to classify",
      });
    }

    const result = await classifyEmailsBatch(emails);

    return NextResponse.json({
      ...result,
      totalProcessed: emails.length,
    });
  } catch (err) {
    console.error("[classify] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to classify emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
