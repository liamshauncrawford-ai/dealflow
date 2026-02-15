import { NextRequest, NextResponse } from "next/server";
import { generateTemplateSchema } from "@/lib/validations/email";
import { callClaude, safeJsonParse } from "@/lib/ai/claude-client";

const CATEGORY_PROMPTS: Record<string, string> = {
  CIM_REQUEST:
    "Compose a professional email requesting the Confidential Information Memorandum (CIM) for a business acquisition. Be concise and professional.",
  NDA_REQUEST:
    "Compose a professional email requesting to sign a Non-Disclosure Agreement (NDA) before receiving confidential business information for a potential acquisition.",
  INTRODUCTION:
    "Compose a warm introduction email to a business broker or owner expressing interest in a potential acquisition opportunity.",
  FOLLOW_UP:
    "Compose a professional follow-up email for a business acquisition conversation. Be polite and show continued interest.",
  LOI:
    "Compose a professional email expressing intent to submit a Letter of Intent (LOI) for a business acquisition. Request next steps and relevant terms.",
  GENERAL:
    "Compose a professional business email related to a potential acquisition opportunity.",
};

/**
 * POST /api/email/templates/generate
 * Generate an email template using AI based on category and context.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = generateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { category, context } = parsed.data;
    const categoryPrompt = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.GENERAL;

    let userPrompt = categoryPrompt;
    if (context) {
      userPrompt += `\n\nAdditional context: ${context}`;
    }

    userPrompt += `\n\nUse template variables where appropriate:
- {{contact_name}} for the recipient's name
- {{deal_title}} for the deal/business name
- {{sender_name}} for the sender's name
- {{company_name}} for the contact's company

Return your response as JSON with exactly these fields:
{
  "subject": "the email subject line",
  "bodyHtml": "the email body as simple HTML (use <p> tags for paragraphs, <br> for line breaks)"
}

Keep the email concise (3-5 paragraphs max). Be professional but not overly formal. Do not include a greeting line with "Dear" — start with "Hi {{contact_name}}," or similar.`;

    const response = await callClaude({
      model: "haiku",
      system:
        "You are an email template generator for a business acquisition CRM. Generate professional, concise email templates. Always respond with valid JSON containing 'subject' and 'bodyHtml' fields.",
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 1000,
      temperature: 0.7,
    });

    const result = safeJsonParse<{ subject: string; bodyHtml: string }>(
      response.text
    );

    if (!result.subject || !result.bodyHtml) {
      throw new Error("AI response missing required fields");
    }

    return NextResponse.json({
      subject: result.subject,
      bodyHtml: result.bodyHtml,
    });
  } catch (error) {
    console.error("Error generating template:", error);
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    );
  }
}
