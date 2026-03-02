# DealFlow V2 — Four Workstreams Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade DealFlow into a pipeline-first acquisition intelligence platform across 4 workstreams: listings cleanup, financial tools migration, notes→AI integration, and AI-powered market intel.

**Architecture:** Next.js 16 App Router + Prisma ORM + PostgreSQL 16. AI via Anthropic Claude SDK. Frontend: React + TanStack Query + Recharts + shadcn/ui. Maps: Leaflet + OpenStreetMap.

**Tech Stack:** TypeScript, Next.js 16, Prisma, PostgreSQL, Anthropic SDK, Leaflet, React Query, Zod

**Implementation Order:** D (Listings Cleanup) → C (Financial Tools) → A (Notes→AI) → B (Market Intel)

---

## Task 1: Auto-hide listings on pipeline promotion (Workstream D)

**Files:**
- Modify: `src/app/api/listings/[id]/pipeline/route.ts`

**Step 1: Add auto-hide after opportunity creation**

In `src/app/api/listings/[id]/pipeline/route.ts`, after the opportunity is created and contacts are saved (line ~70), add a listing hide step:

```typescript
// After contacts creation block (line ~70), before refetch:

// Auto-hide the listing since it's now a pipeline opportunity
await prisma.listing.update({
  where: { id },
  data: { isHidden: true },
});
```

Insert this between the contacts creation loop and the `prisma.opportunity.findUnique` refetch at line 73.

**Step 2: Verify manually**

Run: `cd /Users/liamcrawford/dealflow && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add "src/app/api/listings/[id]/pipeline/route.ts"
git commit -m "fix: auto-hide listing when promoted to pipeline opportunity"
```

---

## Task 2: Backfill — hide existing pipeline duplicates + flag non-CO listings (Workstream D)

**Files:**
- Create: `scripts/cleanup-listings.ts`

