import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { getValidAccessToken } from "@/lib/email/msal-client";
import { categorizeEmail, TARGET_DOMAINS, BROKER_DOMAINS } from "@/lib/email-categorizer";

/**
 * Compute a content-based hash for cross-account email deduplication.
 * Uses SHA256(fromAddress|subject|sentAt_iso) — stable across providers.
 */
export function computeMessageHash(
  fromAddress: string,
  subject: string | null,
  sentAt: Date | null
): string {
  const parts = [
    fromAddress.toLowerCase().trim(),
    (subject ?? "").toLowerCase().trim(),
    sentAt ? sentAt.toISOString() : "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").substring(0, 40);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphEmailAddress {
  emailAddress: {
    name?: string;
    address: string;
  };
}

interface GraphMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  from?: GraphEmailAddress;
  toRecipients?: GraphEmailAddress[];
  ccRecipients?: GraphEmailAddress[];
  sentDateTime?: string;
  receivedDateTime?: string;
  conversationId?: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  importance?: string;
  webLink?: string;
  // Delta sync may include removed items
  "@removed"?: { reason: string };
}

interface GraphPageResponse {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

interface SyncResult {
  synced: number;
  errors: string[];
}

interface AutoLinkResult {
  linked: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const MESSAGE_SELECT_FIELDS = [
  "id",
  "subject",
  "bodyPreview",
  "from",
  "toRecipients",
  "ccRecipients",
  "sentDateTime",
  "receivedDateTime",
  "conversationId",
  "isRead",
  "hasAttachments",
  "importance",
  "webLink",
].join(",");

const INITIAL_MESSAGES_URL =
  `${GRAPH_BASE}/me/messages?$select=${MESSAGE_SELECT_FIELDS}&$top=100&$orderby=receivedDateTime desc`;

const DELTA_MESSAGES_URL =
  `${GRAPH_BASE}/me/messages/delta?$select=${MESSAGE_SELECT_FIELDS}&$top=100`;

const MAX_RETRY_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Helper: Authenticated Graph API GET request
// ---------------------------------------------------------------------------

/**
 * Makes an authenticated GET request to the Microsoft Graph API.
 *
 * Handles:
 * - Bearer token authorization
 * - 429 (Too Many Requests) with Retry-After header
 * - Exponential back-off on transient errors (500, 502, 503, 504)
 * - JSON parsing of the response body
 */
export async function fetchGraphApi<T = unknown>(
  url: string,
  accessToken: string,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // Rate limited -- respect Retry-After header
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 30;
      const waitMs = (isNaN(retryAfterSeconds) ? 30 : retryAfterSeconds) * 1000;
      console.warn(
        `[sync-engine] Rate limited by Graph API. Waiting ${waitMs}ms before retry (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}).`,
      );
      await sleep(waitMs);
      continue;
    }

    // Transient server errors -- exponential back-off
    if ([500, 502, 503, 504].includes(response.status)) {
      const waitMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[sync-engine] Transient error ${response.status}. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}).`,
      );
      lastError = new Error(
        `Graph API returned ${response.status}: ${response.statusText}`,
      );
      await sleep(waitMs);
      continue;
    }

    // Any other non-success status
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Graph API request failed [${response.status}]: ${response.statusText} — ${errorBody}`,
      );
    }

    return (await response.json()) as T;
  }

  throw lastError ?? new Error("Graph API request failed after max retries");
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

/**
 * Syncs emails from a connected Microsoft 365 account to the local database.
 *
 * On first run (no syncCursor), performs an initial sync by:
 *   1. Fetching recent messages via the standard messages endpoint (ordered by receivedDateTime desc)
 *   2. Fetching via the delta endpoint to obtain a deltaLink for subsequent syncs
 *
 * On subsequent runs, uses the stored deltaLink (syncCursor) to fetch only
 * changes since the last sync.
 *
 * All fetched messages are upserted (keyed on externalMessageId) into the Email table.
 * The deltaLink is persisted as syncCursor on the EmailAccount.
 */
