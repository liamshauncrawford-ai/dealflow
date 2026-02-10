import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { promoteToOpportunitySchema } from "@/lib/validations/pipeline";

// Promote a listing to the pipeline as an opportunity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(promoteToOpportunitySchema, request);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { opportunity: true },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.opportunity) {
      return NextResponse.json(
        { error: "Listing already has a pipeline opportunity", opportunityId: listing.opportunity.id },
        { status: 409 }
      );
    }

    const stage = body.stage;

    const opportunity = await prisma.opportunity.create({
      data: {
        listingId: id,
        title: body.title || listing.title,
        description: body.description || listing.description,
        stage,
        priority: body.priority,
        offerPrice: body.offerPrice || undefined,
        offerTerms: body.offerTerms || undefined,
        contactedAt: stage === "CONTACTING" ? new Date() : undefined,
      },
      include: {
        listing: { include: { sources: true } },
        notes: true,
        stageHistory: true,
        contacts: true,
      },
    });

    // Create contacts if provided
    if (body.contacts && body.contacts.length > 0) {
      for (const contact of body.contacts) {
        await prisma.contact.create({
          data: {
            opportunityId: opportunity.id,
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            company: contact.company || null,
            role: contact.role || null,
            isPrimary: contact.isPrimary || false,
            interestLevel: contact.interestLevel || "UNKNOWN",
          },
        });
      }
    }

    // Refetch with contacts included
    const result = await prisma.opportunity.findUnique({
      where: { id: opportunity.id },
      include: {
        listing: { include: { sources: true } },
        notes: true,
        stageHistory: true,
        contacts: true,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating opportunity:", error);
    return NextResponse.json(
      { error: "Failed to create opportunity" },
      { status: 500 }
    );
  }
}
