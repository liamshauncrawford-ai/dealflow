import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractFinancials } from "@/lib/ai/financial-extractor";
import { isAIEnabled } from "@/lib/ai/claude-client";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/pipeline/[id]/financials/extract
 *
 * Extract financial data from a document using AI.
 * Accepts either:
 *   - { documentId: string } — fetches document content
 *   - { text: string } — uses provided text directly
 *
 * Sends text to Claude for structured P&L extraction,
 * caches result in AIAnalysisResult.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: "AI features are not configured (ANTHROPIC_API_KEY missing)" },
        { status: 503 }
      );
    }

    const { id } = await params;
    const json = await request.json();

    let documentText: string;

    if (json.text && typeof json.text === "string") {
      // Direct text input
      documentText = json.text;
    } else if (json.documentId && typeof json.documentId === "string") {
      // Fetch document from DB
      const document = await prisma.dealDocument.findUnique({
        where: { id: json.documentId },
        select: { id: true, fileName: true, fileData: true, fileType: true, opportunityId: true },
      });

      if (!document) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      if (document.opportunityId !== id) {
        return NextResponse.json({ error: "Document does not belong to this opportunity" }, { status: 403 });
      }
      if (!document.fileData) {
        return NextResponse.json(
          { error: "Document has no file content stored." },
          { status: 400 }
        );
      }

      // Decode file content as text
      // For PDFs this is a rough extraction — production would use pdf-parse
      const buffer = Buffer.from(document.fileData);
      documentText = buffer.toString("utf-8");

      if (!documentText || documentText.length < 50) {
        return NextResponse.json(
          { error: "Could not extract readable text from this document. Try uploading a text-based file." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Either documentId or text is required" },
        { status: 400 }
      );
    }

    // Run AI extraction
    const extraction = await extractFinancials(documentText);

    // Cache result in AIAnalysisResult
    const cached = await prisma.aIAnalysisResult.create({
      data: {
        opportunityId: id,
        analysisType: "FINANCIAL_EXTRACTION",
        resultData: extraction as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        modelUsed: "claude-sonnet-4-5",
        inputTokens: 0,
        outputTokens: 0,
      },
    });

    return NextResponse.json({
      analysisId: cached.id,
      ...extraction,
    });
  } catch (error) {
    console.error("Failed to extract financials:", error);
    return NextResponse.json(
      { error: "Failed to extract financials from document" },
      { status: 500 }
    );
  }
}