export async function syncEmails(
  emailAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let synced = 0;

  // 1. Get a valid access token
  const accessToken = await getValidAccessToken(emailAccountId);

  // 2. Fetch the EmailAccount to get syncCursor
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
    // ── Delta sync (incremental) ────────────────────────────────────────
    const { deltaLink, processedCount, processErrors } = await fetchAllPages(
      syncCursor,
      accessToken,
      emailAccountId,
    );

    synced += processedCount;
    errors.push(...processErrors);

    // Persist the new deltaLink
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: {
        syncCursor: deltaLink ?? syncCursor,
        lastSyncAt: new Date(),
      },
    });
  } else {
    // ── Initial sync ────────────────────────────────────────────────────

    // Step A: Fetch recent messages from the standard messages endpoint.
    // This gives us a good initial batch ordered by receivedDateTime desc.
    const { processedCount: initialCount, processErrors: initialErrors } =
      await fetchAllPages(INITIAL_MESSAGES_URL, accessToken, emailAccountId);

    synced += initialCount;
    errors.push(...initialErrors);

    // Step B: Fetch via the delta endpoint to establish a deltaLink.
    // The delta endpoint may return messages we already upserted above,
    // which is fine because we upsert on externalMessageId.
    const { deltaLink, processedCount: deltaCount, processErrors: deltaErrors } =
      await fetchAllPages(DELTA_MESSAGES_URL, accessToken, emailAccountId);

    synced += deltaCount;
    errors.push(...deltaErrors);

    // Persist the deltaLink
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: {
        syncCursor: deltaLink ?? null,
        lastSyncAt: new Date(),
      },
    });
  }

  return { synced, errors };
}

// ---------------------------------------------------------------------------
// Auto-link emails to opportunities
// ---------------------------------------------------------------------------

/**
 * Automatically links unlinked emails to opportunities by matching:
 * 1. Email addresses (from/to) against broker emails and contact emails
 * 2. Email subject against listing businessName or opportunity title
 * 3. Email body preview against listing businessName or opportunity title
 */
