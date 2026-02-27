import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateScenarioComparison } from "@/lib/ai/valuation-comparison-commentary";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/pipeline/[id]/valuation/compare
 *
 * Sends selected valuation scenarios to Claude for structured comparison analysis.
 * Expects: { scenarioIds: string[] } (2-3 scenario IDs)
 * Returns: { comparison: ScenarioComparisonResult, inputTokens, outputTokens }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { scenarioIds } = await request.json();

    if (!Array.isArray(scenarioIds) || scenarioIds.length < 2) {
      return NextResponse.json(
        { error: "At least 2 scenario IDs required" },
        { status: 400 },
      );
    }

    if (scenarioIds.length > 3) {
      return NextResponse.json(
        { error: "Maximum 3 scenarios for comparison" },
        { status: 400 },
      );
    }

    // Fetch the specified scenarios
    const scenarios = await prisma.valuationModel.findMany({
      where: {
        id: { in: scenarioIds },
        opportunityId: id,
      },
    });

    if (scenarios.length < 2) {
      return NextResponse.json(
        { error: "At least 2 valid scenarios required for comparison" },
        { status: 400 },
      );
    }

    // Fetch opportunity name for context
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { title: true },
    });

    // Call AI comparison
    const result = await generateScenarioComparison({
      companyName: opportunity?.title ?? "Target Company",
      scenarios: scenarios.map((s) => ({
        name: s.modelName ?? "Untitled",
        inputs: s.inputs as Record<string, unknown>,
        outputs: s.outputs as Record<string, unknown>,
      })),
    });

    return NextResponse.json({
      comparison: result.parsed,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (error) {
    console.error("Failed to compare scenarios:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compare scenarios" },
      { status: 500 },
    );
  }
}
