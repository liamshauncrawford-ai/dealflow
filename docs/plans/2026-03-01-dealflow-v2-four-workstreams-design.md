# DealFlow V2 — Four Workstreams Design
**Date:** 2026-03-01
**Status:** Approved

---

## Overview

Four parallel workstreams to upgrade DealFlow from a lead-tracking tool into a pipeline-first acquisition intelligence platform.

| Workstream | Summary | Priority |
|---|---|---|
| A | Notes → AI Analysis Integration | High |
| B | Market Intel — AI-Powered | Medium |
| C | Financial Tools → Pipeline-First | High |
| D | Listings Cleanup + State Filtering | High |

---

## Workstream A: Notes → AI Analysis Integration

### Problem
Notes are plain text attached to opportunities. AI analysis endpoints (`analyze-cim`, `deep-dive`, `summarize`, `risk-assessment`) don't include notes as context — so research dossiers, employee rosters, and due diligence findings uploaded to an opportunity are invisible to AI analysis.

### Design

**Schema change:**
```prisma
enum NoteType {
  GENERAL
  RESEARCH
  MEETING_NOTES
  AI_ANALYSIS
  DUE_DILIGENCE
}

model Note {
  // existing fields...
  noteType  NoteType @default(GENERAL)
  title     String?  // optional heading for display
}
```

**AI Context Integration:**
- Modify all AI endpoints that operate on an opportunity to fetch and include notes:
  - `POST /api/pipeline/[id]/analyze-cim` — include notes in CIM analysis prompt
  - `POST /api/ai/deep-dive` — already fetches notes (take: 10), increase to all
  - `POST /api/pipeline/[id]/summarize` — include notes
  - `POST /api/pipeline/[id]/risk-assessment` — include notes (critical for DD findings)

**Meeting Notes Ingestion:**
- New UI component: "Add Meeting Notes" button on opportunity detail page
- Opens modal with large text area for pasting raw meeting notes
- On save: stores raw notes as `noteType: MEETING_NOTES`
- Then triggers Claude to extract structured insights:
  - Key facts learned
  - Action items / follow-ups
  - Red flags or concerns
  - Updated deal assessment
- Saves the AI extraction as a second note with `noteType: AI_ANALYSIS`

**UI Changes:**
- Note list on opportunity detail page gets:
  - Type filter chips (All, Research, Meeting Notes, AI Analysis, DD)
  - Optional title display
  - Type badge on each note card

---

## Workstream B: Market Intel — AI-Powered Intelligence

### Problem
Market Overview page has UI shell but empty data. Market Map is a "Coming Soon" placeholder. No active process generates WeeklyBrief or MarketMetric records.

### Design

**B1: AI Weekly Brief Generator**

New endpoint: `POST /api/cron/weekly-brief`
- Gathers context:
  - Pipeline summary (count by stage, total value, stalled deals)
  - Recent listing activity (new/scored in last 7 days)
  - Thesis configuration (target trades, geography, multiples)
  - Score distribution and thesis alignment trends
- Sends to Claude (Sonnet) with market intelligence system prompt
- Claude generates:
  - `thesisHealth`: "strong" | "moderate" | "weak" with reasoning
  - `marketMomentum`: "accelerating" | "stable" | "decelerating"
  - `keyDevelopments`: Array of 3-5 bullet points
  - `recommendedActions`: Array of 3-5 prioritized actions
  - `pipelineMetrics`: Structured summary of pipeline health
  - `marketMetrics`: Structured summary of market conditions
- Stores in `WeeklyBrief` table
- Can be triggered manually from Market Overview page or via cron

**B2: Market Metrics Auto-Computation**

Modify scraping post-processor to record `MarketMetric` after each scrape run:
- `targetsTracked`: Count of non-hidden listings
- `actionableTargets`: Count of listings with compositeScore >= 60
- `newListingsThisPeriod`: Count of listings created in last 7 days
- `weightedPipelineValue`: Sum of opportunity values weighted by stage probability

**B3: Thesis Coverage Score**

New component on Market Overview showing coverage by trade category:
- For each of the 11 target trades: count of pipeline opportunities + active targets
- Visual: horizontal bar chart showing coverage strength per trade
- Highlights gaps: "No pipeline coverage in: Structured Cabling, Plumbing, Concrete/Masonry"

**B4: Interactive Market Map (Leaflet)**

Replace Market Map placeholder with Leaflet-based Colorado map:
- Pipeline opportunities as colored pins (green=early, blue=mid, gold=LOI+)
- Active targets as smaller dots (colored by primary trade)
- Tooltip on hover: company name, trade, stage/score, revenue
- Click to navigate to opportunity/listing detail page
- Uses existing `latitude`/`longitude` on Listing model
- Geocode missing coordinates using Listing `city`/`state` (one-time backfill + on-create)
- Center on Colorado, zoom to Front Range by default

**Dependencies:**
- `react-leaflet` + `leaflet` npm packages
- No API key required (OpenStreetMap tiles)
- Geocoding: use free Nominatim API for missing lat/long (rate-limited but sufficient for batch)

---

## Workstream C: Financial Tools → Pipeline-First

### Problem
Valuation Calculator and Deal Comparison still fetch from `/api/listings?pageSize=100` — showing scraped leads instead of pipeline opportunities. The Roll-Up Model was already migrated (commit f6c8df7).

### Design

**C1: Valuation Calculator Migration**

