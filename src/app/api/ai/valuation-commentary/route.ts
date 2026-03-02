import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateValuationCommentary,
  type ValuationCommentaryInput,
} from "@/lib/ai/valuation-commentary";

/**
 * GET /api/ai/valuation-commentary?valuationModelId=xxx
 * Returns persisted AI commentary from ValuationModel.aiCommentary.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get("valuationModelId");
    if (!modelId) {
      return NextResponse.json({ error: "valuationModelId required" }, { status: 400 });
    }

    const model = await prisma.valuationModel.findUnique({
      where: { id: modelId },
      select: { aiCommentary: true },
    });

    return NextResponse.json({ commentary: model?.aiCommentary ?? null });
  } catch (error) {
    console.error("Valuation commentary GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch valuation commentary" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/ai/valuation-commentary
 * Generate AI commentary on a valuation model.
 * Persists to ValuationModel.aiCommentary if valuationModelId is provided.
 *
 * Body: { companyName: string, modelOutputs: { ... }, valuationModelId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 503 },
      );
    }

    const body = (await request.json()) as ValuationCommentaryInput & { valuationModelId?: string };

    if (!body.companyName || !body.modelOutputs) {
      return NextResponse.json(
        { error: "companyName and modelOutputs are required" },
        { status: 400 },
      );
    }

    const { result, inputTokens, outputTokens } =
      await generateValuationCommentary(body);

    // Persist commentary to ValuationModel if modelId provided
    if (body.valuationModelId) {
      await prisma.valuationModel.update({
        where: { id: body.valuationModelId },
        data: { aiCommentary: result as object },
      });
    }

    // Log the agent run
    await prisma.aIAgentRun.create({
      data: {
        agentName: "valuation_commentary",
        status: "success",
        itemsProcessed: 1,
        apiCallsMade: 1,
        totalTokens: inputTokens + outputTokens,
        totalCost:
          (inputTokens / 1_000_000) * 3.0 +
          (outputTokens / 1_000_000) * 15.0,
        summary: `Valuation commentary for ${body.companyName}`,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ commentary: result });
  } catch (error) {
    console.error("Valuation commentary error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate valuation commentary",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}
