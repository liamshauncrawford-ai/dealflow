import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/listings/[id]/outreach-sent
 *
 * Records that outreach was sent for a listing. Creates an Opportunity if
 * none exists, logs a Note, optionally creates a follow-up Task, and
 * updates contactedAt.
 *
 * Body: { templateType: string, subject: string, notes?: string, nextActionDate?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { templateType, subject, notes, nextActionDate } = body;

    if (!templateType || !subject) {
      return NextResponse.json(
        { error: "templateType and subject are required" },
        { status: 400 }
      );
    }

    // 1. Find listing with its opportunity
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { opportunity: true },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // 2. Find or create Opportunity
    let opportunity = listing.opportunity;
    if (!opportunity) {
      opportunity = await prisma.opportunity.create({
        data: {
          listingId: id,
          title: listing.title || listing.businessName || "Untitled Opportunity",
          stage: "CONTACTING",
          priority: "MEDIUM",
        },
      });
    }

    // 3. Create a Note recording the outreach
    await prisma.note.create({
      data: {
        opportunityId: opportunity.id,
        title: `Outreach Sent — ${templateType}`,
        content: `Subject: ${subject}\n\n${notes || ""}`.trim(),
        noteType: "GENERAL",
      },
    });

    // 4. If nextActionDate provided, create a follow-up Task
    if (nextActionDate) {
      await prisma.task.create({
        data: {
          opportunityId: opportunity.id,
          title: `Follow up — ${listing.title || listing.businessName || "Untitled"}`,
          dueDate: new Date(nextActionDate),
          source: "MANUAL",
        },
      });
    }

    // 5. Update contactedAt on the opportunity
    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { contactedAt: new Date() },
    });

    return NextResponse.json({ opportunityId: opportunity.id });
  } catch (error) {
    console.error("Error marking outreach as sent:", error);
    return NextResponse.json(
      { error: "Failed to mark outreach as sent" },
      { status: 500 }
    );
  }
}
