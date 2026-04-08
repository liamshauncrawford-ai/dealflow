/**
 * Outreach Draft Generator — AI-powered personalized outreach letters.
 *
 * Generates warm, personal outreach from a fellow Colorado business owner.
 * Supports A/B/C template types: direct_owner, broker_listed, cpa_referral.
 */

import { callClaude, safeJsonParse } from "./claude-client";

// ─────────────────────────────────────────────
// Template System
// ─────────────────────────────────────────────

export type OutreachTemplateType = "direct_owner" | "broker_listed" | "cpa_referral";

export interface OutreachTemplateConfig {
  type: OutreachTemplateType;
  label: string;
  description: string;
  systemPromptAddendum: string;
}

export const TEMPLATE_CONFIGS: Record<OutreachTemplateType, OutreachTemplateConfig> = {
  direct_owner: {
    type: "direct_owner",
    label: "Direct Owner Outreach",
    description: "Warm outreach to unlisted business owner",
    systemPromptAddendum: `
TEMPLATE: Direct Owner (Unlisted Business)
- Subject format: "Confidential Inquiry — [Company Name]"
- Position as fellow Colorado operator building commercial tech platform
- Tone: Warm, peer-to-peer, genuine — NOT corporate or PE
- Emphasize: Growth partnership, legacy continuation, employee retention
- Mention: Acquiring PMS AV division as initial platform, seeking complementary [target type] partner
- CTA: 20-minute confidential call
- Do NOT use words: "portfolio", "roll-up", "platform acquisition", "strategic buyer"
`,
  },
  broker_listed: {
    type: "broker_listed",
    label: "Broker / Listed Response",
    description: "Professional buyer inquiry for listed businesses",
    systemPromptAddendum: `
TEMPLATE: Broker / Listed Business Response
- Subject format: "Buyer Inquiry — [Listing Name or Business Name]"
- Position as qualified, ready buyer: $1–2M capital available, SBA pre-qualified
- Tone: Professional, efficient, buyer-qualification focused
- Emphasize: Aligned timeline, operator background (not absentee), deal readiness
- Include buyer qualifications: EMBA, industry relationships, operational experience
- CTA: Schedule a call to discuss, request CIM/additional financials
- Keep concise — brokers are busy, show you're serious and ready
`,
  },
  cpa_referral: {
    type: "cpa_referral",
    label: "CPA / Attorney Referral",
    description: "Request for introductions from professional advisors",
    systemPromptAddendum: `
TEMPLATE: CPA / Attorney Referral Request
- Subject format: "Introduction to Technology Business Owners — Confidential"
- Position as professional request for introductions to business owners considering exit
- Tone: Respectful, discrete, professional peer-to-peer
- Emphasize: Succession planning conversations, no broker process, confidential
- Value prop: Discrete buyer with aligned interests, no disruption to client relationships
- CTA: Introductions to clients in IT services / commercial tech considering retirement or sale
- Frame as partnership: you help their clients plan succession, they maintain the advisory relationship
`,
  },
};

// ─────────────────────────────────────────────
// Input / Output Types
// ─────────────────────────────────────────────

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

  // Template system fields
  templateType?: OutreachTemplateType;
  targetRankLabel?: string | null;
  brokerName?: string | null;
  brokerCompany?: string | null;
  askingPrice?: string | null;
  listingTitle?: string | null;
  referralContactName?: string | null;
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
  // Resolve template-specific system prompt
  const templateConfig = input.templateType ? TEMPLATE_CONFIGS[input.templateType] : null;
  const fullSystemPrompt = templateConfig
    ? OUTREACH_SYSTEM_PROMPT + "\n\n" + templateConfig.systemPromptAddendum
    : OUTREACH_SYSTEM_PROMPT;

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
    // Template-specific fields
    input.targetRankLabel ? `Target Type: ${input.targetRankLabel}` : null,
    input.brokerName ? `Broker: ${input.brokerName}` : null,
    input.brokerCompany ? `Brokerage: ${input.brokerCompany}` : null,
    input.askingPrice ? `Asking Price: ${input.askingPrice}` : null,
    input.listingTitle ? `Listing: ${input.listingTitle}` : null,
    input.referralContactName ? `Referral Contact: ${input.referralContactName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await callClaude({
    model: "sonnet4",
    system: fullSystemPrompt,
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
