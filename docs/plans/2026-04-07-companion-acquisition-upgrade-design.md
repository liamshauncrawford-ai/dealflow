# Companion Acquisition Upgrade — Design Document

**Date:** 2026-04-07
**Author:** Claude Code (Opus 4.6)
**Approved by:** Liam Crawford
**Status:** Approved — Layer 1 implementation starting

---

## Context

DealFlow is being upgraded to support Liam's PMS companion acquisition search. The existing platform is a mature deal sourcing tool (30+ models, 25+ routes, 17 AI modules). This upgrade adds:

1. **4-rank target type system** (MSP, UCaaS, Security Integration, Structured Cabling)
2. **100-point acquisition scoring rubric** (replaces existing 10-factor fit score)
3. **BVR market data import** (Excel/CSV from bvresources.com)
4. **Deal structure calculator** (3 SBA financing scenarios)
5. **Browser-assisted marketplace search** (Claude Code controlling Chrome)

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pipeline stages | Keep existing 11 stages | Already reflects Liam's actual workflow; just refined with Initial Owner Meeting |
| Scoring approach | Replace current with spec rubric | New rubric is purpose-built for companion search; old was generic |
| Existing deal reclassification | Auto-map by primaryTrade | Security/Fire Alarm → Rank 3, Structured Cabling/Electrical → Rank 4, others unranked |
| Scraper strategy | Browser-assisted via Claude Code | 5/7 marketplace scrapers blocked by bot detection; real browser session is reliable |
| Implementation approach | 4 incremental layers | Each ships independently; highest-value features first |

---

## Layer 1 Design: Foundation

### Schema Changes

#### New fields on `Listing` model

```prisma
targetRank              Int?       // 1=MSP, 2=UCaaS, 3=Security, 4=Cabling
targetRankLabel         String?    // Display label
acquisitionScore        Int?       // 0-100 total
financialScore          Int?       // 0-40
strategicScore          Int?       // 0-35
operatorScore           Int?       // 0-25
acquisitionTier         String?    // "A", "B", "C", "Inactive"
disqualifiers           String[]   // Triggered disqualifier reasons
mrrPctOfRevenue         Float?     // MRR as % of revenue
revenueTrend            String?    // Enum: Growing >10%, Growing 0-10%, Flat, etc.
topClientPct            Float?     // Top client as % of revenue
ownerIsPrimarySales     Boolean?   // Owner is primary salesperson
ownerIsSoleTech         Boolean?   // TRUE = disqualifier
ownerRetirementSignal   String?    // Strong, Moderate, Weak, Unknown
clientIndustryOverlap   String?    // Direct, Moderate, Partial, None
technicalStaffCount     Int?       // Techs excluding owner
sbaEligible             Boolean?   // SBA 7(a) eligible
```

#### New `AcquisitionThesisConfig` model

```prisma
model AcquisitionThesisConfig {
  id                        String   @id @default(cuid())
  targetRank                Int      @unique  // 1, 2, 3, 4
  rankLabel                 String   // "MSP", "UCaaS", etc.
  description               String?
  synergyDescription        String?
  isActive                  Boolean  @default(true)

  // Hard filters
  hardFilterMinRevenue      Float?
  hardFilterMinEbitda       Float?
  hardFilterMinEbitdaMargin Float?
  hardFilterMinMrrPct       Float?
  hardFilterMinYears        Int?

  // Soft filter targets
  softFilterRevenueLow      Float?
  softFilterRevenueHigh     Float?
  softFilterEbitdaLow       Float?
  softFilterEbitdaHigh      Float?

  // Valuation benchmarks
  valuationMultipleLow      Float?
  valuationMultipleMid      Float?
  valuationMultipleHigh     Float?
  impliedPriceLow           Float?
  impliedPriceHigh          Float?

  // BVR codes
  sicCodes                  String[]
  naicsCodes                String[]

  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
}
```

#### Scoring config in AppSetting

Key: `acquisition_scoring_config`
Value: JSON with all threshold breakpoints for:
- Financial sub-scores (EBITDA margin, MRR%, revenue trend, client concentration)
- Strategic sub-scores (rank points, overlap, geography, owner situation)
- Operator fit sub-scores (owner-as-salesperson, tech staff, SBA eligibility)
- Disqualifier rules (top client %, revenue decline, etc.)
- Close cities list (for geography scoring)

### Scoring Engine

New file: `src/lib/scoring/acquisition-scorer.ts`

