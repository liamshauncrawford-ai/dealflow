/**
 * AI-powered email intelligence.
 *
 * - classifyEmailsBatch(): Categorizes uncategorized emails via Claude Haiku 4.5
 * - summarizeEmail(): Generates one-line AI summary for an email
 * - detectCIMAttachment(): Checks if an email attachment is likely a CIM
 *
 * Cost: ~$0.004 per batch of 20 emails (Haiku)
 */

import { callClaude, safeJsonParse, isAIEnabled } from "./claude-client";
import { prisma } from "@/lib/db";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface EmailForClassification {
  id: string;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  subject: string | null;
  bodyPreview: string | null;
}

interface ClassificationResult {
  id: string;
  category: string | null;
  summary: string | null;
}

interface CIMDetectionResult {
  isCIM: boolean;
  suggestedBusinessName: string | null;
  confidence: number;
}

// ─────────────────────────────────────────────
// Valid EmailCategory values (must match Prisma enum)
// ─────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  "COLD_OUTREACH",
  "WARM_INTRODUCTION",
  "INITIAL_RESPONSE",
  "DISCOVERY_CALL",
  "LOI_TERM_SHEET",
  "DUE_DILIGENCE",
  "CLOSING",
  "DEAD_PASSED",
  "LISTING_ALERT",
  "BROKER_UPDATE",
]);

// ─────────────────────────────────────────────
// Batch Email Classification (~$0.004 per batch of 20)
// ─────────────────────────────────────────────

const CLASSIFY_SYSTEM_PROMPT = `You are an email classifier for a lower middle-market M&A deal pipeline. The user is buying IT infrastructure / trades companies in Colorado.

Classify each email into ONE of these categories:
- COLD_OUTREACH: Buyer's initial outreach to a target or broker
- WARM_INTRODUCTION: Someone introducing buyer to a seller/broker
- INITIAL_RESPONSE: First reply from a target company or owner
- DISCOVERY_CALL: Scheduling or follow-up from an introductory call
- LOI_TERM_SHEET: Discussions about letter of intent, offers, terms
- DUE_DILIGENCE: Requests for financials, tax returns, P&L, operational docs
- CLOSING: Purchase agreements, closing logistics, wire instructions, escrow
- DEAD_PASSED: Rejections, no interest, deal fallen through
- LISTING_ALERT: Automated listing alerts from BizBuySell, BizQuest, DealStream, Transworld
- BROKER_UPDATE: Updates from business brokers about available businesses

If you cannot confidently classify an email, use null.

Also provide a one-sentence summary (max 100 chars) of each email's content.

Respond with a JSON array: [{ "id": "...", "category": "..." | null, "summary": "..." }]`;

const MAX_BATCH_SIZE = 20;