export async function autoLinkEmails(
  emailAccountId: string,
): Promise<AutoLinkResult> {
  // Verify the account exists
  const emailAccount = await prisma.emailAccount.findUnique({
    where: { id: emailAccountId },
  });

  if (!emailAccount) {
    throw new Error(`EmailAccount not found: ${emailAccountId}`);
  }

  // 1. Get all unlinked emails (emails that have no entries in EmailLink)
  const unlinkedEmails = await prisma.email.findMany({
    where: {
      links: {
        none: {},
      },
    },
  });

  if (unlinkedEmails.length === 0) {
    return { linked: 0 };
  }

  // 2. Get all opportunities with their linked listings and contacts
  const opportunities = await prisma.opportunity.findMany({
    include: {
      listing: {
        select: {
          brokerEmail: true,
          brokerName: true,
          businessName: true,
          title: true,
        },
      },
      contacts: {
        select: {
          email: true,
        },
      },
    },
  });

  if (opportunities.length === 0) {
    return { linked: 0 };
  }

  let linked = 0;

  // Build a lookup of email address -> opportunity IDs for fast matching
  const emailToOppIds = new Map<string, string[]>();
  const addEmailMapping = (email: string, oppId: string) => {
    const normalized = email.toLowerCase().trim();
    if (!normalized) return;
    const existing = emailToOppIds.get(normalized) ?? [];
    existing.push(oppId);
    emailToOppIds.set(normalized, existing);
  };

  for (const opp of opportunities) {
    // Match broker emails
    if (opp.listing?.brokerEmail) {
      addEmailMapping(opp.listing.brokerEmail, opp.id);
    }
    // Match contact emails
    for (const contact of opp.contacts) {
      if (contact.email) {
        addEmailMapping(contact.email, opp.id);
      }
    }
  }

  // Build patterns for text matching (subject + body)
  // Use a minimum length of 5 to reduce false positives
  const textPatterns: Array<{ pattern: string; oppId: string }> = [];
  for (const opp of opportunities) {
    if (opp.listing?.businessName && opp.listing.businessName.length >= 5) {
      textPatterns.push({
        pattern: opp.listing.businessName.toLowerCase(),
        oppId: opp.id,
      });
    }
    if (opp.listing?.title && opp.listing.title.length >= 5) {
      textPatterns.push({
        pattern: opp.listing.title.toLowerCase(),
        oppId: opp.id,
      });
    }
    if (opp.title && opp.title.length >= 5) {
      textPatterns.push({
        pattern: opp.title.toLowerCase(),
        oppId: opp.id,
      });
    }
  }

  // Deduplicate patterns (same pattern pointing to same opp)
  const seenPatterns = new Set<string>();
  const uniquePatterns = textPatterns.filter((p) => {
    const key = `${p.pattern}::${p.oppId}`;
    if (seenPatterns.has(key)) return false;
    seenPatterns.add(key);
    return true;
  });

  // 3. For each unlinked email, attempt to match
  for (const email of unlinkedEmails) {
    const matchedOppIds = new Set<string>();

    // Collect all email addresses involved in this message
    const allAddresses = [
      email.fromAddress.toLowerCase().trim(),
      ...email.toAddresses.map((a) => a.toLowerCase().trim()),
    ];

    // Match by email address against broker/contact emails
    for (const address of allAddresses) {
      const oppIds = emailToOppIds.get(address);
      if (oppIds) {
        for (const oppId of oppIds) {
          matchedOppIds.add(oppId);
        }
      }
    }

    // Match by subject + body preview against business names / titles
    const searchableText = [
      email.subject ?? "",
      email.bodyPreview ?? "",
    ].join(" ").toLowerCase();

    if (searchableText.length > 0) {
      for (const { pattern, oppId } of uniquePatterns) {
        if (searchableText.includes(pattern)) {
          matchedOppIds.add(oppId);
        }
      }
    }

    // Create EmailLink records for each match
    for (const oppId of matchedOppIds) {
      try {
        await prisma.emailLink.create({
          data: {
            emailId: email.id,
            opportunityId: oppId,
            linkedBy: "auto",
          },
        });
        linked++;
      } catch (error: unknown) {
        // Unique constraint violation means the link already exists -- skip
        if (isPrismaUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }
  }

  return { linked };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Pages through a Graph API list/delta response, processing each message
 * and following @odata.nextLink until @odata.deltaLink is received.
 */
async function fetchAllPages(
  startUrl: string,
  accessToken: string,
  emailAccountId: string,
): Promise<{
  deltaLink: string | null;
  processedCount: number;
  processErrors: string[];
}> {
  let url: string | null = startUrl;
  let deltaLink: string | null = null;
  let processedCount = 0;
  const processErrors: string[] = [];

  while (url) {
    const page: GraphPageResponse = await fetchGraphApi<GraphPageResponse>(url, accessToken);

    // Process each message in this page
    if (page.value && page.value.length > 0) {
      for (const message of page.value) {
        try {
          // Delta responses may include removed items -- skip those
          if (message["@removed"]) {
            continue;
          }

          await upsertEmail(message, emailAccountId);
          processedCount++;
        } catch (error: unknown) {
          const errMsg =
            error instanceof Error ? error.message : String(error);
          processErrors.push(
            `Failed to upsert message ${message.id}: ${errMsg}`,
          );
          console.error(
            `[sync-engine] Failed to upsert message ${message.id}:`,
            error,
          );
        }
      }
    }

    // Check for next page or delta link
    if (page["@odata.deltaLink"]) {
      deltaLink = page["@odata.deltaLink"];
      url = null; // We have the delta link; done paging
    } else if (page["@odata.nextLink"]) {
      url = page["@odata.nextLink"];
    } else {
      url = null; // No more pages and no delta link
    }
  }

  return { deltaLink, processedCount, processErrors };
}

/**
 * Upserts a single Graph API message into the Email table.
 * Uses externalMessageId as the unique key.
 * Computes messageHash for cross-account deduplication — if a message
 * with the same hash already exists from another account, we skip it
 * (the first account to sync "owns" the canonical copy).
 */
async function upsertEmail(message: GraphMessage, emailAccountId: string): Promise<void> {
  const fromAddress =
    message.from?.emailAddress?.address?.toLowerCase().trim() ?? "unknown";
  const fromName = message.from?.emailAddress?.name ?? null;

  const toAddresses = (message.toRecipients ?? [])
    .map((r) => r.emailAddress?.address?.toLowerCase().trim())
    .filter(Boolean) as string[];

  const ccAddresses = (message.ccRecipients ?? [])
    .map((r) => r.emailAddress?.address?.toLowerCase().trim())
    .filter(Boolean) as string[];

  const sentAt = message.sentDateTime ? new Date(message.sentDateTime) : null;
  const receivedAt = message.receivedDateTime
    ? new Date(message.receivedDateTime)
    : null;

  const messageHash = computeMessageHash(fromAddress, message.subject ?? null, sentAt);

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

  // Categorize email for deal pipeline
  const category = categorizeEmail(
    {
      fromAddress,
      toAddresses,
      subject: message.subject ?? null,
      bodyPreview: message.bodyPreview ?? null,
    },
    {
      userDomain: "gmail.com",
      targetDomains: [...TARGET_DOMAINS],
      brokerDomains: [...BROKER_DOMAINS],
    }
  );

  const data = {
    emailAccountId,
    messageHash,
    subject: message.subject ?? null,
    bodyPreview: message.bodyPreview ?? null,
    fromAddress,
    fromName,
    toAddresses,
    ccAddresses,
    sentAt,
    receivedAt,
    conversationId: message.conversationId ?? null,
    isRead: message.isRead ?? false,
    hasAttachments: message.hasAttachments ?? false,
    importance: message.importance ?? null,
    webLink: message.webLink ?? null,
    emailCategory: category,
  };

  await prisma.email.upsert({
    where: { externalMessageId: message.id },
    create: {
      externalMessageId: message.id,
      ...data,
    },
    update: data,
  });
}

/**
 * Checks whether an error is a Prisma unique constraint violation (P2002).
 */
function isPrismaUniqueConstraintError(error: unknown): boolean {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  ) {
    return true;
  }
  return false;
}

/**
 * Sleeps for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