**Step 1: Write the cleanup script**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== DealFlow Listing Cleanup ===\n");

  // 1. Hide listings that already have a pipeline opportunity
  const pipelineDuplicates = await prisma.listing.findMany({
    where: {
      opportunity: { isNot: null },
      isHidden: false,
    },
    select: { id: true, title: true, businessName: true },
  });

  console.log(`Found ${pipelineDuplicates.length} listings with pipeline opportunities still visible:`);
  for (const l of pipelineDuplicates) {
    console.log(`  - ${l.businessName || l.title} (${l.id})`);
  }

  if (pipelineDuplicates.length > 0) {
    const result = await prisma.listing.updateMany({
      where: {
        id: { in: pipelineDuplicates.map((l) => l.id) },
      },
      data: { isHidden: true },
    });
    console.log(`  → Hidden ${result.count} pipeline duplicates\n`);
  }

  // 2. Flag non-Colorado listings as out-of-geography
  const nonColorado = await prisma.listing.findMany({
    where: {
      state: { not: "CO" },
      isHidden: false,
      thesisAlignment: { not: "out_of_geography" },
    },
    select: { id: true, title: true, businessName: true, state: true },
  });

  console.log(`Found ${nonColorado.length} non-Colorado listings to flag:`);
  for (const l of nonColorado) {
    console.log(`  - ${l.businessName || l.title} (state: ${l.state})`);
  }

  if (nonColorado.length > 0) {
    const result = await prisma.listing.updateMany({
      where: {
        id: { in: nonColorado.map((l) => l.id) },
      },
      data: {
        thesisAlignment: "out_of_geography",
        tier: "TIER_3_DISQUALIFIED",
      },
    });
    console.log(`  → Flagged ${result.count} non-CO listings as out_of_geography\n`);

    // Ensure the OUT_OF_GEOGRAPHY tag exists
    const tag = await prisma.tag.upsert({
      where: { name: "OUT_OF_GEOGRAPHY" },
      create: { name: "OUT_OF_GEOGRAPHY", color: "#EF4444" },
      update: {},
    });

    // Tag each non-CO listing
    for (const l of nonColorado) {
      await prisma.listingTag.upsert({
        where: { listingId_tagId: { listingId: l.id, tagId: tag.id } },
        create: { listingId: l.id, tagId: tag.id },
        update: {},
      });
    }
    console.log(`  → Tagged ${nonColorado.length} listings with OUT_OF_GEOGRAPHY`);
  }

  // 3. Summary
  const totalHidden = await prisma.listing.count({ where: { isHidden: true } });
  const totalVisible = await prisma.listing.count({ where: { isHidden: false } });
  const totalOutOfGeo = await prisma.listing.count({ where: { thesisAlignment: "out_of_geography" } });

  console.log(`\n=== Summary ===`);
  console.log(`Total hidden: ${totalHidden}`);
  console.log(`Total visible: ${totalVisible}`);
  console.log(`Total out-of-geography: ${totalOutOfGeo}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

**Step 2: Run the script**

Run: `cd /Users/liamcrawford/dealflow && npx tsx scripts/cleanup-listings.ts`
Expected: Output showing counts of hidden duplicates and flagged non-CO listings

**Step 3: Commit**

```bash
git add scripts/cleanup-listings.ts
git commit -m "chore: backfill cleanup — hide pipeline dupes, flag non-CO listings"
```

---

## Task 3: Out-of-geography flagging in post-processor (Workstream D)

**Files:**
- Modify: `src/lib/scrapers/post-processor.ts` (around line 300)

**Step 1: Add auto-flag for non-CO listings in post-processor**

In `src/lib/scrapers/post-processor.ts`, in the "Step 4: Auto-classify thesis fields" section (around line 288), after the `isColorado` check and the trade detection block, add a non-CO handler:

```typescript
// After the trade detection block (around line 336), before the `return`:

// Flag non-Colorado listings as out-of-geography
if (!isColorado && freshListing.state) {
  await prisma.listing.update({
    where: { id: listingId },
    data: {
      thesisAlignment: "out_of_geography",
      tier: "TIER_3_DISQUALIFIED",
    },
  });

  // Auto-tag
  const geoTag = await prisma.tag.upsert({
    where: { name: "OUT_OF_GEOGRAPHY" },
    create: { name: "OUT_OF_GEOGRAPHY", color: "#EF4444" },
    update: {},
  });
  await prisma.listingTag.upsert({
    where: { listingId_tagId: { listingId, tagId: geoTag.id } },
    create: { listingId, tagId: geoTag.id },
    update: {},
  });
}
```

**Step 2: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/scrapers/post-processor.ts
git commit -m "feat: auto-flag non-Colorado listings as out-of-geography"
```

---

## Task 4: Out-of-geography badge in listings UI (Workstream D)

**Files:**
- Modify: `src/app/(dashboard)/listings/page.tsx`

**Step 1: Add out-of-geography badge to listing cards**

Search for where listing cards render the `tier` badge or `thesisAlignment` field. Add conditional badge rendering:

```tsx
{listing.thesisAlignment === "out_of_geography" && (
  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
    Out of Geography
  </span>
)}
```

Add this near the existing tier/score badges on the listing card component.

**Step 2: Verify visually**

Run: `cd /Users/liamcrawford/dealflow && npm run dev`
Navigate to `/listings` and check that any flagged listings show the red badge.

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/listings/page.tsx"
git commit -m "feat: add out-of-geography badge to listing cards"
```

---

## Task 5: Valuation Calculator → Pipeline dropdown (Workstream C)

**Files:**
- Modify: `src/app/(dashboard)/financial/valuation/page.tsx`
- Modify: `src/lib/financial/listing-mapper.ts`

**Step 1: Add `mapOpportunityToValuationInputs` to listing-mapper.ts**

In `src/lib/financial/listing-mapper.ts`, add after the existing `mapOpportunityToRollupCompany` function:

```typescript
import {
  DEFAULT_INPUTS,
  type ValuationInputs,
} from "@/lib/financial/valuation-engine";

export function mapOpportunityToValuationInputs(
  company: PipelineCompany,
): ValuationInputs {
  const ebitda = resolveOpportunityEbitda(company);
  const revenue = resolveOpportunityRevenue(company);
  const price = resolveOpportunityPrice(company);
  const derivedMultiple =
    price > 0 && ebitda > 0 ? Math.round((price / ebitda) * 10) / 10 : null;

  return {
    ...DEFAULT_INPUTS,
    revenue,
    ebitda,
    entryMultiple: derivedMultiple ?? DEFAULT_INPUTS.entryMultiple,
    acquisitionPrice: price || undefined,
  };
}

export function buildComparisonInputsFromOpportunity(
  company: PipelineCompany,
): ValuationInputs {
  return mapOpportunityToValuationInputs(company);
}
```

Note: Check the actual `ValuationInputs` type in `src/lib/financial/valuation-engine.ts` for exact field names and adjust accordingly. The key fields are revenue, ebitda, entry multiple, and acquisition price.

**Step 2: Migrate valuation page to pipeline dropdown**

In `src/app/(dashboard)/financial/valuation/page.tsx`:

1. Replace the import of `useQuery` listings fetch with `usePipelineCompanies`:
```typescript
import { usePipelineCompanies } from "@/hooks/use-pipeline-companies";
import {
  mapOpportunityToValuationInputs,
  formatOpportunityOption,
} from "@/lib/financial/listing-mapper";
```

2. Replace the listings query (lines 74-81):
```typescript
const { data: pipelineCompanies } = usePipelineCompanies();
```

3. Replace the dropdown onChange handler to use `mapOpportunityToValuationInputs` instead of `mapListingToValuationInputs`.

4. Replace the dropdown options to map over `pipelineCompanies` using `formatOpportunityOption`.

**Step 3: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/lib/financial/listing-mapper.ts "src/app/(dashboard)/financial/valuation/page.tsx"
git commit -m "feat: valuation calculator sources companies from pipeline"
```

---

## Task 6: Deal Comparison → Pipeline dropdown (Workstream C)

**Files:**
- Modify: `src/app/(dashboard)/financial/compare/page.tsx`

**Step 1: Migrate comparison page to pipeline dropdown**

Same pattern as Task 5:

1. Replace imports:
```typescript
import { usePipelineCompanies } from "@/hooks/use-pipeline-companies";
import {
  buildComparisonInputsFromOpportunity,
  formatOpportunityOption,
} from "@/lib/financial/listing-mapper";
```

2. Replace the listings query (around line 82) with `usePipelineCompanies()`.

3. Replace dropdown rendering and selection handler to use pipeline companies.

4. Replace `buildComparisonInputs(listing)` calls with `buildComparisonInputsFromOpportunity(company)`.

**Step 2: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/financial/compare/page.tsx"
git commit -m "feat: deal comparison sources companies from pipeline"
```

---

## Task 7: Note model — add noteType + title (Workstream A)

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/validations/pipeline.ts`
- Modify: `src/app/api/pipeline/[id]/notes/route.ts`

**Step 1: Add NoteType enum and fields to schema**

In `prisma/schema.prisma`, add the enum before the Note model:

```prisma
enum NoteType {
  GENERAL
  RESEARCH
  MEETING_NOTES
  AI_ANALYSIS
  DUE_DILIGENCE
}
```

Then add fields to the Note model (after `content`):

```prisma
model Note {
  id              String        @id @default(cuid())

  content         String        @db.Text
  title           String?
  noteType        NoteType      @default(GENERAL)

  // ... rest unchanged
}
```

**Step 2: Push schema change**

Run: `cd /Users/liamcrawford/dealflow && npx prisma db push && npx prisma generate`
Expected: Schema applied successfully

**Step 3: Update createNoteSchema validation**

In `src/lib/validations/pipeline.ts`, update `createNoteSchema`:

```typescript
const noteTypes = [
  "GENERAL", "RESEARCH", "MEETING_NOTES", "AI_ANALYSIS", "DUE_DILIGENCE",
] as const;

export const createNoteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(50000),
  title: z.string().max(200).nullable().optional(),
  noteType: z.enum(noteTypes).optional(),
});
```

Note: Increased max content length from 10000 to 50000 to accommodate research dossiers.

**Step 4: Update notes API to support new fields**

In `src/app/api/pipeline/[id]/notes/route.ts`, update the POST handler:

```typescript
const note = await prisma.note.create({
  data: {
    content: parsed.data.content,
    title: parsed.data.title || null,
    noteType: parsed.data.noteType || "GENERAL",
    opportunityId: id,
  },
});
```

**Step 5: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/validations/pipeline.ts "src/app/api/pipeline/[id]/notes/route.ts"
git commit -m "feat: add noteType and title fields to Note model"
```

---

## Task 8: Feed notes into AI analysis endpoints (Workstream A)

**Files:**
- Modify: `src/app/api/pipeline/[id]/analyze-cim/route.ts`
- Modify: `src/app/api/ai/deep-dive/route.ts`
- Modify: `src/app/api/pipeline/[id]/summarize/route.ts`
- Modify: `src/app/api/pipeline/[id]/risk-assessment/route.ts`

**Step 1: Create a shared helper to format notes for AI context**

Create helper function (can be added to a new file or inline). This formats all opportunity notes into a context string:

```typescript
// src/lib/ai/note-context.ts
import { prisma } from "@/lib/db";

export async function getOpportunityNotesContext(opportunityId: string): Promise<string> {
  const notes = await prisma.note.findMany({
    where: { opportunityId },
    orderBy: { createdAt: "desc" },
    select: { content: true, title: true, noteType: true, createdAt: true },
  });

  if (notes.length === 0) return "";

  const sections = notes.map((n) => {
    const header = [
      n.title || "Note",
      `(${n.noteType})`,
      `— ${n.createdAt.toISOString().slice(0, 10)}`,
    ].join(" ");
    return `### ${header}\n${n.content}`;
  });

  return `\n\n## Research Notes & Due Diligence\nThe following notes have been collected for this opportunity:\n\n${sections.join("\n\n---\n\n")}`;
}
```

**Step 2: Integrate into each AI endpoint**

For each endpoint, import the helper and append the notes context to the data/prompt string that gets sent to Claude:

- `analyze-cim/route.ts`: After building the document text, append `await getOpportunityNotesContext(opportunityId)`
- `deep-dive/route.ts`: Already fetches notes (take: 10) — replace with the helper (fetches all)
- `summarize/route.ts`: Append notes context to the summary prompt
- `risk-assessment/route.ts`: Append notes context (critical — DD findings inform risk)

The exact integration point varies per file. Look for where `dataLines` or `companyData` strings are assembled and append the notes context string.

**Step 3: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/ai/note-context.ts "src/app/api/pipeline/[id]/analyze-cim/route.ts" src/app/api/ai/deep-dive/route.ts "src/app/api/pipeline/[id]/summarize/route.ts" "src/app/api/pipeline/[id]/risk-assessment/route.ts"
git commit -m "feat: feed opportunity notes into all AI analysis endpoints"
```

---

## Task 9: Meeting notes ingestion with AI extraction (Workstream A)

**Files:**
- Create: `src/lib/ai/meeting-notes-extractor.ts`
- Create: `src/app/api/pipeline/[id]/notes/extract/route.ts`

**Step 1: Create the meeting notes extraction prompt**

```typescript
// src/lib/ai/meeting-notes-extractor.ts
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are an M&A analyst extracting structured insights from meeting notes for a commercial services acquisition on Colorado's Front Range.

Given raw meeting notes, extract:
1. KEY FACTS: Important new information learned (financials, operations, personnel, licensing, etc.)
2. ACTION ITEMS: Follow-up tasks with deadlines if mentioned
3. RED FLAGS: Concerns, risks, or negative signals
4. POSITIVE SIGNALS: Encouraging indicators for the deal
5. UPDATED DEAL ASSESSMENT: How do these findings change the overall attractiveness?
6. QUESTIONS TO FOLLOW UP: What wasn't answered or needs deeper investigation?

Format as clean markdown with headers for each section. Be thorough but concise.`;

export interface ExtractionResult {
  extractedContent: string;
  inputTokens: number;
  outputTokens: number;
}

export async function extractMeetingNotes(
  rawNotes: string,
  opportunityTitle: string,
  existingContext?: string,
): Promise<ExtractionResult> {
  const client = new Anthropic();

  const userPrompt = [
    `# Meeting Notes for: ${opportunityTitle}`,
    "",
    rawNotes,
    existingContext ? `\n\n# Existing Research Context\n${existingContext}` : "",
  ].join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const extractedContent =
    response.content[0].type === "text" ? response.content[0].text : "";

  return {
    extractedContent,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
```

**Step 2: Create the extraction API endpoint**

```typescript
// src/app/api/pipeline/[id]/notes/extract/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractMeetingNotes } from "@/lib/ai/meeting-notes-extractor";
import { getOpportunityNotesContext } from "@/lib/ai/note-context";
import { createAuditLog } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, title } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Meeting notes content is required" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 503 }
      );
    }

    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Save raw meeting notes first
    const rawNote = await prisma.note.create({
      data: {
        content,
        title: title || `Meeting Notes — ${new Date().toLocaleDateString()}`,
        noteType: "MEETING_NOTES",
        opportunityId: id,
      },
    });

    // Get existing notes as context for extraction
    const existingContext = await getOpportunityNotesContext(id);

    // Run AI extraction
    const { extractedContent, inputTokens, outputTokens } =
      await extractMeetingNotes(content, opportunity.title, existingContext);

    // Save extracted insights
    const extractedNote = await prisma.note.create({
      data: {
        content: extractedContent,
        title: `AI Analysis — Meeting Notes (${new Date().toLocaleDateString()})`,
        noteType: "AI_ANALYSIS",
        opportunityId: id,
      },
    });

    // Cache the AI analysis
    await prisma.aIAnalysisResult.create({
      data: {
        opportunityId: id,
        analysisType: "MEETING_NOTES_EXTRACTION",
        resultData: { rawNoteId: rawNote.id, extractedNoteId: extractedNote.id },
        modelUsed: "claude-sonnet-4-20250514",
        inputTokens,
        outputTokens,
      },
    });

    await createAuditLog({
      eventType: "CREATED",
      entityType: "NOTE",
      entityId: rawNote.id,
      opportunityId: id,
      summary: "Added meeting notes with AI extraction",
    });

    return NextResponse.json({
      rawNote,
      extractedNote,
      tokens: { input: inputTokens, output: outputTokens },
    });
  } catch (error) {
    console.error("Meeting notes extraction error:", error);
    return NextResponse.json(
      { error: "Failed to process meeting notes" },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/ai/meeting-notes-extractor.ts "src/app/api/pipeline/[id]/notes/extract/route.ts"
git commit -m "feat: meeting notes ingestion with AI extraction"
```

---

## Task 10: Note type UI on opportunity detail page (Workstream A)

**Files:**
- Modify: `src/app/(dashboard)/pipeline/[id]/page.tsx`

**Step 1: Add note type filter and meeting notes button**

In the opportunity detail page, find the notes section. Add:

1. Filter chips above the notes list:
```tsx
const NOTE_TYPE_LABELS: Record<string, string> = {
  ALL: "All",
  GENERAL: "General",
  RESEARCH: "Research",
  MEETING_NOTES: "Meeting Notes",
  AI_ANALYSIS: "AI Analysis",
  DUE_DILIGENCE: "Due Diligence",
};

// State
const [noteTypeFilter, setNoteTypeFilter] = useState("ALL");

// Filtered notes
const filteredNotes = notes?.filter(
  (n: any) => noteTypeFilter === "ALL" || n.noteType === noteTypeFilter
) ?? [];
```

2. "Add Meeting Notes" button that opens a textarea modal
3. Note type badge on each note card (colored by type)
4. When meeting notes are submitted, POST to `/api/pipeline/${id}/notes/extract`

The exact placement depends on the current page layout. Look for the notes section (likely renders `notes` from the opportunity query) and add the filter chips above and the meeting notes button alongside the existing "Add Note" button.

**Step 2: Verify visually**

Run: `cd /Users/liamcrawford/dealflow && npm run dev`
Navigate to a pipeline opportunity and verify note filtering and meeting notes button.

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/pipeline/[id]/page.tsx"
git commit -m "feat: note type filters and meeting notes UI on opportunity page"
```

---

## Task 11: AI Weekly Brief Generator (Workstream B)

**Files:**
- Create: `src/lib/ai/weekly-brief.ts`
- Create: `src/app/api/cron/weekly-brief/route.ts`

**Step 1: Create the weekly brief AI prompt**

```typescript
// src/lib/ai/weekly-brief.ts
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a strategic M&A intelligence analyst producing a weekly market briefing for Crawford Holdings — a PE-backed acquisition platform targeting commercial service contractors across Colorado's Front Range in 11 trade categories.

Generate a comprehensive weekly intelligence brief covering:
1. THESIS HEALTH: Overall assessment (strong/moderate/weak) with reasoning
2. MARKET MOMENTUM: Direction (accelerating/stable/decelerating) based on deal flow
3. KEY DEVELOPMENTS: 3-5 bullets on notable market events, new targets, or pipeline changes
4. RECOMMENDED ACTIONS: 3-5 prioritized action items for the coming week
5. PIPELINE METRICS: Summary of pipeline health, stalled deals, velocity
6. MARKET METRICS: Summary of market conditions, listing volume, score distribution

Return valid JSON with this structure:
{
  "thesisHealth": "strong" | "moderate" | "weak",
  "marketMomentum": "accelerating" | "stable" | "decelerating",
  "keyDevelopments": ["string"],
  "recommendedActions": ["string"],
  "pipelineMetrics": { "summary": "string", "totalValue": number, "activeDeals": number, "stalledDeals": number },
  "marketMetrics": { "summary": "string", "newListings": number, "avgScore": number, "topTrade": "string" }
}`;

export interface WeeklyBriefInput {
  pipelineSummary: string;
  listingActivity: string;
  thesisConfig: string;
  scoreDistribution: string;
}

export interface WeeklyBriefResult {
  thesisHealth: string;
  marketMomentum: string;
  keyDevelopments: string[];
  recommendedActions: string[];
  pipelineMetrics: Record<string, unknown>;
  marketMetrics: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
}

export async function generateWeeklyBrief(
  input: WeeklyBriefInput
): Promise<WeeklyBriefResult> {
  const client = new Anthropic();

  const userPrompt = [
    "# Current Pipeline State",
    input.pipelineSummary,
    "",
    "# Recent Listing Activity (Last 7 Days)",
    input.listingActivity,
    "",
    "# Thesis Configuration",
    input.thesisConfig,
    "",
    "# Score Distribution",
    input.scoreDistribution,
  ].join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const parsed = JSON.parse(text);

  return {
    ...parsed,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
```

**Step 2: Create the cron endpoint**

The endpoint should:
1. Query pipeline opportunities (count by stage, total value, stalled = no update in 14 days)
2. Query recent listings (created in last 7 days, scored listings, score distribution)
3. Load thesis config
4. Call `generateWeeklyBrief()` with assembled context
5. Store result in `WeeklyBrief` table
6. Also record a `MarketMetric` entry

Follow the pattern from `src/app/api/cron/daily-scan/route.ts` for auth and error handling.

**Step 3: Add "Generate Brief" button on Market Overview**

In `src/app/(dashboard)/market-intel/overview/page.tsx`, add a button that POSTs to `/api/cron/weekly-brief` to trigger manual generation.

**Step 4: Verify build**

Run: `cd /Users/liamcrawford/dealflow && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/ai/weekly-brief.ts src/app/api/cron/weekly-brief/route.ts "src/app/(dashboard)/market-intel/overview/page.tsx"
git commit -m "feat: AI weekly market intelligence brief generator"
```

---

## Task 12: Thesis Coverage Component (Workstream B)

**Files:**
- Create: `src/components/market-intel/thesis-coverage.tsx`
- Modify: `src/app/api/market-intel/overview/route.ts`
- Modify: `src/app/(dashboard)/market-intel/overview/page.tsx`

**Step 1: Add thesis coverage data to overview API**

In `src/app/api/market-intel/overview/route.ts`, add a new parallel query for trade coverage:

```typescript
// Add to the Promise.all array:
// Pipeline coverage by trade
prisma.opportunity.findMany({
  where: { stage: { notIn: ["CLOSED_LOST", "CLOSED_WON"] } },
  include: { listing: { select: { primaryTrade: true } } },
}),
```

Then compute coverage per trade from the 11 target trades in `PRIMARY_TRADES` constant.

**Step 2: Create the ThesisCoverage component**

A horizontal bar chart showing each of the 11 target trades with:
- Count of pipeline opportunities
- Count of active targets
- Color: green (good coverage), yellow (light coverage), red (no coverage)

Use Recharts `BarChart` with horizontal layout.

**Step 3: Wire into overview page**

Add the `ThesisCoverage` component to the Market Overview page, below the weekly brief section.

**Step 4: Commit**

```bash
git add src/components/market-intel/thesis-coverage.tsx src/app/api/market-intel/overview/route.ts "src/app/(dashboard)/market-intel/overview/page.tsx"
git commit -m "feat: thesis trade coverage component on market overview"
```

---

## Task 13: Interactive Leaflet Map (Workstream B)

**Files:**
- Create: `src/components/market-intel/deal-map.tsx`
- Modify: `src/app/(dashboard)/market-intel/map/page.tsx`

**Step 1: Install Leaflet dependencies**

Run: `cd /Users/liamcrawford/dealflow && npm install leaflet react-leaflet && npm install -D @types/leaflet`

**Step 2: Create the DealMap component**

```tsx
// src/components/market-intel/deal-map.tsx
"use client";

import dynamic from "next/dynamic";
// Leaflet must be imported dynamically (no SSR) in Next.js
// This file will use react-leaflet's MapContainer, TileLayer, Marker, Popup

// Dynamic import to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
// ... similar for TileLayer, Marker, Popup, CircleMarker
```

The map should:
- Center on Colorado (lat: 39.55, lng: -105.78, zoom: 7)
- Load pipeline opportunities and active listings from `/api/market-intel/map`
- Render pipeline deals as larger colored pins (by stage)
- Render targets as smaller circle markers (by trade)
- Tooltip with company name, trade, score/stage, revenue
- Click navigates to detail page
- Include Leaflet CSS import

**Step 3: Replace map page placeholder**

Replace the "Coming Soon" card in `src/app/(dashboard)/market-intel/map/page.tsx` with the DealMap component.

**Step 4: Verify visually**

Run: `cd /Users/liamcrawford/dealflow && npm run dev`
Navigate to `/market-intel/map` and verify the map renders with pins.

**Step 5: Commit**

```bash
git add src/components/market-intel/deal-map.tsx "src/app/(dashboard)/market-intel/map/page.tsx" package.json package-lock.json
git commit -m "feat: interactive Leaflet market map with pipeline pins"
```

---

## Task 14: Market metrics auto-computation (Workstream B)

**Files:**
- Modify: `src/lib/scrapers/post-processor.ts` or create `src/lib/market-metrics.ts`

**Step 1: Create metrics computation function**

```typescript
// src/lib/market-metrics.ts
import { prisma } from "@/lib/db";

export async function recordMarketMetrics(): Promise<void> {
  const [targetsTracked, actionable, newListings, pipelineValue] = await Promise.all([
    prisma.listing.count({ where: { isHidden: false } }),
    prisma.listing.count({ where: { isHidden: false, compositeScore: { gte: 60 } } }),
    prisma.listing.count({
      where: {
        isHidden: false,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.opportunity.aggregate({
      where: { stage: { notIn: ["CLOSED_LOST", "CLOSED_WON"] } },
      _sum: { offerPrice: true },
    }),
  ]);

  await prisma.marketMetric.create({
    data: {
      targetsTracked,
      actionableTargets: actionable,
      newListingsThisPeriod: newListings,
      weightedPipelineValue: pipelineValue._sum.offerPrice || 0,
    },
  });
}
```

**Step 2: Call after scrape runs complete**

Add `recordMarketMetrics()` call at the end of the `scrape_all` action in `src/app/api/scraping/trigger/route.ts` and also at the end of the daily-scan cron.

**Step 3: Commit**

```bash
git add src/lib/market-metrics.ts src/app/api/scraping/trigger/route.ts src/app/api/cron/daily-scan/route.ts
git commit -m "feat: auto-compute market metrics after scrape runs"
```

---

## Task 15: Final verification and push

**Step 1: Full build check**

Run: `cd /Users/liamcrawford/dealflow && npx tsc --noEmit && npm run build`
Expected: Clean build with no errors

**Step 2: Restart dev server and verify**

Run: `cd /Users/liamcrawford/dealflow && npm run dev`

Manual checks:
- [ ] Pipeline opportunity page shows note type filters
- [ ] Meeting notes button works and AI extracts insights
- [ ] Valuation Calculator dropdown shows pipeline opportunities
- [ ] Deal Comparison dropdown shows pipeline opportunities
- [ ] Listings page shows out-of-geography badges
- [ ] Promoting a listing to pipeline hides it from listings
- [ ] Market Overview shows "Generate Brief" button
- [ ] Market Map shows Leaflet map (may need listings with lat/long)

**Step 3: Push all commits**

```bash
cd /Users/liamcrawford/dealflow && git push
```
