import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PipelineStage } from "@prisma/client";
import { parseBody } from "@/lib/validations/common";
import { updateOpportunitySchema } from "@/lib/validations/pipeline";
import { executeStageChangeTriggers } from "@/lib/workflow-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            sources: true,
            tags: { include: { tag: true } },
          },
        },
        notes: { orderBy: { createdAt: "desc" } },
        emails: {
          include: {
            email: {
              include: {
                attachments: {
                  select: { id: true, filename: true, mimeType: true, size: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        stageHistory: { orderBy: { createdAt: "desc" } },
        tags: { include: { tag: true } },
        documents: {
          orderBy: [{ category: "asc" }, { importedAt: "desc" }],
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            category: true,
            mimeType: true,
            description: true,
            uploadedAt: true,
            importedAt: true,
            // fileData intentionally excluded — can be multi-MB per document
          },
        },
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Fetch industry multiples for benchmarking if listing has an industry
    let industryMultiples = null;
    if (opportunity.listing?.industry) {
      industryMultiples = await prisma.industryMultiple.findFirst({
        where: {
          industry: {
            contains: opportunity.listing.industry,
            mode: "insensitive",
          },
        },
      });
    }

    return NextResponse.json({ ...opportunity, industryMultiples });
  } catch (error) {
    console.error("Error fetching opportunity:", error);
    return NextResponse.json(
      { error: "Failed to fetch opportunity" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(updateOpportunitySchema, request);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    // If stage is changing, record the stage change
    if (body.stage) {
      const current = await prisma.opportunity.findUnique({
        where: { id },
        select: { stage: true },
      });

      if (current && current.stage !== body.stage) {
        await prisma.stageChange.create({
          data: {
            opportunityId: id,
            fromStage: current.stage,
            toStage: body.stage as PipelineStage,
            note: body.stageNote || null,
          },
        });

        // Execute workflow triggers (auto-create tasks, update contacts)
        await executeStageChangeTriggers(id, current.stage, body.stage as PipelineStage);

        // Auto-set date fields based on stage
        const stageDateMap: Record<string, string> = {
          CONTACTING: "contactedAt",
          REQUESTED_CIM: "cimRequestedAt",
          SIGNED_NDA: "ndaSignedAt",
          OFFER_SENT: "offerSentAt",
          UNDER_CONTRACT: "underContractAt",
          CLOSED_WON: "closedAt",
          CLOSED_LOST: "closedAt",
        };

        const dateField = stageDateMap[body.stage];
        if (dateField && !(body as Record<string, unknown>)[dateField]) {
          (body as Record<string, unknown>)[dateField] = new Date().toISOString();
        }
      }
    }

    // Build update data from validated fields (excluding stageNote which is stage-history only)
    const { stageNote: _, ...fields } = body;
    const updateData: Record<string, unknown> = {};
    const dateFields = [
      "contactedAt", "cimRequestedAt", "ndaSignedAt", "offerSentAt",
      "underContractAt", "closedAt", "loiDate", "dueDiligenceStart", "targetCloseDate",
    ];
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        // Handle date fields
        if (dateFields.includes(key) && typeof value === "string") {
          updateData[key] = new Date(value);
        } else {
          updateData[key] = value;
        }
      }
    }

    const opportunity = await prisma.opportunity.update({
      where: { id },
      data: updateData,
      include: {
        listing: { include: { sources: true } },
        notes: { orderBy: { createdAt: "desc" } },
        stageHistory: { orderBy: { createdAt: "desc" } },
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json(opportunity);
  } catch (error) {
    console.error("Error updating opportunity:", error);
    return NextResponse.json(
      { error: "Failed to update opportunity" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.opportunity.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting opportunity:", error);
    return NextResponse.json(
      { error: "Failed to delete opportunity" },
      { status: 500 }
    );
  }
}
