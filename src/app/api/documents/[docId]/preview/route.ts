import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderDocumentPreview, isPreviewableMime } from "@/lib/document-preview";

/**
 * GET /api/documents/[docId]/preview
 *
 * Returns server-rendered HTML preview of a document.
 * Supports: XLSX, XLS, CSV, DOCX.
 * PDFs and images are handled client-side (iframe src / img tag) and don't
 * need this route.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  try {
    const { docId } = await params;

    const document = await prisma.dealDocument.findUnique({
      where: { id: docId },
      select: { fileData: true, fileName: true, mimeType: true, fileType: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    if (!document.fileData) {
      return NextResponse.json(
        { error: "No file content available (legacy import)" },
        { status: 404 },
      );
    }

    const mimeType = document.mimeType || "";
    if (!isPreviewableMime(mimeType)) {
      return NextResponse.json(
        { error: "Preview not supported for this file type" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(document.fileData);
    const result = await renderDocumentPreview(buffer, mimeType);

    return new NextResponse(result.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error generating document preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 },
    );
  }
}
