# AI Persistence & Rich Financial Context — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize all AI analysis features with a shared cache/edit/delete lifecycle (keep-latest-only), and enrich the Risk Assessment prompt with live FinancialPeriod data instead of stale Opportunity cache fields.

**Architecture:** A centralized `analysis-manager.ts` utility handles get/generate/edit/delete for `AIAnalysisResult`-based features. Each API route delegates lifecycle to the manager and only provides its own `generateFn` callback. The Risk Assessment prompt builder is expanded to query `FinancialPeriod`, `HistoricPnL`, `ValuationModel`, and prior `FINANCIAL_ANALYSIS` results directly.

**Tech Stack:** Next.js 15 App Router, Prisma 6, TypeScript, Claude Sonnet 4.5 via `@anthropic-ai/sdk`

---

## Task 1: Create the Analysis Manager Utility

**Files:**
- Create: `src/lib/ai/analysis-manager.ts`

**Step 1: Write the analysis manager**

```typescript
/**
 * Centralized lifecycle manager for AI analysis results.
 *
 * Provides cache-aware generation (24h default), keep-latest-only semantics,
 * in-place editing (PATCH), and deletion for all AIAnalysisResult-based features.
 */
import { prisma } from "@/lib/db";
import type { AIAnalysisResult } from "@prisma/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface EntityKey {
  opportunityId?: string;
  listingId?: string;
  documentId?: string;
}

interface GenerateOpts extends EntityKey {
  analysisType: string;
  cacheHours?: number; // default 24
  generateFn: () => Promise<{
    resultData: unknown;
    inputTokens?: number;
    outputTokens?: number;
    modelUsed?: string;
  }>;
}

// ─────────────────────────────────────────────
// Get Latest
// ─────────────────────────────────────────────

export async function getLatestAnalysis(
  opts: EntityKey & { analysisType: string },
): Promise<AIAnalysisResult | null> {
  const where: Record<string, unknown> = { analysisType: opts.analysisType };
  if (opts.opportunityId) where.opportunityId = opts.opportunityId;
  if (opts.listingId) where.listingId = opts.listingId;
  if (opts.documentId) where.documentId = opts.documentId;

  return prisma.aIAnalysisResult.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
}

// ─────────────────────────────────────────────
// Generate (cache-aware, keep-latest-only)
// ─────────────────────────────────────────────

export async function generateAnalysis(
  opts: GenerateOpts,
): Promise<{ result: AIAnalysisResult; cached: boolean }> {
  const cacheMs = (opts.cacheHours ?? 24) * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - cacheMs);

  const where: Record<string, unknown> = { analysisType: opts.analysisType };
  if (opts.opportunityId) where.opportunityId = opts.opportunityId;
  if (opts.listingId) where.listingId = opts.listingId;
  if (opts.documentId) where.documentId = opts.documentId;

  // Check cache
  const cached = await prisma.aIAnalysisResult.findFirst({
    where: { ...where, createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
  });

  if (cached) {
    return { result: cached, cached: true };
  }

  // Generate new result
  const generated = await opts.generateFn();

  // Delete ALL previous results for this entity+type (keep-latest-only)
  await prisma.aIAnalysisResult.deleteMany({ where });

  // Insert new result
  const result = await prisma.aIAnalysisResult.create({
    data: {
      analysisType: opts.analysisType,
      resultData: generated.resultData as object,
      modelUsed: generated.modelUsed ?? "unknown",
      inputTokens: generated.inputTokens ?? 0,
      outputTokens: generated.outputTokens ?? 0,
      ...(opts.opportunityId ? { opportunityId: opts.opportunityId } : {}),
      ...(opts.listingId ? { listingId: opts.listingId } : {}),
      ...(opts.documentId ? { documentId: opts.documentId } : {}),
    },
  });

  return { result, cached: false };
}

// ─────────────────────────────────────────────
// Edit (PATCH resultData)
// ─────────────────────────────────────────────

export async function editAnalysis(
  analysisId: string,
  updates: Record<string, unknown>,
): Promise<AIAnalysisResult> {
  return prisma.aIAnalysisResult.update({
    where: { id: analysisId },
    data: { resultData: updates as object },
  });
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────

export async function deleteAnalysis(analysisId: string): Promise<void> {
  await prisma.aIAnalysisResult.delete({ where: { id: analysisId } });
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/liamcrawford/dealflow && npx tsc --noEmit src/lib/ai/analysis-manager.ts 2>&1 | head -20`

