import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateValuationCommentary,
  type ValuationCommentaryInput,
} from "@/lib/ai/valuation-commentary";

/**
 * POST /api/ai/valuation-commentary
 * Generate AI commentary on a valuation model.
 *
 * Body: { companyName: string, modelOutputs: { ... } }
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 503 },
      );
    }

    const body = (await request.json()) as ValuationCommentaryInput;

    if (!body.companyName || !body.modelOutputs) {
      return NextResponse.json(
        { error: "companyName and modelOutputs are required" },
        { status: 400 },
      );
    }

    const { result, inputTokens, outputTokens } =
      await generateValuationCommentary(body);

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
