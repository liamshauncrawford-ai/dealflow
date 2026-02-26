/**
 * Outreach Draft Generator — AI-powered personalized outreach letters.
 *
 * Generates warm, personal outreach from a fellow Colorado business owner.
 */

import { callClaude, safeJsonParse } from "./claude-client";

export interface OutreachInput {
  ownerName: string | null;
  estimatedAge: string | null;
  companyName: string;
  yearsInBusiness: number | null;
  primaryTrade: string | null;
  city: string | null;
  state: string | null;
  revenue: string | null;
  knownProjects: string | null;
  certifications: string[];
  additionalContext: string | null;
}

export interface OutreachResult {
  subject: string;
  body: string;
  approach_notes: string;
  follow_up_timing: string;
  alternative_channels: string[];
}

const OUTREACH_SYSTEM_PROMPT = `You are drafting a warm, personal outreach letter from a fellow Colorado business owner and EMBA graduate who is looking to acquire and grow a commercial services business.

IMPORTANT RULES:
- Do NOT mention "roll-up", "platform", "portfolio", or "private equity" — these sound too corporate
- Emphasize continuation of the business, its legacy, and its team
- Mention Colorado's booming commercial construction market as a growth opportunity for the company
- Reference specific details about the target company (years in business, projects, location, trade)
- Keep the letter 200-300 words maximum
- Sound like a human wrote it, not AI — be genuine and conversational
- Include a specific call to action (coffee meeting, phone call)
- The buyer's name is Liam Crawford

BUYER BACKGROUND:
- EMBA candidate at a top program, graduating March 2026
- Acquiring PMS commercial division as initial platform
- Building a commercial services company on Colorado's Front Range
- Focused on 11 trade categories: electrical, structured cabling, security/fire alarm, HVAC/mechanical, plumbing, framing/drywall, painting/finishing, concrete/masonry, roofing, site work, and general commercial
- Has industry relationships and operational experience
- Committed to keeping employees and honoring company culture

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "subject": "Email subject line",
  "body": "Full letter text with paragraphs separated by \\n\\n",
  "approach_notes": "Brief notes on why this approach was chosen",
  "follow_up_timing": "Suggested timing for follow-up",
  "alternative_channels": ["Other ways to reach this person"]
}`;

export async function generateOutreachDraft(
  input: OutreachInput
): Promise<{ result: OutreachResult; inputTokens: number; outputTokens: number }> {
  const details = [
    input.ownerName ? `Owner Name: ${input.ownerName}` : null,
    input.estimatedAge ? `Estimated Age: ${input.estimatedAge}` : null,
    `Company: ${input.companyName}`,
    input.yearsInBusiness
      ? `Years in Business: ${input.yearsInBusiness}`
      : null,
    input.primaryTrade ? `Primary Trade: ${input.primaryTrade}` : null,
    input.city || input.state
      ? `Location: ${[input.city, input.state].filter(Boolean).join(", ")}`
      : null,
    input.revenue ? `Revenue: ${input.revenue}` : null,
    input.certifications.length
      ? `Certifications: ${input.certifications.join(", ")}`
      : null,
    input.knownProjects
      ? `Known Projects/Clients: ${input.knownProjects}`
      : null,
    input.additionalContext
      ? `Additional Context: ${input.additionalContext}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await callClaude({
    model: "sonnet4",
    system: OUTREACH_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate a personalized outreach letter for this target:\n\n${details}`,
      },
    ],
    maxTokens: 1500,
    temperature: 0.5,
  });

  const result = safeJsonParse<OutreachResult>(response.text);

  return {
    result,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