If Prisma types aren't found, just run `npm run build` to check.

**Step 3: Commit**

```bash
git add src/lib/ai/analysis-manager.ts
git commit -m "feat: add centralized analysis-manager utility for AI lifecycle"
```

---

## Task 2: Refactor Weekly Brief to Keep-Latest-Only

**Files:**
- Modify: `src/app/api/cron/weekly-brief/route.ts` (lines 155-169)

**Step 1: Add delete-before-create to the Weekly Brief route**

In `weekly-brief/route.ts`, replace lines 155-169 (`prisma.weeklyBrief.create`) with:

```typescript
    // ── Delete previous briefs (keep-latest-only) ──
    await prisma.weeklyBrief.deleteMany({});

    // ── Store WeeklyBrief ────────────────────────
    await prisma.weeklyBrief.create({
      data: {
        weekStart: sevenDaysAgo,
        weekEnd: now,
        thesisHealth: result.thesisHealth,
        marketMomentum: result.marketMomentum,
        rawBrief: result as object,
        keyDevelopments: result.keyDevelopments,
        recommendedActions: result.recommendedActions,
        pipelineMetrics: result.pipelineMetrics as object,
        marketMetrics: result.marketMetrics as object,
      },
    });
```

**Step 2: Build and verify**

Run: `cd /Users/liamcrawford/dealflow && npm run build 2>&1 | tail -5`
Expected: Clean build

**Step 3: Commit**

```bash
git add src/app/api/cron/weekly-brief/route.ts
git commit -m "fix: weekly brief now replaces previous instead of accumulating"
```

---

## Task 3: Enrich Risk Assessment with Live Financial Data

This is the critical fix for the Precision Media EBITDA bug. Two sub-tasks: expand the Prisma query and rebuild the prompt.

**Files:**
- Modify: `src/lib/ai/risk-assessment.ts` (lines 65-262)

**Step 1: Expand the Prisma query in assessDealRisk**

Replace lines 74-118 (the `prisma.opportunity.findUnique` call) with:

```typescript
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
        orderBy: { periodEnd: "desc" },
      },
      // Valuation scenarios
      valuations: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!opp) throw new Error("Opportunity not found");

  // Also fetch HistoricPnL (separate table, no direct relation)
  const historicPnL = await prisma.historicPnL.findMany({
    where: { opportunityId },
    orderBy: { year: "asc" },
  });
```

Then update the context call to pass the new data:

```typescript
  const context = buildAssessmentContext(opp, historicPnL);
```

**Step 2: Rebuild buildAssessmentContext with live financial data**

Replace the entire `buildAssessmentContext` function (lines 163-262) with an expanded version. The key changes:

1. Add a `## Verified Financial Data` section from `FinancialPeriod` records
2. Add a `## Historic P&L` section from `HistoricPnL` records
3. Add a `## Prior Financial Analysis` section from `FINANCIAL_ANALYSIS` AI result
4. Add a `## Valuation Context` section from `ValuationModel`
5. Add discrepancy detection between Opportunity cache and FinancialPeriod
6. Keep the existing sections (deal overview, listing, contacts, CIM, emails)

