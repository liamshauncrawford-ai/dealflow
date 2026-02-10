import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getValidGmailAccessToken } from "@/lib/email/gmail-client";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * GET /api/email/attachments/[id]
 * Downloads an email attachment by its ID.
 * Returns the raw file content with appropriate headers.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Look up the attachment record
    const attachment = await prisma.emailAttachment.findUnique({
      where: { id },
      include: {
        email: {
          select: {
            externalMessageId: true,
            emailAccountId: true,
          },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    if (!attachment.externalAttachmentId) {
      return NextResponse.json(
        { error: "No external attachment ID — cannot download" },
        { status: 400 }
      );
    }

    if (!attachment.email.emailAccountId) {
      return NextResponse.json(
        { error: "Email account not found" },
        { status: 400 }
      );
    }

    // Get a valid access token
    const accessToken = await getValidGmailAccessToken(
      attachment.email.emailAccountId
    );

    // Fetch the attachment content from Gmail API
    const url = `${GMAIL_API_BASE}/messages/${attachment.email.externalMessageId}/attachments/${attachment.externalAttachmentId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gmail attachment download failed:", errorText);
      return NextResponse.json(
        { error: "Failed to download attachment from Gmail" },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!data.data) {
      return NextResponse.json(
        { error: "No attachment data returned" },
        { status: 404 }
      );
    }

    // Gmail returns base64url-encoded data
    const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
    const buffer = Buffer.from(base64, "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error downloading attachment:", error);
    return NextResponse.json(
      { error: "Failed to download attachment" },
      { status: 500 }
    );
  }
}
