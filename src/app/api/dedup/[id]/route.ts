import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { parseBody } from "@/lib/validations/common";

const resolveDedupSchema = z.object({
  action: z.enum(["merge", "reject"]),
  primaryId: z.string().optional(),
});

// PATCH /api/dedup/[id] — Resolve a dedup candidate
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(resolveDedupSchema, request);
    if (parsed.error) return parsed.error;
    const { action, primaryId } = parsed.data;

    const candidate = await prisma.dedupCandidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: "Dedup candidate not found" },
        { status: 404 }
      );
    }

    if (action === "reject") {
      // Mark as not duplicate
      await prisma.dedupCandidate.update({
        where: { id },
        data: {
          status: "NOT_DUPLICATE",
          resolvedBy: "user",
          resolvedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, action: "rejected" });
    }

    if (action === "merge") {
      if (!primaryId) {
        return NextResponse.json(
          { error: "primaryId is required for merge action" },
          { status: 400 }
        );
      }

      const secondaryId =
        primaryId === candidate.listingAId
          ? candidate.listingBId
          : candidate.listingAId;

      // Dynamic import to avoid loading at build time
      const { mergeDuplicates } = await import("@/lib/dedup/dedup-engine");
      await mergeDuplicates(primaryId, secondaryId);

      return NextResponse.json({
        success: true,
        action: "merged",
        primaryId,
        secondaryId,
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error resolving dedup candidate:", error);
    return NextResponse.json(
      { error: "Failed to resolve dedup candidate" },
      { status: 500 }
    );
  }
}