```typescript
function buildAssessmentContext(opp: any, historicPnL: any[]): string {
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
        sections.push(`## ⚠ DATA DISCREPANCY — Use FinancialPeriod as authoritative\n${discrepancies.map(d => `- ${d}`).join("\n")}`);
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
  if (historicPnL && historicPnL.length > 0) {
    const hpLines = historicPnL.map((h: any) => {
      const parts = [`FY${h.year}:`];
      if (h.revenue) parts.push(`Revenue $${Number(h.revenue).toLocaleString()}`);
      if (h.grossProfit) parts.push(`GP $${Number(h.grossProfit).toLocaleString()}`);
      if (h.netIncome) parts.push(`Net Income $${Number(h.netIncome).toLocaleString()}`);
      return `- ${parts.join(" | ")}`;
    });
    sections.push(`## Historic P&L (raw spreadsheet import)\n${hpLines.join("\n")}`);
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
  if (opp.valuations && opp.valuations.length > 0) {
    const val = opp.valuations[0];
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

  // Listing data (existing logic, unchanged)
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

  // Risk fields (existing, unchanged)
  const risks: string[] = [];
  if (opp.integrationComplexity) risks.push(`Integration Complexity: ${opp.integrationComplexity}`);
  if (opp.keyPersonRisk) risks.push(`Key Person Risk: ${opp.keyPersonRisk}`);
  if (opp.certificationTransferRisk) risks.push(`Certification Transfer Risk: ${opp.certificationTransferRisk}`);
  if (opp.customerRetentionRisk) risks.push(`Customer Retention Risk: ${opp.customerRetentionRisk}`);
  if (opp.dealStructure) risks.push(`Deal Structure: ${opp.dealStructure}`);
  if (risks.length > 0) {
    sections.push(`## Current Risk Assessment\n${risks.map(r => `- ${r}`).join("\n")}`);
  }

  // Contacts (existing, unchanged)
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

  // CIM extraction data (existing, unchanged)
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

  // Recent email summaries (existing, unchanged)
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

  return sections.join("\n\n");
}
```

**Step 3: Auto-sync fix after discrepancy**

After the risk assessment is generated, if FinancialPeriod data exists, re-sync the Opportunity cache. Add this to `assessDealRisk()` after the Claude call, before the return:

```typescript
  // If FinancialPeriod data exists, ensure Opportunity cache is up-to-date
  if (opp.financialPeriods && opp.financialPeriods.length > 0) {
    try {
      const { syncOpportunitySummary } = await import("@/lib/financial/sync-opportunity");
      await syncOpportunitySummary(opportunityId);
    } catch {
      // Non-fatal: sync failure shouldn't block the assessment
    }
  }
```

**Step 4: Build and verify**

Run: `cd /Users/liamcrawford/dealflow && npm run build 2>&1 | tail -5`
Expected: Clean build

**Step 5: Commit**

```bash
git add src/lib/ai/risk-assessment.ts
git commit -m "feat: enrich risk assessment with live FinancialPeriod, HistoricPnL, and Valuation data"
```

---

## Task 4: Refactor Risk Assessment Route to Use Analysis Manager

**Files:**
- Modify: `src/app/api/pipeline/[id]/risk-assessment/route.ts`

**Step 1: Replace POST handler with analysis manager**

Replace the POST handler (lines 58-133) to use `generateAnalysis`:

```typescript
import { generateAnalysis, editAnalysis, deleteAnalysis, getLatestAnalysis } from "@/lib/ai/analysis-manager";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: "AI features are not configured (missing ANTHROPIC_API_KEY)" },
        { status: 503 },
      );
    }

    const { id: opportunityId } = await params;

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, title: true },
    });
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const { result: analysis, cached } = await generateAnalysis({
      opportunityId,
      analysisType: "RISK_ASSESSMENT",
      cacheHours: 24,
      generateFn: async () => {
        const { result, inputTokens, outputTokens, modelUsed } =
          await assessDealRisk(opportunityId);
        return {
          resultData: result,
          inputTokens,
          outputTokens,
          modelUsed,
        };
      },
    });

    return NextResponse.json({
      analysisId: analysis.id,
      result: analysis.resultData,
      modelUsed: analysis.modelUsed,
      inputTokens: analysis.inputTokens,
      outputTokens: analysis.outputTokens,
      cached,
    });
  } catch (err) {
    console.error("[risk-assessment] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate risk assessment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

Also simplify the GET handler to use `getLatestAnalysis`, and PATCH/DELETE to use `editAnalysis`/`deleteAnalysis`.

**Step 2: Build and verify**

Run: `cd /Users/liamcrawford/dealflow && npm run build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add "src/app/api/pipeline/[id]/risk-assessment/route.ts"
git commit -m "refactor: risk assessment route uses analysis-manager"
```

---

## Task 5: Refactor Deep Dive to Use Analysis Manager

**Files:**
- Modify: `src/app/api/ai/deep-dive/route.ts`

**Step 1: Replace POST handler**

Wrap the existing `runDeepDive` call inside `generateAnalysis()`. Delete the manual `prisma.aIAnalysisResult.create`. Add PATCH and DELETE handlers.

**Step 2: Build and verify**

**Step 3: Commit**

```bash
git add src/app/api/ai/deep-dive/route.ts
git commit -m "refactor: deep dive uses analysis-manager with keep-latest-only"
```

---

## Task 6: Refactor Remaining AIAnalysisResult Features

Apply the same pattern to each:

**6a: Enrichment** — `src/app/api/ai/enrichment/route.ts`
**6b: CIM Analysis** — `src/app/api/pipeline/[id]/analyze-cim/route.ts`
**6c: Financial Extraction** — `src/app/api/pipeline/[id]/financials/extract/route.ts`
**6d: Financial Analysis** — `src/app/api/pipeline/[id]/financials/analyze/route.ts`
**6e: Outreach Draft** — `src/app/api/ai/outreach-draft/route.ts`
**6f: Meeting Notes** — `src/app/api/pipeline/[id]/notes/extract/route.ts`
**6g: Daily Scan** — `src/app/api/cron/daily-scan/route.ts`

For each:
1. Import `generateAnalysis`, `editAnalysis`, `deleteAnalysis` from analysis-manager
2. Wrap the existing AI call in `generateAnalysis()` with appropriate entity key and analysisType
3. Add PATCH and DELETE handlers (where the route file supports it)
4. Build and verify
5. Commit individually

```bash
git commit -m "refactor: [feature] uses analysis-manager with keep-latest-only"
```

---

## Task 7: Persist Valuation Commentary

**Files:**
- Modify: `src/app/api/ai/valuation-commentary/route.ts`

**Step 1: Write commentary to ValuationModel.aiCommentary**

After generating the commentary, write it to the model:

```typescript
// Save to ValuationModel if modelId is provided
if (body.valuationModelId) {
  await prisma.valuationModel.update({
    where: { id: body.valuationModelId },
    data: { aiCommentary: commentary as object },
  });
}
```

**Step 2: Add GET handler to read persisted commentary**

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get("valuationModelId");
  if (!modelId) return NextResponse.json({ error: "valuationModelId required" }, { status: 400 });

  const model = await prisma.valuationModel.findUnique({
    where: { id: modelId },
    select: { aiCommentary: true },
  });

  return NextResponse.json({ commentary: model?.aiCommentary ?? null });
}
```

**Step 3: Build, verify, commit**

```bash
git add src/app/api/ai/valuation-commentary/route.ts
git commit -m "feat: persist valuation commentary to ValuationModel.aiCommentary"
```

---

## Task 8: Browser Test on Production

**Step 1: Push all changes**

```bash
git push origin main
```

**Step 2: Wait for Railway deploy (3-5 min)**

**Step 3: Navigate to Market Overview and test Generate Brief**
- Click "Generate Brief" → verify brief appears and persists
- Navigate away and back → verify brief still shows
- Click "Generate Brief" again → verify it replaces (not duplicates)

**Step 4: Navigate to Precision Media pipeline opportunity**
- Delete the existing stale risk assessment
- Click "Regenerate" → verify the new assessment uses correct financial data from FinancialPeriod
- Verify EBITDA is no longer -$1,288.97

**Step 5: Commit any post-deploy fixes**

---

## Task 9: Final Build Verification & Push

**Step 1: Full build**

```bash
cd /Users/liamcrawford/dealflow && npm run build
```

**Step 2: Git status check**

```bash
git status
git log --oneline -10
```

**Step 3: Push to production**

```bash
git push origin main
```
