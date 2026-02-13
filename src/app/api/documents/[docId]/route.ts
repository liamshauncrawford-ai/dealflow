import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/documents/[docId]
 *
 * Serves a document's file content for download or inline preview.
 *
 * Query params:
 *   ?inline=true  → Content-Disposition: inline  (browser renders PDF / image)
 *   (default)     → Content-Disposition: attachment (triggers file download)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  try {
    const { docId } = await params;
    const { searchParams } = new URL(request.url);
    const inline = searchParams.get("inline") === "true";

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

    const mimeType = document.mimeType || "application/octet-stream";
    const disposition = inline
      ? "inline"
      : `attachment; filename="${encodeURIComponent(document.fileName)}"`;

    // Buffer is not a valid BodyInit in all environments — convert to Uint8Array
    const body = new Uint8Array(document.fileData);

    return new NextResponse(body, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        "Content-Length": body.byteLength.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error serving document:", error);
    return NextResponse.json(
      { error: "Failed to serve document" },
      { status: 500 },
    );
  }
}