File: `src/app/(dashboard)/financial/valuation/page.tsx`
- Replace `useQuery(["listings-for-valuation"])` with `usePipelineCompanies()` hook
- Replace `mapListingToValuationInputs()` with new `mapOpportunityToValuationInputs()`
- Dropdown shows: `formatOpportunityOption()` (already exists in listing-mapper.ts)
- Pre-fill chain: `opportunity.actualEbitda → listing.ebitda → listing.sde → listing.inferredEbitda → 0`

**C2: Deal Comparison Migration**

File: `src/app/(dashboard)/financial/compare/page.tsx`
- Replace listings fetch with `usePipelineCompanies()` hook
- Replace `buildComparisonInputs()` with new `buildComparisonInputsFromOpportunity()`
- Dropdown shows pipeline opportunities instead of scraped leads

**C3: Shared mapper functions**

File: `src/lib/financial/listing-mapper.ts`
- Add `mapOpportunityToValuationInputs(company: PipelineCompany): ValuationInputs`
- Add `buildComparisonInputsFromOpportunity(company: PipelineCompany): ValuationInputs`
- Both use the same fallback chain as the Roll-Up mapper

---

## Workstream D: Listings Cleanup + State Filtering

### Problem
1. Non-Colorado listings enter the DB (especially via email parsing) and clutter Target Businesses
2. Listings promoted to pipeline still show in Target Businesses / Scraped Leads (duplicates)
3. Email parser defaults `state: "CO"` which may be incorrect

### Design

**D1: Out-of-Geography Flagging**

Approach: Flag + low priority (user's choice — not hidden, but clearly marked)

- Add to post-processor: after state is resolved, if `state !== "CO"` and `state !== null`:
  - Set `thesisAlignment` to `"out_of_geography"`
  - Set `tier` to `"TIER_3_DISQUALIFIED"`
  - Auto-create tag: `OUT_OF_GEOGRAPHY`
- UI: Display warning badge on listing cards for out-of-geography listings
- Listings API: Sort out-of-geography listings to bottom within their respective tabs
- Fit score engine already penalizes non-CO (scores 1/10 on geographic fit = ~10% weight)

**D2: Auto-Hide on Pipeline Promotion**

Modify `POST /api/listings/[id]/pipeline`:
- After creating the Opportunity and linking the listing, set `listing.isHidden = true`
- The listing data remains accessible through `opportunity.listing` relation
- This prevents duplicates between Pipeline and Target Businesses tabs

**D3: Backfill Cleanup Script**

One-time script `scripts/cleanup-listings.ts`:
- Find all listings with `opportunity !== null` and `isHidden === false` → set `isHidden = true`
- Find all listings with `state !== "CO"` and `state !== null` → set tier to DISQUALIFIED, add tag
- Report counts before executing

**D4: Email Parser State Improvement**

File: `src/lib/email/listing-email-parser.ts`
- Currently defaults `state: "CO"` for Transworld alerts
- Improve: parse location from email body more aggressively before defaulting
- If state clearly identified as non-CO, set it correctly (so D1 flagging catches it)
- Only default to "CO" when location truly cannot be determined

---

## Implementation Order

1. **D: Listings Cleanup** (fastest, unblocks cleaner data for all other workstreams)
2. **C: Financial Tools** (straightforward migration, same pattern as Roll-Up)
3. **A: Notes → AI** (schema change + endpoint modifications)
4. **B: Market Intel** (largest, most new code — builds on clean data from D)

---

## Files Modified/Created

### New Files
- `src/app/api/cron/weekly-brief/route.ts` — Weekly brief generator
- `src/components/market-intel/thesis-coverage.tsx` — Trade coverage component
- `src/components/market-intel/leaflet-map.tsx` — Interactive map
- `src/components/notes/meeting-notes-modal.tsx` — Meeting notes ingestion
- `src/lib/ai/weekly-brief.ts` — Claude prompt for weekly briefs
- `src/lib/ai/meeting-notes-extractor.ts` — Claude prompt for meeting note extraction
- `scripts/cleanup-listings.ts` — One-time backfill
- `scripts/geocode-listings.ts` — One-time geocoding backfill

### Modified Files
- `prisma/schema.prisma` — NoteType enum, Note model fields
- `src/app/api/pipeline/[id]/notes/route.ts` — Support noteType + title
- `src/app/api/pipeline/[id]/analyze-cim/route.ts` — Include notes in AI context
- `src/app/api/ai/deep-dive/route.ts` — Include all notes (not just 10)
- `src/app/api/pipeline/[id]/summarize/route.ts` — Include notes
- `src/app/api/pipeline/[id]/risk-assessment/route.ts` — Include notes
- `src/app/(dashboard)/financial/valuation/page.tsx` — Pipeline dropdown
- `src/app/(dashboard)/financial/compare/page.tsx` — Pipeline dropdown
- `src/lib/financial/listing-mapper.ts` — New opportunity→valuation mappers
- `src/app/(dashboard)/market-intel/overview/page.tsx` — Wire weekly brief + metrics
- `src/app/(dashboard)/market-intel/map/page.tsx` — Replace placeholder with Leaflet
- `src/app/api/market-intel/overview/route.ts` — Add thesis coverage data
- `src/lib/scrapers/post-processor.ts` — State flagging
- `src/app/api/listings/[id]/pipeline/route.ts` — Auto-hide on promote
- `src/lib/email/listing-email-parser.ts` — Better state detection
- `src/app/(dashboard)/pipeline/[id]/page.tsx` — Note type UI
- `src/app/(dashboard)/listings/page.tsx` — Out-of-geography badges
