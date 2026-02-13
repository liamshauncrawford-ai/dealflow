import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DocumentCategory } from "@prisma/client";
import { parseBody } from "@/lib/validations/common";
import { updateDocumentSchema } from "@/lib/validations/pipeline";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword", // doc
  "text/csv",
  "image/png",
  "image/jpeg",
];

const VALID_CATEGORIES = [
  "CIM", "FINANCIAL_MODEL", "FINANCIAL_STATEMENT",
  "TAX_RETURN", "LOI", "NDA", "VALUATION", "OTHER",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const DOC_SELECT = {
  id: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  category: true,
  mimeType: true,
  description: true,
  uploadedAt: true,
  importedAt: true,
  // fileData intentionally excluded
};

// ---------------------------------------------------------------------------
// GET /api/pipeline/[id]/documents — list documents for an opportunity
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const documents = await prisma.dealDocument.findMany({
      where: { opportunityId: id },
      orderBy: [{ category: "asc" }, { importedAt: "desc" }],
      select: DOC_SELECT,
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/pipeline/[id]/documents — upload a document
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 },
      );
    }

    // Parse multipart form data (native Next.js — no multer needed)
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as string;
    const description = (formData.get("description") as string) || null;

    // Validate file
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 25 MB limit" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed` },
        { status: 400 },
      );
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "Invalid document category" },
        { status: 400 },
      );
    }

    // Convert File to Buffer for Prisma Bytes storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileType = file.name.split(".").pop()?.toLowerCase() || "";

    const document = await prisma.dealDocument.create({
      data: {
        opportunityId: id,
        fileName: file.name,
        fileType,
        fileSize: file.size,
        category: category as DocumentCategory,
        fileData: buffer,
        mimeType: file.type,
        description,
        uploadedAt: new Date(),
      },
      select: DOC_SELECT,
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/pipeline/[id]/documents?documentId=XXX — update metadata
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId query parameter is required" },
        { status: 400 },
      );
    }

    const parsed = await parseBody(updateDocumentSchema, request);
    if (parsed.error) return parsed.error;

    const existing = await prisma.dealDocument.findFirst({
      where: { id: documentId, opportunityId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const document = await prisma.dealDocument.update({
      where: { id: documentId },
      data: updateData,
      select: DOC_SELECT,
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/pipeline/[id]/documents?documentId=XXX — remove a document
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId query parameter is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.dealDocument.findFirst({
      where: { id: documentId, opportunityId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    await prisma.dealDocument.delete({ where: { id: documentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
