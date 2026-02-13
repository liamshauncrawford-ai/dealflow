import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import type { AICIMExtractionResult } from "@/lib/ai/cim-parser";

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

const applyCIMSchema = z.object({
  analysisId: z.string().min(1, "analysisId is required"),
  selectedFields: z.array(z.string()).min(1, "At least one field group must be selected"),
});

// ─────────────────────────────────────────────
// Field group mappings
//
// Each "field group" maps AI extraction fields → Opportunity fields.
// The user selects which groups to apply via checkboxes.
// ─────────────────────────────────────────────

type FieldMapper = (
  result: AICIMExtractionResult,
  updates: Record<string, unknown>,
) => void;

const FIELD_GROUPS: Record<string, FieldMapper> = {
  financials: (result, updates) => {
    if (result.latestRevenue != null) updates.actualRevenue = result.latestRevenue;
    if (result.latestEbitda != null) updates.actualEbitda = result.latestEbitda;
    if (result.latestEbitdaMargin != null) updates.actualEbitdaMargin = result.latestEbitdaMargin;
    if (result.recurringRevenuePct != null) updates.recurringRevenuePct = result.recurringRevenuePct;
    if (result.askingPrice != null) updates.offerPrice = result.askingPrice; // Sets as reference, not actual offer
  },

  business_details: (result, updates) => {
    if (result.description) updates.description = result.description;
    if (result.employees != null) {
      // Store in description addendum since there's no direct employee field
      const desc = (updates.description as string) || "";
      if (desc && !desc.includes("employees")) {
        updates.description = desc + `\n\nEmployees: ${result.employees}`;
      }
    }
  },

  deal_structure: (result, updates) => {
    if (result.dealStructureSummary) updates.dealStructure = result.dealStructureSummary;
  },

  risk_indicators: (result, updates) => {
    if (result.customerConcentrationPct != null) {
      updates.customerConcentration = result.customerConcentrationPct;
    }
    if (result.riskFlags && result.riskFlags.length > 0) {
      updates.customerRetentionRisk = result.riskFlags.join("; ");
    }
  },

  thesis_fit: (result, updates) => {
    if (result.thesisFitAssessment) {
      // Append to description rather than overwriting
      const desc = (updates.description as string) || "";
      updates.description = desc
        ? desc + `\n\nThesis Fit Assessment:\n${result.thesisFitAssessment}`
        : `Thesis Fit Assessment:\n${result.thesisFitAssessment}`;
    }
  },

  revenue_trend: (result, updates) => {
    // Determine trend from multi-year financials
    if (result.financials && result.financials.length >= 2) {
      const sorted = [...result.financials]
        .filter((f) => f.revenue != null && f.year != null)
        .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

      if (sorted.length >= 2) {
        const first = sorted[0].revenue!;
        const last = sorted[sorted.length - 1].revenue!;
        if (last > first * 1.05) {
          updates.revenueTrend = "GROWING";
        } else if (last < first * 0.95) {
          updates.revenueTrend = "DECLINING";
        } else {
          updates.revenueTrend = "STABLE";
        }
      }
    }
  },
};

// ─────────────────────────────────────────────
// POST /api/pipeline/[id]/apply-cim
//
// Takes an analysisId + selected field groups, maps AI extraction
// results to Opportunity fields, and updates the opportunity.
// Optionally creates a Contact for the broker/owner.
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: opportunityId } = await params;

    // Validate body
    const { data, error } = await parseBody(applyCIMSchema, request);
    if (error) return error;

    // Fetch the cached analysis
    const analysis = await prisma.aIAnalysisResult.findUnique({
      where: { id: data.analysisId },
    });

    if (!analysis || analysis.opportunityId !== opportunityId) {
      return NextResponse.json(
        { error: "Analysis not found for this opportunity" },
        { status: 404 },
      );
    }

    const result = analysis.resultData as unknown as AICIMExtractionResult;

    // Build update object from selected field groups
    const updates: Record<string, unknown> = {};
    const appliedGroups: string[] = [];

    for (const group of data.selectedFields) {
      const mapper = FIELD_GROUPS[group];
      if (mapper) {
        mapper(result, updates);
        appliedGroups.push(group);
      }
    }

    // Apply updates to opportunity
    if (Object.keys(updates).length > 0) {
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: updates,
      });
    }

    // Create contact if broker or owner info is available and "contact" group selected
    let contactCreated = false;
    if (data.selectedFields.includes("contact")) {
      // Prefer broker, fall back to owner
      const contactName = result.brokerName || result.ownerName;
      const contactEmail = result.brokerEmail || result.ownerEmail;
      const contactPhone = result.brokerPhone || result.ownerPhone;
      const contactRole = result.brokerName
        ? `Broker${result.brokerCompany ? ` — ${result.brokerCompany}` : ""}`
        : result.ownerRole || "Owner";

      if (contactName) {
        // Check if a contact with this name already exists for this opp
        const existing = await prisma.contact.findFirst({
          where: {
            opportunityId,
            name: { equals: contactName, mode: "insensitive" },
          },
        });

        if (!existing) {
          await prisma.contact.create({
            data: {
              opportunityId,
              name: contactName,
              email: contactEmail,
              phone: contactPhone,
              role: contactRole,
              company: result.brokerCompany || result.businessName,
              isPrimary: !result.brokerName, // Owner is primary, broker is not
              interestLevel: "UNKNOWN",
            },
          });
          contactCreated = true;
          appliedGroups.push("contact");
        }
      }
    }

    return NextResponse.json({
      updated: Object.keys(updates).length > 0,
      fieldsApplied: appliedGroups,
      contactCreated,
    });
  } catch (err) {
    console.error("[apply-cim] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to apply CIM results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
