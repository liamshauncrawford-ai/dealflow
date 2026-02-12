/**
 * Gmail sync engine — incremental email sync using Gmail API history.
 *
 * Follows the same pattern as sync-engine.ts (MS365) but uses:
 *  - Gmail messages.list + messages.get for initial sync
 *  - Gmail history.list with startHistoryId for incremental sync
 *  - Base64url decoding for message body extraction
 */

import { prisma } from "@/lib/db";
import { getValidGmailAccessToken } from "./gmail-client";
import { computeMessageHash } from "./sync-engine";
import { categorizeEmail, TARGET_DOMAINS, BROKER_DOMAINS } from "@/lib/email-categorizer";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  payload?: {
    mimeType?: string;
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string; size?: number };
    parts?: GmailPart[];
  };
  internalDate?: string;
}

interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailHistoryResponse {
  history?: Array<{
    id: string;
    messagesAdded?: Array<{ message: { id: string } }>;
  }>;
  nextPageToken?: string;
  historyId?: string;
}

interface SyncResult {
  synced: number;
  errors: string[];
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_MESSAGES_PER_SYNC = 500;
const MAX_RETRY_ATTEMPTS = 3;

// ─────────────────────────────────────────────
// Main sync
// ─────────────────────────────────────────────

/**
 * Sync emails from a connected Gmail account.
 *
 * Initial sync: messages.list → messages.get for each
 * Incremental sync: history.list with startHistoryId
 */
export async function syncGmailEmails(
  emailAccountId: string
): Promise<SyncResult> {
  const errors: string[] = [];
  let synced = 0;

  const accessToken = await getValidGmailAccessToken(emailAccountId);

  const emailAccount = await prisma.emailAccount.findUnique({
    where: { id: emailAccountId },
  });

  if (!emailAccount) {
    throw new Error(`EmailAccount not found: ${emailAccountId}`);
  }

  if (!emailAccount.isConnected) {
    throw new Error(`EmailAccount is disconnected: ${emailAccountId}`);
  }

  const { syncCursor } = emailAccount;

  if (syncCursor) {
    // ── Incremental sync via history.list ─────────────────────────
    try {
      const result = await syncViaHistory(syncCursor, accessToken, emailAccountId);
      synced += result.synced;
      errors.push(...result.errors);

      // Update cursor with new historyId
      if (result.newHistoryId) {
        await prisma.emailAccount.update({
          where: { id: emailAccountId },
          data: {
            syncCursor: result.newHistoryId,
            lastSyncAt: new Date(),
          },
        });
      }
    } catch (err) {
      // If history is expired (404), fall back to full sync
      if (err instanceof Error && err.message.includes("404")) {
        console.warn("[gmail] History expired, falling back to full sync");
        const result = await syncFullMessageList(accessToken, emailAccountId);
        synced += result.synced;
        errors.push(...result.errors);

        if (result.latestHistoryId) {
          await prisma.emailAccount.update({
            where: { id: emailAccountId },
            data: {
              syncCursor: result.latestHistoryId,
              lastSyncAt: new Date(),
            },
          });
        }
      } else {
        throw err;
      }
    }
  } else {
    // ── Initial sync via messages.list ─────────────────────────────
    const result = await syncFullMessageList(accessToken, emailAccountId);
    synced += result.synced;
    errors.push(...result.errors);

    if (result.latestHistoryId) {
      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: {
          syncCursor: result.latestHistoryId,
          lastSyncAt: new Date(),
        },
      });
    }
  }

  return { synced, errors };
}

// ─────────────────────────────────────────────
// Full message list sync
// ─────────────────────────────────────────────

