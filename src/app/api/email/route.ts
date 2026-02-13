import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/email — List all email accounts (without sensitive token fields)
export async function GET() {
  try {
    const accounts = await prisma.emailAccount.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        provider: true,
        isConnected: true,
        lastSyncAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Error fetching email accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch email accounts" },
      { status: 500 }
    );
  }
}

// POST /api/email — Trigger email sync for an account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account exists and is connected
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
      select: { id: true, isConnected: true, provider: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Email account not found" },
        { status: 404 }
      );
    }

    if (!account.isConnected) {
      return NextResponse.json(
        { error: "Email account is disconnected" },
        { status: 400 }
      );
    }

    // Dispatch to the correct sync engine by provider
    let syncResult;
    if (account.provider === "GMAIL") {
      const { syncGmailEmails } = await import(
        "@/lib/email/gmail-sync-engine"
      );
      syncResult = await syncGmailEmails(accountId);
    } else {
      const { syncEmails } = await import("@/lib/email/sync-engine");
      syncResult = await syncEmails(accountId);
    }

    // Auto-link emails to opportunities (works for both providers)
    const { autoLinkEmails } = await import("@/lib/email/sync-engine");
    const linkResult = await autoLinkEmails(accountId);

    // Categorize any uncategorized emails (backfill)
    let categorized = 0;
    try {
      const { categorizeEmail, TARGET_DOMAINS, BROKER_DOMAINS } = await import(
        "@/lib/email-categorizer"
      );

      // Derive user domain from the account email for correct categorization
      const acctForDomain = await prisma.emailAccount.findUnique({
        where: { id: accountId },
        select: { email: true },
      });
      const userDomain = acctForDomain?.email?.split("@")[1] ?? "gmail.com";

      const uncategorized = await prisma.email.findMany({
        where: { emailCategory: null },
        select: {
          id: true,
          fromAddress: true,
          toAddresses: true,
          subject: true,
          bodyPreview: true,
        },
      });

      for (const email of uncategorized) {
        const category = categorizeEmail(
          {
            fromAddress: email.fromAddress,
            toAddresses: email.toAddresses,
            subject: email.subject,
            bodyPreview: email.bodyPreview,
          },
          {
            userDomain,
            targetDomains: [...TARGET_DOMAINS],
            brokerDomains: [...BROKER_DOMAINS],
          }
        );
        if (category) {
          await prisma.email.update({
            where: { id: email.id },
            data: { emailCategory: category },
          });
          categorized++;
        }
      }
    } catch (err) {
      console.error("Error categorizing emails:", err);
    }

    // AI classification for emails the pattern categorizer missed
    let aiClassified = 0;
    let aiSummarized = 0;
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        const { classifyEmailsBatch } = await import(
          "@/lib/ai/email-intelligence"
        );

        // Fetch emails that still have no category after pattern matching
        const stillUncategorized = await prisma.email.findMany({
          where: {
            emailCategory: null,
            aiClassifiedAt: null,
          },
          select: {
            id: true,
            fromAddress: true,
            fromName: true,
            toAddresses: true,
            subject: true,
            bodyPreview: true,
          },
          take: 60, // Up to 3 batches of 20
          orderBy: { sentAt: "desc" },
        });

        if (stillUncategorized.length > 0) {
          const aiResult = await classifyEmailsBatch(stillUncategorized);
          aiClassified = aiResult.classified;
          aiSummarized = aiResult.summarized;
        }
      }
    } catch (err) {
      console.error("Error in AI email classification:", err);
    }

    // Parse listing alert emails (for both providers)
    let alertResult = null;
    let newListingsFound = 0;
    try {
      const { parseListingAlertEmails } = await import(
        "@/lib/email/listing-email-parser"
      );
      alertResult = await parseListingAlertEmails();
      newListingsFound = alertResult?.listingsExtracted ?? 0;
    } catch (err) {
      console.error("Error parsing listing alerts:", err);
    }

    return NextResponse.json({
      synced: syncResult,
      linked: linkResult,
      categorized,
      aiClassified,
      aiSummarized,
      newListingsFound,
      ...(alertResult ? { alerts: alertResult } : {}),
    });
  } catch (error) {
    console.error("Error syncing emails:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to sync emails", details: message },
      { status: 500 }
    );
  }
}

// DELETE /api/email — Disconnect an email account
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Email account not found" },
        { status: 404 }
      );
    }

    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { isConnected: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting email account:", error);
    return NextResponse.json(
      { error: "Failed to disconnect email account" },
      { status: 500 }
    );
  }
}
