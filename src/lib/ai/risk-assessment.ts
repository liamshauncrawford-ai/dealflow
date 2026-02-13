/**
 * AI-powered deal risk assessment.
 *
 * Gathers all available data for an opportunity (financials, contacts,
 * documents, emails, listing data) and generates a comprehensive risk
 * assessment using Claude Sonnet 4.5.
 *
 * Cost: ~$0.04 per assessment
 */

import { callClaude, safeJsonParse } from "./claude-client";
import { prisma } from "@/lib/db";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RiskFlag {
  severity: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  description: string;
}

export interface DealRiskAssessment {
  overallRisk: "HIGH" | "MEDIUM" | "LOW";
  thesisFitScore: number; // 1-10
  riskFlags: RiskFlag[];
  strengths: string[];
  concerns: string[];
  recommendation: string;
  keyQuestions: string[]; // Questions to answer during diligence
}

// ─────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior M&A risk analyst supporting a buy-side search for a Colorado-based data center trades roll-up. The thesis targets IT infrastructure and trades companies: structured cabling, electrical, mechanical, security/surveillance, and fire protection.

Given the data below, produce a comprehensive risk assessment. Be specific and actionable — reference actual numbers and facts from the data.

Risk flag categories:
- FINANCIAL: Revenue trends, margin pressure, customer concentration, working capital
- OPERATIONAL: Key person dependency, certification requirements, workforce issues
- MARKET: Competition, technology disruption, regulatory changes
- INTEGRATION: Systems, culture, geographic, process alignment
- THESIS_FIT: Alignment with roll-up strategy, synergy potential, scalability

Respond with a JSON object:
{
  "overallRisk": "HIGH" | "MEDIUM" | "LOW",
  "thesisFitScore": number (1-10, where 10 = perfect fit),
  "riskFlags": [{ "severity": "HIGH"|"MEDIUM"|"LOW", "category": string, "description": string }],
  "strengths": [string],
  "concerns": [string],
  "recommendation": string (2-3 sentences),
  "keyQuestions": [string] (questions to answer in diligence)
}`;

// ─────────────────────────────────────────────
// Assessment Generator
// ─────────────────────────────────────────────

export async function assessDealRisk(
  opportunityId: string,
): Promise<{
  result: DealRiskAssessment;
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
}> {
  // Gather all available data for this opportunity
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      listing: {
        include: {
          sources: true,
          tags: { include: { tag: true } },
        },
      },
      contacts: true,
      emails: {
        include: {
          email: {
            select: {
              subject: true,
              fromAddress: true,
              bodyPreview: true,
              aiSummary: true,
              emailCategory: true,
            },
          },
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      },
      documents: {
        select: {
          fileName: true,
          category: true,
          description: true,
        },
      },
      notes: {
        select: { content: true, createdAt: true },
        take: 10,
        orderBy: { createdAt: "desc" },
      },
      aiAnalyses: {
        where: { analysisType: "CIM_EXTRACTION" },
        select: { resultData: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!opp) throw new Error("Opportunity not found");

  // Build context for Claude
  const context = buildAssessmentContext(opp);

  const modelUsed = "claude-sonnet-4-5";

  const response = await callClaude({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Assess the risk of this deal:\n\n${context}`,
      },
    ],
    maxTokens: 3000,
    temperature: 0,
  });

  const result = safeJsonParse<DealRiskAssessment>(response.text);

  // Validate/normalize
  result.riskFlags = result.riskFlags || [];
  result.strengths = result.strengths || [];
  result.concerns = result.concerns || [];
  result.keyQuestions = result.keyQuestions || [];

  return {
    result,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    modelUsed,
  };
}