async function syncFullMessageList(
  accessToken: string,
  emailAccountId: string,
): Promise<{ synced: number; errors: string[]; latestHistoryId: string | null }> {
  const errors: string[] = [];
  let synced = 0;
  let latestHistoryId: string | null = null;
  let pageToken: string | undefined;
  let totalFetched = 0;

  do {
    const url = new URL(`${GMAIL_API_BASE}/messages`);
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const listResponse = await gmailFetch<GmailListResponse>(
      url.toString(),
      accessToken
    );

    if (!listResponse.messages || listResponse.messages.length === 0) break;

    // Fetch full details for each message
    for (const msgStub of listResponse.messages) {
      if (totalFetched >= MAX_MESSAGES_PER_SYNC) break;

      try {
        const fullMsg = await gmailFetch<GmailMessage>(
          `${GMAIL_API_BASE}/messages/${msgStub.id}?format=full`,
          accessToken
        );

        await upsertGmailEmail(fullMsg, emailAccountId);
        synced++;

        // Track the latest historyId for subsequent syncs
        if (fullMsg.historyId) {
          if (!latestHistoryId || fullMsg.historyId > latestHistoryId) {
            latestHistoryId = fullMsg.historyId;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to sync message ${msgStub.id}: ${msg}`);
      }

      totalFetched++;
    }

    pageToken = listResponse.nextPageToken;
  } while (pageToken && totalFetched < MAX_MESSAGES_PER_SYNC);

  return { synced, errors, latestHistoryId };
}

// ─────────────────────────────────────────────
// Incremental sync via history
// ─────────────────────────────────────────────

async function syncViaHistory(
  startHistoryId: string,
  accessToken: string,
  emailAccountId: string,
): Promise<{ synced: number; errors: string[]; newHistoryId: string | null }> {
  const errors: string[] = [];
  let synced = 0;
  let newHistoryId: string | null = null;
  let pageToken: string | undefined;

  const messageIdsToSync = new Set<string>();

  // Collect all new message IDs from history
  do {
    const url = new URL(`${GMAIL_API_BASE}/history`);
    url.searchParams.set("startHistoryId", startHistoryId);
    url.searchParams.set("historyTypes", "messageAdded");
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const historyResponse = await gmailFetch<GmailHistoryResponse>(
      url.toString(),
      accessToken
    );

    if (historyResponse.historyId) {
      newHistoryId = historyResponse.historyId;
    }

    if (historyResponse.history) {
      for (const entry of historyResponse.history) {
        if (entry.messagesAdded) {
          for (const added of entry.messagesAdded) {
            messageIdsToSync.add(added.message.id);
          }
        }
      }
    }

    pageToken = historyResponse.nextPageToken;
  } while (pageToken);

  // Fetch full message details for each new message
  for (const messageId of messageIdsToSync) {
    try {
      const fullMsg = await gmailFetch<GmailMessage>(
        `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
        accessToken
      );

      await upsertGmailEmail(fullMsg, emailAccountId);
      synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to sync message ${messageId}: ${msg}`);
    }
  }

  return { synced, errors, newHistoryId };
}

// ─────────────────────────────────────────────
// Email upsert
// ─────────────────────────────────────────────

async function upsertGmailEmail(message: GmailMessage, emailAccountId: string): Promise<void> {
  const headers = message.payload?.headers ?? [];
  const getHeader = (name: string): string | null => {
    const h = headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    );
    return h?.value ?? null;
  };

  const subject = getHeader("Subject");
  const from = getHeader("From") ?? "unknown";
  const to = getHeader("To") ?? "";
  const cc = getHeader("Cc") ?? "";

  // Parse From header: "Name <email>" or just "email"
  const fromParsed = parseEmailHeader(from);
  const toAddresses = parseEmailAddresses(to);
  const ccAddresses = parseEmailAddresses(cc);

  // Extract body
  const { textBody, htmlBody } = extractBody(message);
  const bodyPreview = textBody
    ? textBody.substring(0, 500)
    : message.snippet ?? null;

  // Parse date
  const dateHeader = getHeader("Date");
  const internalDate = message.internalDate
    ? new Date(parseInt(message.internalDate))
    : null;
  const sentAt = dateHeader ? new Date(dateHeader) : internalDate;
  const receivedAt = internalDate;

  // Determine if this might be a listing alert
  const isListingAlert = isLikelyListingAlert(fromParsed.address, subject);

  const fromAddress = fromParsed.address.toLowerCase().trim();
  const messageHash = computeMessageHash(fromAddress, subject, sentAt);

  // Cross-account dedup: skip if same message already synced from another account
  const existingByHash = await prisma.email.findFirst({
    where: {
      messageHash,
      emailAccountId: { not: emailAccountId },
    },
    select: { id: true },
  });

  if (existingByHash) {
    // Same message already exists from another account — skip
    return;
  }

  const data = {
    emailAccountId,
    messageHash,
    subject,
    bodyPreview,
    bodyHtml: htmlBody,
    fromAddress,
    fromName: fromParsed.name,
    toAddresses,
    ccAddresses,
    sentAt,
    receivedAt,
    conversationId: message.threadId ?? null,
    isRead: !(message.labelIds?.includes("UNREAD") ?? true),
    hasAttachments: message.payload?.parts?.some(
      (p) => p.body?.size && p.body.size > 0 && p.mimeType?.includes("application")
    ) ?? false,
    importance: message.labelIds?.includes("IMPORTANT") ? "high" : "normal",
    webLink: `https://mail.google.com/mail/u/0/#inbox/${message.id}`,
    isListingAlert,
  };

  // Categorize email for deal pipeline
  const category = categorizeEmail(
    {
      fromAddress: data.fromAddress,
      toAddresses: data.toAddresses,
      subject: data.subject,
      bodyPreview: data.bodyPreview,
    },
    {
      userDomain: "gmail.com",
      targetDomains: [...TARGET_DOMAINS],
      brokerDomains: [...BROKER_DOMAINS],
    }
  );

  const email = await prisma.email.upsert({
    where: { externalMessageId: message.id },
    create: {
      externalMessageId: message.id,
      ...data,
      emailCategory: category,
    },
    update: {
      ...data,
      emailCategory: category,
    },
  });

  // Extract and store attachment metadata
  if (data.hasAttachments) {
    const attachments = extractAttachmentMetadata(message);
    for (const att of attachments) {
      await prisma.emailAttachment.upsert({
        where: {
          emailId_filename: {
            emailId: email.id,
            filename: att.filename,
          },
        },
        create: {
          emailId: email.id,
          externalAttachmentId: att.attachmentId,
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
        },
        update: {
          externalAttachmentId: att.attachmentId,
          mimeType: att.mimeType,
          size: att.size,
        },
      });
    }
  }
}

// ─────────────────────────────────────────────
// Body extraction
// ─────────────────────────────────────────────

function extractBody(message: GmailMessage): {
  textBody: string | null;
  htmlBody: string | null;
} {
  let textBody: string | null = null;
  let htmlBody: string | null = null;

  function extractFromParts(parts: GmailPart[] | undefined) {
    if (!parts) return;

    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        textBody = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        htmlBody = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        extractFromParts(part.parts);
      }
    }
  }

  // Single-part message
  if (message.payload?.body?.data) {
    if (message.payload.mimeType === "text/html") {
      htmlBody = decodeBase64Url(message.payload.body.data);
    } else {
      textBody = decodeBase64Url(message.payload.body.data);
    }
  }

  // Multi-part message
  if (message.payload?.parts) {
    extractFromParts(message.payload.parts);
  }

  return { textBody, htmlBody };
}

// ─────────────────────────────────────────────
// Attachment metadata extraction
// ─────────────────────────────────────────────

interface AttachmentInfo {
  attachmentId: string | null;
  filename: string;
  mimeType: string;
  size: number;
}

function extractAttachmentMetadata(message: GmailMessage): AttachmentInfo[] {
  const attachments: AttachmentInfo[] = [];

  function extractFromParts(parts: GmailPart[] | undefined) {
    if (!parts) return;

    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          attachmentId: part.body?.attachmentId ?? null,
          filename: part.filename,
          mimeType: part.mimeType ?? "application/octet-stream",
          size: part.body?.size ?? 0,
        });
      }
      if (part.parts) {
        extractFromParts(part.parts);
      }
    }
  }

  if (message.payload?.parts) {
    extractFromParts(message.payload.parts);
  }

  return attachments;
}

