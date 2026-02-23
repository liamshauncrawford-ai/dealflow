/**
 * Email Send Engine
 *
 * Provider-agnostic email sending that routes to Gmail or Microsoft Graph.
 * After sending, persists the email in the database and optionally links to an opportunity.
 */

import { prisma } from "@/lib/db";
import { getValidGmailAccessToken } from "./gmail-client";
import { getValidAccessToken } from "./msal-client";
import type { SendEmailInput } from "@/lib/validations/email";
import crypto from "crypto";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export interface SendEmailParams extends SendEmailInput {
  /** Resolved from the email account — set by the API route */
  provider: "GMAIL" | "MICROSOFT";
  /** Display name for the From header */
  senderDisplayName?: string;
  /** Sender email address for the From header */
  senderEmail: string;
}

export interface SendEmailResult {
  email: {
    id: string;
    externalMessageId: string;
    subject: string | null;
  };
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const {
    emailAccountId,
    provider,
    to,
    cc,
    subject,
    bodyHtml,
    senderEmail,
    senderDisplayName,
    opportunityId,
    inReplyToExternalId,
    conversationId,
  } = params;

  let externalMessageId: string;

  if (provider === "GMAIL") {
    externalMessageId = await sendViaGmail({
      emailAccountId,
      to,
      cc,
      subject,
      bodyHtml,
      senderEmail,
      senderDisplayName,
      inReplyToExternalId,
    });
  } else {
    externalMessageId = await sendViaMicrosoft({
      emailAccountId,
      to,
      cc,
      subject,
      bodyHtml,
      inReplyToExternalId,
      conversationId,
    });
  }

  // Persist the sent email in the database
  const messageHash = crypto
    .createHash("sha256")
    .update(`${senderEmail}|${subject}|${new Date().toISOString()}`)
    .digest("hex");

  const email = await prisma.email.create({
    data: {
      emailAccountId,
      externalMessageId,
      messageHash,
      subject,
      bodyPreview: stripHtml(bodyHtml).slice(0, 500),
      bodyHtml,
      fromAddress: senderEmail,
      fromName: senderDisplayName || null,
      toAddresses: to,
      ccAddresses: cc || [],
      sentAt: new Date(),
      receivedAt: new Date(),
      isRead: true,
      isSent: true,
      inReplyToExternalId: inReplyToExternalId || null,
      conversationId: conversationId || null,
    },
  });

  // Auto-link to opportunity if provided
  if (opportunityId) {
    await prisma.emailLink.create({
      data: {
        emailId: email.id,
        opportunityId,
        linkedBy: "auto-sent",
      },
    });

    // Auto-set contactedAt if not already set — sending an email proves contact was made
    await prisma.opportunity.updateMany({
      where: { id: opportunityId, contactedAt: null },
      data: { contactedAt: email.sentAt ?? new Date() },
    });
  }

  return {
    email: {
      id: email.id,
      externalMessageId: email.externalMessageId,
      subject: email.subject,
    },
  };
}

// ─────────────────────────────────────────────
// Gmail Send (RFC 2822)
// ─────────────────────────────────────────────

interface GmailSendParams {
  emailAccountId: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  senderEmail: string;
  senderDisplayName?: string;
  inReplyToExternalId?: string;
}

async function sendViaGmail(params: GmailSendParams): Promise<string> {
  const accessToken = await getValidGmailAccessToken(params.emailAccountId);

  // Build RFC 2822 raw message
  const lines: string[] = [];

  const fromHeader = params.senderDisplayName
    ? `"${params.senderDisplayName}" <${params.senderEmail}>`
    : params.senderEmail;

  lines.push(`From: ${fromHeader}`);
  lines.push(`To: ${params.to.join(", ")}`);
  if (params.cc && params.cc.length > 0) {
    lines.push(`Cc: ${params.cc.join(", ")}`);
  }
  lines.push(`Subject: ${mimeEncodeSubject(params.subject)}`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Content-Type: text/html; charset=UTF-8`);

  if (params.inReplyToExternalId) {
    lines.push(`In-Reply-To: <${params.inReplyToExternalId}>`);
    lines.push(`References: <${params.inReplyToExternalId}>`);
  }

  lines.push(""); // blank line separates headers from body
  lines.push(params.bodyHtml);

  const rawMessage = lines.join("\r\n");
  const encoded = base64UrlEncode(rawMessage);

  const res = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Gmail send failed:", res.status, errorBody);

    if (res.status === 403 && errorBody.includes("insufficientPermissions")) {
      throw new Error(
        "Gmail send permissions not granted. Please disconnect and reconnect your Gmail account in Settings to grant send permissions."
      );
    }

    throw new Error(`Gmail send failed: ${res.status} ${errorBody}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

// ─────────────────────────────────────────────
// Microsoft Graph Send
// ─────────────────────────────────────────────

interface MicrosoftSendParams {
  emailAccountId: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  inReplyToExternalId?: string;
  conversationId?: string;
}

async function sendViaMicrosoft(params: MicrosoftSendParams): Promise<string> {
  const accessToken = await getValidAccessToken(params.emailAccountId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message: Record<string, any> = {
    subject: params.subject,
    body: {
      contentType: "HTML",
      content: params.bodyHtml,
    },
    toRecipients: params.to.map((addr) => ({
      emailAddress: { address: addr },
    })),
  };

  if (params.cc && params.cc.length > 0) {
    message.ccRecipients = params.cc.map((addr) => ({
      emailAddress: { address: addr },
    }));
  }

  if (params.conversationId) {
    message.conversationId = params.conversationId;
  }

  // For replies, set the internetMessageHeaders for In-Reply-To
  if (params.inReplyToExternalId) {
    message.internetMessageHeaders = [
      {
        name: "In-Reply-To",
        value: `<${params.inReplyToExternalId}>`,
      },
      {
        name: "References",
        value: `<${params.inReplyToExternalId}>`,
      },
    ];
  }

  const res = await fetch(`${GRAPH_BASE}/me/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Microsoft send failed:", res.status, errorBody);
    throw new Error(`Microsoft Graph send failed: ${res.status} ${errorBody}`);
  }

  // sendMail returns 202 Accepted with no body — generate a unique ID
  // The actual message ID will be available in Sent Items after sync
  return `sent-${Date.now()}-${crypto.randomUUID()}`;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function mimeEncodeSubject(subject: string): string {
  // Only MIME-encode if subject contains non-ASCII characters
  if (/^[\x00-\x7F]*$/.test(subject)) {
    return subject;
  }
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}
