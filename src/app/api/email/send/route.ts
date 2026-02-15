import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmailSchema } from "@/lib/validations/email";
import { sendEmail } from "@/lib/email/send-engine";
import { createAuditLog } from "@/lib/audit";

/**
 * POST /api/email/send
 * Send an email via a connected email account (Gmail or Microsoft).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = sendEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { emailAccountId, ...rest } = parsed.data;

    // Look up the email account to determine provider
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Email account not found" },
        { status: 404 }
      );
    }

    if (!account.isConnected) {
      return NextResponse.json(
        { error: "Email account is disconnected. Please reconnect in Settings." },
        { status: 401 }
      );
    }

    const result = await sendEmail({
      ...rest,
      emailAccountId,
      provider: account.provider,
      senderEmail: account.email,
      senderDisplayName: account.displayName || undefined,
    });

    // Audit log for email send (if linked to a deal)
    if (rest.opportunityId) {
      await createAuditLog({
        eventType: "SENT",
        entityType: "EMAIL",
        entityId: result.email?.id || "unknown",
        opportunityId: rest.opportunityId,
        summary: `Sent email: ${rest.subject}`,
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error sending email:", error);

    const message =
      error instanceof Error ? error.message : "Failed to send email";

    // Surface permission errors clearly
    if (message.includes("permissions not granted") || message.includes("insufficientPermissions")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