// ─────────────────────────────────────────────
// Context Builder
// ─────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildAssessmentContext(opp: any): string {
  const sections: string[] = [];

  // Deal overview
  sections.push(`## Deal Overview
- Title: ${opp.title}
- Stage: ${opp.stage}
- Priority: ${opp.priority}
- Description: ${opp.description || "N/A"}`);

  // Financials
  const financials: string[] = [];
  if (opp.offerPrice) financials.push(`Offer Price: $${Number(opp.offerPrice).toLocaleString()}`);
  if (opp.actualRevenue) financials.push(`Revenue: $${Number(opp.actualRevenue).toLocaleString()}`);
  if (opp.actualEbitda) financials.push(`EBITDA: $${Number(opp.actualEbitda).toLocaleString()}`);
  if (opp.actualEbitdaMargin) financials.push(`EBITDA Margin: ${(Number(opp.actualEbitdaMargin) * 100).toFixed(1)}%`);
  if (opp.revenueTrend) financials.push(`Revenue Trend: ${opp.revenueTrend}`);
  if (opp.recurringRevenuePct) financials.push(`Recurring Revenue: ${(Number(opp.recurringRevenuePct) * 100).toFixed(0)}%`);
  if (opp.customerConcentration) financials.push(`Customer Concentration (top client): ${(Number(opp.customerConcentration) * 100).toFixed(0)}%`);
  if (opp.dealValue) financials.push(`Deal Value: $${Number(opp.dealValue).toLocaleString()}`);
  if (opp.backlog) financials.push(`Backlog: $${Number(opp.backlog).toLocaleString()}`);

  if (financials.length > 0) {
    sections.push(`## Financials\n${financials.map((f) => `- ${f}`).join("\n")}`);
  }

  // Listing data
  if (opp.listing) {
    const l = opp.listing;
    const listingInfo: string[] = [];
    if (l.askingPrice) listingInfo.push(`Asking Price: $${Number(l.askingPrice).toLocaleString()}`);
    if (l.revenue) listingInfo.push(`Listed Revenue: $${Number(l.revenue).toLocaleString()}`);
    if (l.ebitda) listingInfo.push(`Listed EBITDA: $${Number(l.ebitda).toLocaleString()}`);
    if (l.employees) listingInfo.push(`Employees: ${l.employees}`);
    if (l.city || l.state) listingInfo.push(`Location: ${[l.city, l.state].filter(Boolean).join(", ")}`);
    if (l.description) listingInfo.push(`Description: ${l.description.slice(0, 500)}`);

    if (listingInfo.length > 0) {
      sections.push(`## Listing Information\n${listingInfo.map((f) => `- ${f}`).join("\n")}`);
    }
  }

  // Risk fields
  const risks: string[] = [];
  if (opp.integrationComplexity) risks.push(`Integration Complexity: ${opp.integrationComplexity}`);
  if (opp.keyPersonRisk) risks.push(`Key Person Risk: ${opp.keyPersonRisk}`);
  if (opp.certificationTransferRisk) risks.push(`Certification Transfer Risk: ${opp.certificationTransferRisk}`);
  if (opp.customerRetentionRisk) risks.push(`Customer Retention Risk: ${opp.customerRetentionRisk}`);
  if (opp.dealStructure) risks.push(`Deal Structure: ${opp.dealStructure}`);

  if (risks.length > 0) {
    sections.push(`## Current Risk Assessment\n${risks.map((r) => `- ${r}`).join("\n")}`);
  }

  // Contacts
  if (opp.contacts && opp.contacts.length > 0) {
    const contactInfo = opp.contacts.map((c: any) => {
      const parts = [c.name];
      if (c.role) parts.push(`(${c.role})`);
      if (c.sentiment) parts.push(`- Sentiment: ${c.sentiment}`);
      if (c.interestLevel && c.interestLevel !== "UNKNOWN") parts.push(`- Interest: ${c.interestLevel}`);
      return parts.join(" ");
    });
    sections.push(`## Contacts\n${contactInfo.map((c: string) => `- ${c}`).join("\n")}`);
  }

  // CIM extraction data (if available)
  if (opp.aiAnalyses && opp.aiAnalyses.length > 0) {
    const cimData = opp.aiAnalyses[0].resultData as any;
    if (cimData) {
      const cimInfo: string[] = [];
      if (cimData.serviceLines?.length) cimInfo.push(`Service Lines: ${cimData.serviceLines.join(", ")}`);
      if (cimData.keyClients?.length) cimInfo.push(`Key Clients: ${cimData.keyClients.join(", ")}`);
      if (cimData.certifications?.length) cimInfo.push(`Certifications: ${cimData.certifications.join(", ")}`);
      if (cimData.reasonForSale) cimInfo.push(`Reason for Sale: ${cimData.reasonForSale}`);
      if (cimData.riskFlags?.length) cimInfo.push(`CIM Risk Flags: ${cimData.riskFlags.join("; ")}`);
      if (cimData.thesisFitAssessment) cimInfo.push(`Prior Thesis Fit Assessment: ${cimData.thesisFitAssessment}`);

      if (cimInfo.length > 0) {
        sections.push(`## CIM Analysis Data\n${cimInfo.map((c) => `- ${c}`).join("\n")}`);
      }
    }
  }

  // Recent email summaries
  if (opp.emails && opp.emails.length > 0) {
    const emailSummaries = opp.emails
      .map((el: any) => {
        const e = el.email;
        const summary = e.aiSummary || e.subject || "(no subject)";
        return `- ${e.fromAddress}: ${summary}`;
      })
      .slice(0, 10);
    sections.push(`## Recent Email Activity\n${emailSummaries.join("\n")}`);
  }

  // Notes
  if (opp.notes && opp.notes.length > 0) {
    const noteContent = opp.notes
      .map((n: any) => `- ${n.content.slice(0, 200)}`)
      .slice(0, 5);
    sections.push(`## Notes\n${noteContent.join("\n")}`);
  }

  return sections.join("\n\n");
}
