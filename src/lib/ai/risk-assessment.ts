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
import { getOpportunityNotesContext } from "./note-context";

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

const SYSTEM_PROMPT = `You are a senior M&A risk analyst supporting a buy-side search for the Crawford Holdings commercial services acquisition platform. The thesis targets commercial service contractors across Colorado's Front Range in 11 trade categories: electrical, structured cabling, security/fire alarm, HVAC/mechanical, plumbing, framing/drywall, painting/finishing, concrete/masonry, roofing, site work, and general commercial.

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
        where: { analysisType: { in: ["CIM_EXTRACTION", "FINANCIAL_ANALYSIS"] } },
        select: { analysisType: true, resultData: true, createdAt: true },
        take: 2,
        orderBy: { createdAt: "desc" },
      },
      // Live financial data (source of truth)
      financialPeriods: {
        include: { lineItems: true, addBacks: true },
        orderBy: { year: "desc" },
      },
      // Historic P&L spreadsheet data
      historicPnLs: {
        include: { rows: true },
        orderBy: { createdAt: "desc" },
      },
      // Valuation scenarios
      valuationModels: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!opp) throw new Error("Opportunity not found");

  // Build context for Claude
  const context = buildAssessmentContext(opp, opp.historicPnLs);
  const notesContext = await getOpportunityNotesContext(opportunityId);
  const fullContext = context + notesContext;

  const modelUsed = "claude-sonnet-4-5";

  const response = await callClaude({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Assess the risk of this deal:\n\n${fullContext}`,
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

  // If FinancialPeriod data exists, ensure Opportunity cache is up-to-date
  if (opp.financialPeriods && opp.financialPeriods.length > 0) {
    try {
      const { syncOpportunitySummary } = await import("@/lib/financial/sync-opportunity");
      await syncOpportunitySummary(opportunityId);
    } catch {
      // Non-fatal: sync failure shouldn't block the assessment
    }
  }

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
function buildAssessmentContext(opp: any, historicPnLs: any[]): string {
  const sections: string[] = [];

  // Deal overview
  sections.push(`## Deal Overview
- Title: ${opp.title}
- Stage: ${opp.stage}
- Priority: ${opp.priority}
- Description: ${opp.description || "N/A"}`);

  // ─── Verified Financial Data (FinancialPeriod — source of truth) ───
  if (opp.financialPeriods && opp.financialPeriods.length > 0) {
    const fpLines: string[] = ["## Verified Financial Data (FinancialPeriod records — source of truth)"];

    // Sort by year descending for display
    const periods = [...opp.financialPeriods]
      .filter((p: any) => p.periodType === "ANNUAL")
      .sort((a: any, b: any) => (b.year ?? 0) - (a.year ?? 0));

    for (const p of periods) {
      const year = p.year ?? "Unknown";
      const rev = p.totalRevenue ? `$${Number(p.totalRevenue).toLocaleString()}` : "N/A";
      const cogs = p.totalCogs ? `$${Number(p.totalCogs).toLocaleString()}` : "N/A";
      const gp = p.grossProfit ? `$${Number(p.grossProfit).toLocaleString()}` : "N/A";
      const gpMargin = p.grossProfit && p.totalRevenue
        ? `${((Number(p.grossProfit) / Number(p.totalRevenue)) * 100).toFixed(1)}%`
        : "";
      const opex = p.totalOpex ? `$${Number(p.totalOpex).toLocaleString()}` : "N/A";
      const ebitda = p.ebitda ? `$${Number(p.ebitda).toLocaleString()}` : "N/A";
      const adjEbitda = p.adjustedEbitda ? `$${Number(p.adjustedEbitda).toLocaleString()}` : "N/A";
      const adjMargin = p.adjustedEbitdaMargin
        ? `${(Number(p.adjustedEbitdaMargin) * 100).toFixed(1)}%`
        : "";
      const sde = p.sde ? `$${Number(p.sde).toLocaleString()}` : null;

      fpLines.push(`### FY${year}`);
      fpLines.push(`- Revenue: ${rev} | COGS: ${cogs} | Gross Profit: ${gp} ${gpMargin ? `(${gpMargin})` : ""}`);
      fpLines.push(`- Operating Expenses: ${opex}`);
      fpLines.push(`- EBITDA: ${ebitda} | Adj. EBITDA: ${adjEbitda} ${adjMargin ? `(${adjMargin} margin)` : ""}`);
      if (sde) fpLines.push(`- SDE: ${sde}`);

      // Add-back detail
      if (p.addBacks && p.addBacks.length > 0) {
        const addBackItems = p.addBacks
          .map((ab: any) => `${ab.category}: $${Number(ab.amount).toLocaleString()}${ab.description ? ` (${ab.description})` : ""}`)
          .join(", ");
        fpLines.push(`- Add-backs: ${addBackItems}`);
      }
    }

    // YoY growth if 2+ periods
    if (periods.length >= 2) {
      const recent = periods[0];
      const prior = periods[1];
      if (recent.totalRevenue && prior.totalRevenue) {
        const revGrowth = ((Number(recent.totalRevenue) - Number(prior.totalRevenue)) / Number(prior.totalRevenue) * 100).toFixed(1);
        fpLines.push(`\nYoY Revenue Growth: ${revGrowth}%`);
      }
      if (recent.adjustedEbitda && prior.adjustedEbitda) {
        const ebitdaGrowth = ((Number(recent.adjustedEbitda) - Number(prior.adjustedEbitda)) / Number(prior.adjustedEbitda) * 100).toFixed(1);
        fpLines.push(`YoY Adj. EBITDA Growth: ${ebitdaGrowth}%`);
      }
    }

    sections.push(fpLines.join("\n"));

    // Discrepancy detection
    const latestPeriod = periods[0];
    if (latestPeriod) {
      const discrepancies: string[] = [];
      const fpEbitda = Number(latestPeriod.adjustedEbitda ?? latestPeriod.ebitda ?? 0);
      const oppEbitda = Number(opp.actualEbitda ?? 0);
      if (oppEbitda !== 0 && fpEbitda !== 0 && Math.abs(fpEbitda - oppEbitda) / Math.abs(fpEbitda) > 0.1) {
        discrepancies.push(`Opportunity.actualEbitda = $${oppEbitda.toLocaleString()} but FinancialPeriod shows $${fpEbitda.toLocaleString()}`);
      }
      const fpRevenue = Number(latestPeriod.totalRevenue ?? 0);
      const oppRevenue = Number(opp.actualRevenue ?? 0);
      if (oppRevenue !== 0 && fpRevenue !== 0 && Math.abs(fpRevenue - oppRevenue) / Math.abs(fpRevenue) > 0.1) {
        discrepancies.push(`Opportunity.actualRevenue = $${oppRevenue.toLocaleString()} but FinancialPeriod shows $${fpRevenue.toLocaleString()}`);
      }
      if (discrepancies.length > 0) {
        sections.push(`## DATA DISCREPANCY — Use FinancialPeriod as authoritative\n${discrepancies.map(d => `- ${d}`).join("\n")}`);
      }
    }
  } else {
    // Fallback to Opportunity flat fields if no FinancialPeriod data
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
      sections.push(`## Financials (from Opportunity cache — no detailed periods available)\n${financials.map(f => `- ${f}`).join("\n")}`);
    }
  }

  // ─── Historic P&L (raw spreadsheet data) ───
  if (historicPnLs && historicPnLs.length > 0) {
    const hpLines: string[] = [];
    for (const sheet of historicPnLs) {
      const title = sheet.title || sheet.companyName || "Untitled P&L";
      const columns = (sheet.columns as any[]) || [];
      const colHeaders = columns.map((c: any) => c.header || "?").join(" | ");
      hpLines.push(`### ${title}`);
      if (colHeaders) hpLines.push(`Periods: ${colHeaders}`);

      // Include summary rows (Gross Profit, Net Income, etc.)
      const summaryRows = (sheet.rows || []).filter((r: any) => r.isSummary || r.isTotal);
      for (const row of summaryRows.slice(0, 10)) {
        const vals = (row.values as number[]) || [];
        const formatted = vals.map((v: number | null) => v != null ? `$${Number(v).toLocaleString()}` : "N/A").join(" | ");
        hpLines.push(`- ${row.label}: ${formatted}`);
      }
    }
    if (hpLines.length > 0) {
      sections.push(`## Historic P&L (raw spreadsheet import)\n${hpLines.join("\n")}`);
    }
  }

  // ─── Prior Financial Analysis (if available) ───
  const financialAnalysis = opp.aiAnalyses?.find((a: any) => a.analysisType === "FINANCIAL_ANALYSIS");
  if (financialAnalysis?.resultData) {
    const fa = financialAnalysis.resultData as any;
    const faLines: string[] = [];
    if (fa.overallScore) faLines.push(`Quality Score: ${fa.overallScore}/10`);
    if (fa.summary) faLines.push(`Summary: ${fa.summary}`);
    if (fa.redFlags?.length) faLines.push(`Red Flags: ${fa.redFlags.join("; ")}`);
    if (fa.concerns?.length) faLines.push(`Concerns: ${fa.concerns.join("; ")}`);
    if (faLines.length > 0) {
      sections.push(`## Prior AI Financial Analysis\n${faLines.map(l => `- ${l}`).join("\n")}`);
    }
  }

  // ─── Valuation Context (if available) ───
  if (opp.valuationModels && opp.valuationModels.length > 0) {
    const val = opp.valuationModels[0];
    const inputs = val.inputs as any;
    const outputs = val.outputs as any;
    const valLines: string[] = [];
    if (inputs?.entry_multiple) valLines.push(`Entry Multiple: ${inputs.entry_multiple}x`);
    if (inputs?.target_ebitda) valLines.push(`Target EBITDA: $${Number(inputs.target_ebitda).toLocaleString()}`);
    if (outputs?.enterprise_value) valLines.push(`Implied EV: $${Number(outputs.enterprise_value).toLocaleString()}`);
    if (outputs?.dscr) valLines.push(`DSCR: ${outputs.dscr}x`);
    if (outputs?.irr) valLines.push(`IRR: ${(outputs.irr * 100).toFixed(1)}%`);
    if (outputs?.moic) valLines.push(`MOIC: ${outputs.moic}x`);
    if (val.aiCommentary) valLines.push(`AI Commentary: ${JSON.stringify(val.aiCommentary).slice(0, 300)}`);
    if (valLines.length > 0) {
      sections.push(`## Valuation Context\n${valLines.map(l => `- ${l}`).join("\n")}`);
    }
  }

  // ─── Offer Price (always include if set) ───
  if (opp.offerPrice) {
    sections.push(`## Offer\n- Offer Price: $${Number(opp.offerPrice).toLocaleString()}`);
  }

  // Listing data (broker snapshot)
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
      sections.push(`## Listing Information (broker snapshot)\n${listingInfo.map(f => `- ${f}`).join("\n")}`);
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
    sections.push(`## Current Risk Assessment\n${risks.map(r => `- ${r}`).join("\n")}`);
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
  const cimAnalysis = opp.aiAnalyses?.find((a: any) => a.analysisType === "CIM_EXTRACTION");
  if (cimAnalysis?.resultData) {
    const cimData = cimAnalysis.resultData as any;
    const cimInfo: string[] = [];
    if (cimData.serviceLines?.length) cimInfo.push(`Service Lines: ${cimData.serviceLines.join(", ")}`);
    if (cimData.keyClients?.length) cimInfo.push(`Key Clients: ${cimData.keyClients.join(", ")}`);
    if (cimData.certifications?.length) cimInfo.push(`Certifications: ${cimData.certifications.join(", ")}`);
    if (cimData.reasonForSale) cimInfo.push(`Reason for Sale: ${cimData.reasonForSale}`);
    if (cimData.riskFlags?.length) cimInfo.push(`CIM Risk Flags: ${cimData.riskFlags.join("; ")}`);
    if (cimData.thesisFitAssessment) cimInfo.push(`Prior Thesis Fit Assessment: ${cimData.thesisFitAssessment}`);
    if (cimInfo.length > 0) {
      sections.push(`## CIM Analysis Data\n${cimInfo.map(c => `- ${c}`).join("\n")}`);
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

  // Notes are now handled by getOpportunityNotesContext() and appended separately

  return sections.join("\n\n");
}
