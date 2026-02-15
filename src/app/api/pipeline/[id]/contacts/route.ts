import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ContactInterest } from "@prisma/client";
import { parseBody } from "@/lib/validations/common";
import { createContactSchema, updateContactSchema } from "@/lib/validations/pipeline";
import { createAuditLog, diffAndLog } from "@/lib/audit";

/**
 * GET /api/pipeline/[id]/contacts
 * List all contacts for an opportunity.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const contacts = await prisma.contact.findMany({
      where: { opportunityId: id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipeline/[id]/contacts
 * Add a new contact to an opportunity.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(createContactSchema, request);
    if (parsed.error) return parsed.error;
    const data = parsed.data;

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // If setting as primary, unset other primary contacts
    if (data.isPrimary) {
      await prisma.contact.updateMany({
        where: { opportunityId: id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.contact.create({
      data: {
        opportunityId: id,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        role: data.role || null,
        interestLevel: (data.interestLevel as ContactInterest),
        isPrimary: data.isPrimary,
        notes: data.notes || null,
      },
    });

    await createAuditLog({
      eventType: "CREATED",
      entityType: "CONTACT",
      entityId: contact.id,
      opportunityId: id,
      summary: `Created contact: ${data.name}`,
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pipeline/[id]/contacts?contactId=XXX
 * Update a contact's fields.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId query parameter is required" },
        { status: 400 }
      );
    }

    const parsed = await parseBody(updateContactSchema, request);
    if (parsed.error) return parsed.error;

    // Verify contact belongs to this opportunity
    const existing = await prisma.contact.findFirst({
      where: { id: contactId, opportunityId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // If setting as primary, unset other primary contacts
    if (parsed.data.isPrimary) {
      await prisma.contact.updateMany({
        where: { opportunityId: id, isPrimary: true, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    // Build update from validated data
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    await diffAndLog(
      existing as unknown as Record<string, unknown>,
      updateData,
      {
        entityType: "CONTACT",
        entityId: contactId,
        opportunityId: id,
        fieldLabels: {
          name: "name",
          email: "email",
          phone: "phone",
          company: "company",
          role: "role",
          interestLevel: "interest level",
          isPrimary: "primary contact",
          notes: "notes",
          sentiment: "sentiment",
          outreachStatus: "outreach status",
          linkedinUrl: "LinkedIn URL",
          nextFollowUpDate: "next follow-up date",
        },
      }
    );

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pipeline/[id]/contacts?contactId=XXX
 * Remove a contact.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId query parameter is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.contact.findFirst({
      where: { id: contactId, opportunityId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    await prisma.contact.delete({
      where: { id: contactId },
    });

    await createAuditLog({
      eventType: "DELETED",
      entityType: "CONTACT",
      entityId: contactId,
      opportunityId: id,
      summary: `Deleted contact: ${existing.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