export async function classifyEmailsBatch(
  emails: EmailForClassification[],
): Promise<{ classified: number; summarized: number }> {
  if (!isAIEnabled() || emails.length === 0) {
    return { classified: 0, summarized: 0 };
  }

  let totalClassified = 0;
  let totalSummarized = 0;

  // Process in batches of MAX_BATCH_SIZE
  for (let i = 0; i < emails.length; i += MAX_BATCH_SIZE) {
    const batch = emails.slice(i, i + MAX_BATCH_SIZE);

    const emailSummaries = batch.map((e) => ({
      id: e.id,
      from: e.fromName ? `${e.fromName} <${e.fromAddress}>` : e.fromAddress,
      to: e.toAddresses.join(", "),
      subject: e.subject || "(no subject)",
      preview: (e.bodyPreview || "").slice(0, 500),
    }));

    try {
      const response = await callClaude({
        model: "haiku",
        system: CLASSIFY_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Classify and summarize these ${batch.length} emails:\n\n${JSON.stringify(emailSummaries, null, 2)}`,
          },
        ],
        maxTokens: 2048,
        temperature: 0,
      });

      const results = safeJsonParse<ClassificationResult[]>(response.text);

      // Update each email
      for (const result of results) {
        const updateData: Record<string, unknown> = {};

        if (result.category && VALID_CATEGORIES.has(result.category)) {
          updateData.emailCategory = result.category;
          updateData.aiClassifiedAt = new Date();
          totalClassified++;
        }

        if (result.summary) {
          updateData.aiSummary = result.summary.slice(0, 200);
          totalSummarized++;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.email.update({
            where: { id: result.id },
            data: updateData,
          });
        }
      }
    } catch (err) {
      console.error(
        `[AI] Email classification batch failed (${batch.length} emails):`,
        err,
      );
      // Continue with next batch on error
    }
  }

  return { classified: totalClassified, summarized: totalSummarized };
}

// ─────────────────────────────────────────────
// Single Email Summary (~$0.001)
// ─────────────────────────────────────────────

export async function summarizeEmail(email: {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  fromAddress: string;
}): Promise<string | null> {
  if (!isAIEnabled()) return null;

  try {
    const response = await callClaude({
      model: "haiku",
      system:
        "You are a concise email summarizer. Provide a single-sentence summary (max 100 characters) of the email's content and intent. Just the summary text, no quotes or prefix.",
      messages: [
        {
          role: "user",
          content: `Subject: ${email.subject || "(no subject)"}\nFrom: ${email.fromAddress}\nPreview: ${(email.bodyPreview || "").slice(0, 500)}`,
        },
      ],
      maxTokens: 100,
      temperature: 0,
    });

    const summary = response.text.trim().slice(0, 200);

    await prisma.email.update({
      where: { id: email.id },
      data: { aiSummary: summary },
    });

    return summary;
  } catch (err) {
    console.error("[AI] Email summarization failed:", err);
    return null;
  }
}

// ─────────────────────────────────────────────
// CIM Attachment Detection
// ─────────────────────────────────────────────

const CIM_FILENAME_PATTERNS = [
  /cim/i,
  /confidential.*memorandum/i,
  /information.*memorandum/i,
  /executive.*summary/i,
  /business.*summary/i,
  /offering.*memorandum/i,
  /om[\s_-]/i,
  /teaser/i,
];

export async function detectCIMAttachment(attachment: {
  filename: string;
  mimeType: string;
  emailSubject: string | null;
  emailFromAddress: string;
  emailBodyPreview: string | null;
}): Promise<CIMDetectionResult> {
  // Quick filename check first (no API cost)
  const filenameMatch = CIM_FILENAME_PATTERNS.some((p) =>
    p.test(attachment.filename),
  );

  if (filenameMatch && attachment.mimeType === "application/pdf") {
    return {
      isCIM: true,
      suggestedBusinessName: extractBusinessNameFromFilename(
        attachment.filename,
      ),
      confidence: 0.85,
    };
  }

  // For PDFs that don't match filename patterns, check context with AI
  if (attachment.mimeType === "application/pdf" && isAIEnabled()) {
    try {
      const response = await callClaude({
        model: "haiku",
        system:
          "Determine if this email attachment is likely a CIM (Confidential Information Memorandum) for a business sale. Respond with JSON: { \"isCIM\": boolean, \"suggestedBusinessName\": string | null, \"confidence\": number }",
        messages: [
          {
            role: "user",
            content: `Filename: ${attachment.filename}\nEmail subject: ${attachment.emailSubject || "N/A"}\nFrom: ${attachment.emailFromAddress}\nEmail preview: ${(attachment.emailBodyPreview || "").slice(0, 300)}`,
          },
        ],
        maxTokens: 150,
        temperature: 0,
      });

      return safeJsonParse<CIMDetectionResult>(response.text);
    } catch {
      // Fallback to non-AI detection
    }
  }

  return { isCIM: false, suggestedBusinessName: null, confidence: 0 };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function extractBusinessNameFromFilename(filename: string): string | null {
  // Remove extension
  const name = filename.replace(/\.[^.]+$/, "");
  // Remove common prefixes/suffixes
  const cleaned = name
    .replace(/cim|confidential|memorandum|information|executive|summary|offering/gi, "")
    .replace(/[_-]/g, " ")
    .replace(/\d{2,4}/g, "") // Remove date-like numbers
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length >= 2 ? cleaned : null;
}