function decodeBase64Url(data: string): string {
  // Gmail uses base64url encoding
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

// ─────────────────────────────────────────────
// Header parsing helpers
// ─────────────────────────────────────────────

function parseEmailHeader(header: string): {
  name: string | null;
  address: string;
} {
  // "John Doe <john@example.com>" or just "john@example.com"
  const match = header.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].replace(/^["']|["']$/g, "").trim(),
      address: match[2].trim(),
    };
  }
  return { name: null, address: header.trim() };
}

function parseEmailAddresses(header: string): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((addr) => {
      const parsed = parseEmailHeader(addr.trim());
      return parsed.address.toLowerCase().trim();
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Listing alert detection
// ─────────────────────────────────────────────

const LISTING_ALERT_SENDERS = [
  "bizbuysell.com",
  "bizquest.com",
  "dealstream.com",
  "transworld.com",
  "loopnet.com",
  "businessbroker.net",
  "sunbeltnetwork.com",
  "transactionadvisors.com",
  "tworld.com",
];

function isLikelyListingAlert(
  fromAddress: string,
  subject: string | null
): boolean {
  const normalizedFrom = fromAddress.toLowerCase();

  // Check if sender is from a known listing platform
  if (
    LISTING_ALERT_SENDERS.some((sender) => normalizedFrom.includes(sender))
  ) {
    return true;
  }

  // Check subject for listing alert patterns
  if (subject) {
    const lowerSubject = subject.toLowerCase();
    const alertPatterns = [
      "new listing",
      "new business",
      "new opportunity",
      "matches your search",
      "alert:",
      "business for sale",
      "listing alert",
      "saved search",
      "new results",
      "search genius",           // DealStream Search Genius alerts
      "today's new listings",    // DealStream daily digest
      "just posted",             // DealStream "new listings that were just posted"
      "price reduced",           // Price drop alerts
      "businesses for sale",     // Common listing digest subject
    ];
    if (alertPatterns.some((pattern) => lowerSubject.includes(pattern))) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────
// Gmail API fetch helper
// ─────────────────────────────────────────────

async function gmailFetch<T>(url: string, accessToken: string): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = (retryAfter ? parseInt(retryAfter) : 30) * 1000;
      console.warn(
        `[gmail] Rate limited. Waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`
      );
      await sleep(waitMs);
      continue;
    }

    if ([500, 502, 503, 504].includes(response.status)) {
      const waitMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[gmail] Transient error ${response.status}. Retrying in ${waitMs}ms`
      );
      lastError = new Error(`Gmail API ${response.status}: ${response.statusText}`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Gmail API [${response.status}]: ${response.statusText} — ${body}`
      );
    }

    return (await response.json()) as T;
  }

  throw lastError ?? new Error("Gmail API request failed after max retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
