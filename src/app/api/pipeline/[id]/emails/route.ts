import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { linkEmailSchema } from "@/lib/validations/pipeline";
import { createAuditLog } from "@/lib/audit";

/**
 * POST /api/pipeline/[id]/emails
 * Link an email to an opportunity (create EmailLink).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(linkEmailSchema, request);
    if (parsed.error) return parsed.error;
    const { emailId } = parsed.data;

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { id: true, stage: true, contactedAt: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Verify email exists
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      select: { id: true, sentAt: true },
    });

    if (!email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Check if already linked
    const existing = await prisma.emailLink.findUnique({
      where: { emailId_opportunityId: { emailId, opportunityId: id } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email is already linked to this opportunity" },
        { status: 409 }
      );
    }

    const link = await prisma.emailLink.create({
      data: {
        emailId,
        opportunityId: id,
        linkedBy: "manual",
      },
      include: {
        email: true,
      },
    });

    // Smart auto-fill: if deal is in CONTACTING and contactedAt not set,
    // set it to the email's sentAt date
    if (
      opportunity.stage === "CONTACTING" &&
      !opportunity.contactedAt &&
      email.sentAt
    ) {
      await prisma.opportunity.update({
        where: { id },
        data: { contactedAt: email.sentAt },
      });
    }

    await createAuditLog({
      eventType: "LINKED",
      entityType: "EMAIL",
      entityId: emailId,
      opportunityId: id,
      summary: `Linked email: ${link.email.subject || "(no subject)"}`,
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("Error linking email to opportunity:", error);
    return NextResponse.json(
      { error: "Failed to link email" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pipeline/[id]/emails
 * Unlink an email from an opportunity.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(linkEmailSchema, request);
    if (parsed.error) return parsed.error;
    const { emailId } = parsed.data;

    const existing = await prisma.emailLink.findUnique({
      where: { emailId_opportunityId: { emailId, opportunityId: id } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Email link not found" },
        { status: 404 }
      );
    }

    await prisma.emailLink.delete({
      where: { id: existing.id },
    });

    await createAuditLog({
      eventType: "UNLINKED",
      entityType: "EMAIL",
      entityId: emailId,
      opportunityId: id,
      summary: "Unlinked email",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking email from opportunity:", error);
    return NextResponse.json(
      { error: "Failed to unlink email" },
      { status: 500 }
    );
  }
}
