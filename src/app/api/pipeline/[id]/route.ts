import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PipelineStage } from "@prisma/client";
import { parseBody } from "@/lib/validations/common";
import { updateOpportunitySchema } from "@/lib/validations/pipeline";
import { executeStageChangeTriggers } from "@/lib/workflow-engine";
import { createAuditLog, diffAndLog } from "@/lib/audit";
import { auth } from "@/lib/auth";

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

    // Fetch latest financial period summary
    const latestFinancials = await prisma.financialPeriod.findFirst({
      where: { opportunityId: id },
      orderBy: [{ year: "desc" }, { periodType: "asc" }],
      select: {
        id: true,
        periodType: true,
        year: true,
        quarter: true,
        label: true,
        totalRevenue: true,
        ebitda: true,
        adjustedEbitda: true,
        sde: true,
        ebitdaMargin: true,
        adjustedEbitdaMargin: true,
        totalAddBacks: true,
        dataSource: true,
        confidence: true,
        _count: { select: { addBacks: true, lineItems: true } },
      },
    });

    const financialPeriodCount = await prisma.financialPeriod.count({
      where: { opportunityId: id },
    });

    return NextResponse.json({
      ...opportunity,
      industryMultiples,
      latestFinancials,
      financialPeriodCount,
    });
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

    // Fetch current state for audit diffing
    const currentState = await prisma.opportunity.findUnique({
      where: { id },
      select: {
        stage: true,
        priority: true,
        title: true,
        offerPrice: true,
        offerTerms: true,
        winProbability: true,
        dealValue: true,
        lostReason: true,
        lostCategory: true,
        contactedAt: true,
        cimRequestedAt: true,
        ndaSignedAt: true,
        offerSentAt: true,
        underContractAt: true,
        closedAt: true,
        loiDate: true,
        dueDiligenceStart: true,
        targetCloseDate: true,
      },
    });

    // If stage is changing, record the stage change
    if (body.stage) {
      if (currentState && currentState.stage !== body.stage) {
        await prisma.stageChange.create({
          data: {
            opportunityId: id,
            fromStage: currentState.stage,
            toStage: body.stage as PipelineStage,
            note: body.stageNote || null,
          },
        });

        // Execute workflow triggers (auto-create tasks, update contacts)
        await executeStageChangeTriggers(id, currentState.stage, body.stage as PipelineStage);

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

    // ── Audit logging ──
    const session = await auth();
    const userId = session?.user?.id ?? null;

    if (currentState) {
      // Log stage change as a dedicated event
      if (body.stage && currentState.stage !== body.stage) {
        await createAuditLog({
          eventType: "STAGE_CHANGED",
          entityType: "OPPORTUNITY",
          entityId: id,
          opportunityId: id,
          userId,
          fieldName: "stage",
          oldValue: currentState.stage,
          newValue: body.stage,
          summary: `Stage changed from ${formatStage(currentState.stage)} to ${formatStage(body.stage)}`,
        });
      }

      // Log all other field-level changes
      const auditFieldLabels: Record<string, string> = {
        priority: "priority",
        title: "title",
        offerPrice: "offer price",
        offerTerms: "offer terms",
        winProbability: "win probability",
        dealValue: "deal value",
        lostReason: "lost reason",
        lostCategory: "lost category",
        contactedAt: "contacted date",
        cimRequestedAt: "CIM requested date",
        ndaSignedAt: "NDA signed date",
        offerSentAt: "offer sent date",
        underContractAt: "under contract date",
        closedAt: "closed date",
        loiDate: "LOI date",
        dueDiligenceStart: "due diligence start",
        targetCloseDate: "target close date",
      };

      // Build a comparable snapshot from updateData (excluding stage which is logged above)
      const { stage: _s, ...fieldsForDiff } = updateData as Record<string, unknown>;
      await diffAndLog(
        currentState as unknown as Record<string, unknown>,
        fieldsForDiff,
        {
          entityType: "OPPORTUNITY",
          entityId: id,
          opportunityId: id,
          userId,
          fieldLabels: auditFieldLabels,
          ignoreFields: ["stageNote"],
        }
      );
    }

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

    // Fetch title before deleting for audit
    const existing = await prisma.opportunity.findUnique({
      where: { id },
      select: { title: true },
    });

    await prisma.opportunity.delete({
      where: { id },
    });

    if (existing) {
      const delSession = await auth();
      await createAuditLog({
        eventType: "DELETED",
        entityType: "OPPORTUNITY",
        entityId: id,
        userId: delSession?.user?.id ?? null,
        summary: `Deleted opportunity: ${existing.title}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting opportunity:", error);
    return NextResponse.json(
      { error: "Failed to delete opportunity" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatStage(stage: string): string {
  return stage
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
