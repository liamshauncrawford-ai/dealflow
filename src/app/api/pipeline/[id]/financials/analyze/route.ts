import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { callClaudeStructured } from "@/lib/ai/claude-client";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

type RouteParams = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────
// Output schema for structured AI response
// ─────────────────────────────────────────────

const FINANCIAL_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "2-3 sentence executive summary" },
    qualityScore: { type: "number", description: "1-10 quality rating of the financial data" },
    insights: {
      type: "array",
      items: { type: "string" },
      description: "Key observations about the financials",
    },
    redFlags: {
      type: "array",
      items: { type: "string" },
      description: "Concerns or risk factors",
    },
    growthAnalysis: { type: "string", description: "Revenue and margin trends analysis" },
    marginAnalysis: { type: "string", description: "P&L structure assessment" },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "Actionable recommendations for the buyer",
    },
  },
  required: ["summary", "qualityScore", "insights", "redFlags", "growthAnalysis", "marginAnalysis", "recommendations"],
  additionalProperties: false,
} as const;

interface FinancialAnalysisResult {
  summary: string;
  qualityScore: number;
  insights: string[];
  redFlags: string[];
  growthAnalysis: string;
  marginAnalysis: string;
  recommendations: string[];
}

const ANALYSIS_OUTPUT_FORMAT = jsonSchemaOutputFormat(FINANCIAL_ANALYSIS_SCHEMA);

const SYSTEM_PROMPT = `You are a seasoned M&A analyst specializing in lower-middle-market acquisitions of specialty trade contractors (electrical, structured cabling, data center services).

You are reviewing P&L financial data for a potential acquisition target. Analyze the data with a buyer's lens — identify risks, opportunities, and anything that would affect valuation or deal structure.

Be specific. Reference actual numbers. Point out things a buyer would want to negotiate or investigate further in due diligence.`;

// ─────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────

/**
 * POST /api/pipeline/[id]/financials/analyze
 *
 * Runs AI analysis on the latest saved financial data for an opportunity.
 * Stores result in AIAnalysisResult for the Overview tab to reference.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Fetch all financial periods with line items and add-backs
    const periods = await prisma.financialPeriod.findMany({
      where: { opportunityId: id },
      orderBy: [{ year: "asc" }, { periodType: "asc" }],
      include: {
        lineItems: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
        addBacks: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
      },
    });

    if (periods.length === 0) {
      return NextResponse.json({ error: "No financial periods to analyze" }, { status: 400 });
    }

    // Fetch opportunity name for context
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { title: true },
    });

    // Build a structured prompt with actual P&L data
    const periodsText = periods.map((period) => {
      const label = period.label || `${period.periodType} ${period.year}${period.quarter ? ` Q${period.quarter}` : ""}`;

      const lineItemsText = period.lineItems.map((li) =>
        `  ${li.category}: ${li.rawLabel} = $${Number(li.amount).toLocaleString()}`
      ).join("\n");

      const addBacksText = period.addBacks.length > 0
        ? period.addBacks.map((ab) =>
            `  ${ab.category}: ${ab.description} = $${Number(ab.amount).toLocaleString()}`
          ).join("\n")
        : "  (none)";

      const metrics = [
        `Revenue: $${period.totalRevenue ? Number(period.totalRevenue).toLocaleString() : "N/A"}`,
        `Gross Profit: $${period.grossProfit ? Number(period.grossProfit).toLocaleString() : "N/A"}`,
        `Gross Margin: ${period.grossMargin ? (Number(period.grossMargin) * 100).toFixed(1) + "%" : "N/A"}`,
        `EBITDA: $${period.ebitda ? Number(period.ebitda).toLocaleString() : "N/A"}`,
        `EBITDA Margin: ${period.ebitdaMargin ? (Number(period.ebitdaMargin) * 100).toFixed(1) + "%" : "N/A"}`,
        `Net Income: $${period.netIncome ? Number(period.netIncome).toLocaleString() : "N/A"}`,
        `Total Add-Backs: $${period.totalAddBacks ? Number(period.totalAddBacks).toLocaleString() : "0"}`,
        `Adj. EBITDA: $${period.adjustedEbitda ? Number(period.adjustedEbitda).toLocaleString() : "N/A"}`,
        `Adj. EBITDA Margin: ${period.adjustedEbitdaMargin ? (Number(period.adjustedEbitdaMargin) * 100).toFixed(1) + "%" : "N/A"}`,
        `SDE: $${period.sde ? Number(period.sde).toLocaleString() : "N/A"}`,
      ].join("\n");

      return `=== ${label} ===\nLINE ITEMS:\n${lineItemsText}\n\nADD-BACKS:\n${addBacksText}\n\nSUMMARY METRICS:\n${metrics}`;
    }).join("\n\n");

    const userPrompt = `Analyze the financial data for "${opportunity?.title ?? "Target Company"}":\n\n${periodsText}\n\nProvide your analysis.`;

    const response = await callClaudeStructured<FinancialAnalysisResult>({
      model: "sonnet",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 2000,
      outputFormat: ANALYSIS_OUTPUT_FORMAT,
    });

    // Store the result in AIAnalysisResult
    const analysisRecord = await prisma.aIAnalysisResult.create({
      data: {
        opportunityId: id,
        analysisType: "FINANCIAL_ANALYSIS",
        modelUsed: "claude-sonnet-4-5",
        resultData: response.parsed as object,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });

    return NextResponse.json({
      id: analysisRecord.id,
      analysis: response.parsed,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });
  } catch (error) {
    console.error("Failed to analyze financials:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze financials" },
      { status: 500 },
    );
  }
}