```typescript
scoreTarget(listing: Listing): AcquisitionScoreResult {
  // 1. Check disqualifiers first
  const disqualifiers = checkDisqualifiers(listing);
  if (disqualifiers.length > 0) return { tier: "Inactive", total: 0, disqualifiers };

  // 2. Financial Score (max 40)
  //    EBITDA margin (0/5/8/10) + MRR% (0/5/8/10) +
  //    Revenue trend (0/5/8/10) + Client concentration (0/5/8/10)

  // 3. Strategic Score (raw max 48, capped at 35)
  //    Target rank (0/5/8/12) + Client overlap (0/5/8/12) +
  //    Geography (0/5/8/12) + Owner situation (0/5/8/12)

  // 4. Operator Fit Score (raw max 36, capped at 25)
  //    Owner-as-salesperson (0/5/10/12) + Tech staff (0/5/10/12) +
  //    SBA eligible (0/5/10/12)

  // 5. Total = financial + strategic + operator
  // 6. Tier: A (80+), B (65-79), C (50-64), Inactive (<50)
}
```

All thresholds loaded from AppSetting, not hardcoded.

### Disqualifier Engine

8 automatic disqualifiers:
1. Owner is sole technical resource (`ownerIsSoleTech === true`)
2. Single client > 40% revenue (`topClientPct > 40`)
3. Revenue declining > 15% YoY for 2+ years
4. Residential-only client base
5. Outside Colorado (`state !== 'CO'`)
6. Negative EBITDA (unless price < $100K)
7. Active disclosed litigation
8. Key man insurance lapse

### API Changes

- **Replace** `POST /api/listings/[id]/score` — Use new acquisition scorer
- **New** `POST /api/listings/rescore-all` — Batch reclassify all listings
- **New** `POST /api/import/scraped-listings` — Accept raw listings from browser search
- **New** `GET/PUT /api/settings/acquisition-thesis` — CRUD for 4-rank config

### UI Changes

- **Pipeline cards**: Add rank badge (colored, e.g., "MSP" in blue) + tier badge (A/B/C)
- **Listings table**: New columns (Rank, Acq. Score, Tier) + filter dropdowns
- **Deal detail page**: New "Acquisition Score" panel with 3 sub-score bars + disqualifier list
- **Settings > Thesis**: New section for 4-rank configuration (hard/soft filters, valuation, SIC/NAICS)

### Data Migration Script

`scripts/migrate-acquisition-ranks.ts`:
1. Map `primaryTrade` → `targetRank`:
   - Security/Fire Alarm → 3 (Security Integration)
   - Structured Cabling → 4
   - Electrical → 4
   - Others → null (unranked)
2. Score every listing with new rubric
3. Assign `acquisitionTier`
4. Seed `AcquisitionThesisConfig` with spec defaults for all 4 ranks
5. Seed `acquisition_scoring_config` AppSetting with default thresholds

---

## Layer 2 Design: Target Detail Enrichment (Future)

- Deal structure calculator (3 SBA scenarios + PMS bridge at $28,583/mo)
- SDE→EBITDA adjustment ($95K owner salary deduction)
- BVR schema (`BvrTransaction`, `BvrImportHistory` models)
- BVR import module (Excel/CSV upload, SIC filter, preview, confirm)
- Market intelligence panel on deal detail (comps, multiples, deal structure breakdown)
- Outreach templates (Template A: direct owner, B: listed/broker, C: CPA referral)

---

## Layer 3 Design: Intelligence (Future)

- BVR Query Assistant (per-rank search instructions, SIC codes, RADA prompts)
- Market data dashboard (per-rank tabs, histograms, trends)
- Priority A fast-track (auto-generate thesis, offer range, outreach, DD questions)
- Due diligence checklists (pre-NDA, post-NDA, LOI/DD — stage-gated)

---

## Layer 4 Design: Discovery (Future)

### Browser-Assisted Marketplace Search

Claude Code skill (`/search-marketplaces`) that:
1. Uses Playwright MCP / Claude in Chrome to open each marketplace
2. Runs thesis search queries (19 from constants.ts + new MSP/UCaaS queries)
3. Extracts listing data from search results and detail pages
4. Calls `POST /api/import/scraped-listings` to persist
5. Post-processor handles dedup, rank assignment, scoring

Supported marketplaces:
- BizBuySell, BizQuest, BusinessBroker.net
- BusinessesForSale, ClearlyAcquired
- BizQuest, MergerPlace

This replaces the broken automated scrapers with reliable browser-based search.

### Additional Features
- Off-market target entry form (pre-populate rank, geography)
- Dashboard upgrades (BVR snapshots, rank-based stats)
- CSV/Excel export

---

## Trade Rank Mapping (Existing → New)

| Current primaryTrade | → Rank | Label |
|---------------------|--------|-------|
| Security/Fire Alarm | 3 | Security Integration |
| Structured Cabling | 4 | Structured Cabling |
| Electrical | 4 | Structured Cabling |
| HVAC, Plumbing, Framing, etc. | null | Unranked (keep in system) |
| (new) | 1 | MSP |
| (new) | 2 | UCaaS |

---

*Design approved 2026-04-07. Layer 1 implementation starting immediately.*
