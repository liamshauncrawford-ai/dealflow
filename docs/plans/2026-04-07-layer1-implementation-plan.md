# Layer 1: Companion Acquisition Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic 10-factor fit score with a 100-point acquisition rubric aligned to 4 target types (MSP, UCaaS, Security, Cabling), add 8 auto-disqualifiers, and reclassify all existing deals.

**Architecture:** New `acquisition-scorer.ts` engine reads thresholds from `AppSetting` JSON config. New fields added alongside existing Listing fields (no deletions). `AcquisitionThesisConfig` table stores per-rank configuration. Existing `fitScore`/`compositeScore` fields remain for backward compat; new `acquisitionScore`/`acquisitionTier` become the primary display fields.

**Tech Stack:** Next.js 16, Prisma (PostgreSQL 16), TypeScript, Tailwind CSS, shadcn/ui, React Query hooks

**Codebase Reference:**
- Prisma schema: `prisma/schema.prisma` (Listing model starts line 15, ~163 lines; AppSetting at line 984)
- Current scorer: `src/lib/scoring/fit-score-engine.ts` (10-factor weighted, 383 lines)
- Score API: `src/app/api/listings/[id]/score/route.ts` (calls `computeFitScore`)
- Score barrel export: `src/lib/scoring/index.ts`
- Constants: `src/lib/constants.ts` (FIT_SCORE_WEIGHTS, TARGET_TRADES, PrimaryTrade enum)
- Thesis defaults: `src/lib/thesis-defaults.ts` (ThesisConfig type)
- Settings UI: `src/app/(dashboard)/settings/thesis/page.tsx`
- Pipeline card: `src/components/pipeline/linked-listing-card.tsx`
- Deal header: `src/components/pipeline/deal-header.tsx`
- Listings table: `src/components/listings/listings-table.tsx` (compositeScore at line 214)
- Post-processor: `src/lib/scrapers/post-processor.ts` (imports computeFitScore)
- Daily scan: `src/app/api/cron/daily-scan/route.ts` (imports computeFitScore)
- Seed route: `src/app/api/admin/seed/route.ts` (imports computeFitScore)
- Listing PUT: `src/app/api/listings/[id]/route.ts` (imports computeFitScore)

**Enums in schema:**
- `PrimaryTrade`: ELECTRICAL, STRUCTURED_CABLING, SECURITY_FIRE_ALARM, FRAMING_DRYWALL, HVAC_MECHANICAL, PLUMBING, PAINTING_FINISHING, CONCRETE_MASONRY, ROOFING, SITE_WORK, GENERAL_COMMERCIAL
- `Tier`: TIER_1_ACTIVE, TIER_2_WATCH, TIER_3_DISQUALIFIED, OWNED

**Node path:** `/Users/liamcrawford/.nvm/versions/node/v24.13.0/bin/node`
**Run commands from:** `~/dealflow`

---

## Task 1: Prisma Schema — New Listing Fields

**Files:**
- Modify: `prisma/schema.prisma` (Listing model, after line ~109 `disqualificationReason`)

**Step 1: Add new fields to Listing model**

Add these fields in the Listing model, right after the `synergyNotes` field (line ~110):

```prisma
  // ── Companion Acquisition Scoring ──────────
  targetRank              Int?       // 1=MSP, 2=UCaaS, 3=Security, 4=Cabling
  targetRankLabel         String?    // Display label (e.g. "MSP")
  acquisitionScore        Int?       // 0-100 total (new rubric)
  financialScore          Int?       // 0-40 sub-score
  strategicScore          Int?       // 0-35 sub-score (capped)
  operatorScore           Int?       // 0-25 sub-score (capped)
  acquisitionTier         String?    // "A" | "B" | "C" | "Inactive"
  acquisitionDisqualifiers String[]  // Triggered disqualifier reason strings

  // ── Target profile fields ──────────────────
  mrrAmount               Decimal?   @db.Decimal(14, 2)
  mrrPctOfRevenue         Float?     // MRR as % of revenue (0.0-1.0)
  revenueTrendDetail      String?    // "Growing >10%", "Growing 0-10%", "Flat", "Declining 0-10%", "Declining >10%"
  topClientPct            Float?     // Largest client as % of revenue (0.0-1.0)
  ownerIsPrimarySales     Boolean?
  ownerIsSoleTech         Boolean?   // TRUE = disqualifier #1
  ownerRetirementSignal   String?    // "Strong", "Moderate", "Weak", "Unknown"
  clientIndustryOverlap   String?    // "Direct", "Moderate", "Partial", "None"
  technicalStaffCount     Int?       // Techs excluding owner
  sbaEligible             Boolean?   @default(true)
  clientBaseType          String?    // "Commercial", "Mixed", "Residential" — residential = disqualifier
  hasActiveLitigation     Boolean?   @default(false) // disqualifier #7
  hasKeyManInsurance      Boolean?   @default(true)  // lapse = disqualifier #8
```

Also add indexes after the existing ones (before the closing `}`):

```prisma
  @@index([targetRank])
  @@index([acquisitionScore])
  @@index([acquisitionTier])
```

**Step 2: Run Prisma format and generate**

```bash
npx prisma format
npx prisma db push
npx prisma generate
```

Expected: Schema pushes successfully. `prisma generate` creates updated client.

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add companion acquisition fields to Listing model"
```

---

## Task 2: Prisma Schema — AcquisitionThesisConfig Model

**Files:**
- Modify: `prisma/schema.prisma` (add new model after AppSetting, ~line 988)

**Step 1: Add AcquisitionThesisConfig model**

Add after the `AppSetting` model:

```prisma
model AcquisitionThesisConfig {
  id                        String   @id @default(cuid())
  targetRank                Int      @unique  // 1, 2, 3, 4
  rankLabel                 String   // "MSP", "UCaaS", "Security Integration", "Structured Cabling"
  description               String?  @db.Text
  synergyDescription        String?  @db.Text
  isActive                  Boolean  @default(true)

  // Hard filters (auto-disqualify if not met)
  hardFilterMinRevenue      Float?
  hardFilterMinEbitda       Float?
  hardFilterMinEbitdaMargin Float?
  hardFilterMinMrrPct       Float?
  hardFilterMinYears        Int?

  // Soft filter target ranges
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

  // BVR search codes
  sicCodes                  String[]
  naicsCodes                String[]

  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
}
```

**Step 2: Push and generate**

```bash
npx prisma format
npx prisma db push
npx prisma generate
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add AcquisitionThesisConfig model for 4-rank thesis"
```

---

## Task 3: Seed Acquisition Thesis Config Defaults

**Files:**
- Create: `scripts/seed-acquisition-config.ts`

**Step 1: Write the seed script**

```typescript
/**
 * Seed AcquisitionThesisConfig for the 4 target ranks
 * and the acquisition_scoring_config AppSetting.
 *
 * Run: npx tsx scripts/seed-acquisition-config.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RANK_CONFIGS = [
  {
    targetRank: 1,
    rankLabel: "MSP",
    description: "Managed IT Services Provider — highest synergy target. MRR funds PMS turnaround. Same commercial client base.",
    synergyDescription: "MSPs serve the same commercial clients that need AV integration. Liam takes over sales/BD while existing techs continue service delivery. MRR from managed services directly offsets PMS operating losses.",
    hardFilterMinRevenue: 800000,
    hardFilterMinEbitda: 150000,
    hardFilterMinEbitdaMargin: 0.10,
    hardFilterMinMrrPct: 0.30,
    hardFilterMinYears: 5,
    softFilterRevenueLow: 1000000,
    softFilterRevenueHigh: 3000000,
    softFilterEbitdaLow: 250000,
    softFilterEbitdaHigh: 425000,
    valuationMultipleLow: 4.0,
    valuationMultipleMid: 5.0,
    valuationMultipleHigh: 6.0,
    impliedPriceLow: 1000000,
    impliedPriceHigh: 2100000,
    sicCodes: ["7376", "7379", "7374"],
    naicsCodes: ["541512", "541513", "541519", "518210"],
  },
  {
    targetRank: 2,
    rankLabel: "UCaaS",
    description: "Unified Communications / Teams Rooms / VoIP — direct AV overlap with seat-based MRR.",
    synergyDescription: "UCaaS providers sell into the same meeting rooms PMS installs AV in. Teams Rooms and VoIP create sticky monthly revenue. Liam's AV background makes this a natural cross-sell.",
    hardFilterMinRevenue: 500000,
    hardFilterMinEbitda: 100000,
    hardFilterMinEbitdaMargin: 0.08,
    hardFilterMinMrrPct: 0.40,
    hardFilterMinYears: 3,
    softFilterRevenueLow: 500000,
    softFilterRevenueHigh: 2000000,
    softFilterEbitdaLow: 150000,
    softFilterEbitdaHigh: 350000,
    valuationMultipleLow: 4.0,
    valuationMultipleMid: 5.0,
    valuationMultipleHigh: 6.0,
    impliedPriceLow: 600000,
    impliedPriceHigh: 2100000,
    sicCodes: ["4813", "7372", "7379", "4899"],
    naicsCodes: ["517312", "517911", "541512", "519190"],
  },
  {
    targetRank: 3,
    rankLabel: "Security Integration",
    description: "Commercial security integration with monitoring contracts — recurring monitoring MRR, same job sites.",
    synergyDescription: "Security integrators wire the same commercial buildings PMS does AV for. Monitoring contracts provide sticky MRR. Low-voltage licensing overlaps.",
    hardFilterMinRevenue: 500000,
    hardFilterMinEbitda: 100000,
    hardFilterMinEbitdaMargin: 0.08,
    hardFilterMinMrrPct: 0.20,
    hardFilterMinYears: 5,
    softFilterRevenueLow: 500000,
    softFilterRevenueHigh: 2500000,
    softFilterEbitdaLow: 150000,
    softFilterEbitdaHigh: 350000,
    valuationMultipleLow: 3.0,
    valuationMultipleMid: 4.0,
    valuationMultipleHigh: 4.5,
    impliedPriceLow: 450000,
    impliedPriceHigh: 1600000,
    sicCodes: ["7382", "7381", "1731", "5065"],
    naicsCodes: ["561621", "238210", "423690"],
  },
  {
    targetRank: 4,
    rankLabel: "Structured Cabling",
    description: "Structured cabling / low-voltage contractor — operational bolt-on capturing margin PMS currently leaves on table.",
    synergyDescription: "PMS subcontracts cabling today at 0% margin. Owning a cabling company captures that margin internally and creates a referral pipeline for AV projects.",
    hardFilterMinRevenue: 300000,
    hardFilterMinEbitda: 80000,
    hardFilterMinEbitdaMargin: 0.08,
    hardFilterMinMrrPct: null,
    hardFilterMinYears: 3,
    softFilterRevenueLow: 500000,
    softFilterRevenueHigh: 2000000,
    softFilterEbitdaLow: 120000,
    softFilterEbitdaHigh: 280000,
    valuationMultipleLow: 2.5,
    valuationMultipleMid: 3.5,
    valuationMultipleHigh: 4.0,
    impliedPriceLow: 300000,
    impliedPriceHigh: 1100000,
    sicCodes: ["1731", "1799", "1711"],
    naicsCodes: ["238210", "238290", "561990"],
  },
];

const DEFAULT_SCORING_CONFIG = {
  // Financial sub-scores (max 40)
  financial: {
    ebitdaMargin: { thresholds: [0.20, 0.15, 0.10, 0.05], points: [10, 8, 5, 0] },
    mrrPct:       { thresholds: [0.50, 0.30, 0.15, 0.0],  points: [10, 8, 5, 0] },
    revenueTrend: {
      values: {
        "Growing >10%": 10,
        "Growing 0-10%": 8,
        "Flat": 5,
        "Declining 0-10%": 2,
        "Declining >10%": 0,
      },
    },
    clientConcentration: { thresholds: [0.10, 0.15, 0.25, 0.40], points: [10, 8, 5, 0] },
  },
  // Strategic sub-scores (raw max 48, capped at 35)
  strategic: {
    targetRank:    { values: { 1: 12, 2: 8, 3: 5, 4: 5, null: 0 } },
    clientOverlap: { values: { "Direct": 12, "Moderate": 8, "Partial": 5, "None": 0 } },
    geography: {
      denverMetroCities: [
        "Denver", "Aurora", "Lakewood", "Arvada", "Westminster", "Thornton",
        "Centennial", "Highlands Ranch", "Boulder", "Longmont", "Loveland",
        "Fort Collins", "Greeley", "Castle Rock", "Parker", "Broomfield",
        "Commerce City", "Northglenn", "Brighton", "Littleton", "Englewood",
        "Sheridan", "Golden", "Wheat Ridge", "Federal Heights", "Lone Tree",
        "Superior", "Louisville", "Lafayette", "Erie",
      ],
      points: { denverMetro: 12, colorado: 8, neighboringState: 5, other: 0 },
      neighboringStates: ["WY", "NE", "KS", "NM", "UT"],
    },
    ownerSituation: {
      values: { "Strong": 12, "Moderate": 8, "Weak": 5, "Unknown": 0 },
    },
    cap: 35,
  },
  // Operator Fit sub-scores (raw max 36, capped at 25)
  operatorFit: {
    ownerIsPrimarySales: { true: 12, false: 5, null: 0 },
    technicalStaff:      { thresholds: [3, 2, 1, 0], points: [12, 10, 5, 0] },
    sbaEligible:         { true: 12, false: 0, null: 5 },
    cap: 25,
  },
  // Tier thresholds
  tiers: {
    A: 80,      // 80+ = Priority A
    B: 65,      // 65-79 = Priority B
    C: 50,      // 50-64 = Priority C
    Inactive: 0, // <50 = Inactive
  },
  // Disqualifier rules
  disqualifiers: {
    ownerIsSoleTech: true,
    topClientPctMax: 0.40,
    residentialOnly: true,
    outsideColorado: true,
    negativeEbitdaUnlessCheap: { priceThreshold: 100000 },
    activeLitigation: true,
    keyManInsuranceLapse: true,
    // Revenue decline >15% for 2+ consecutive years — checked via revenueTrendDetail
    revenueDecliningHard: true,
  },
  // PMS context
  pms: {
    monthlyBurn: 28583,
    location: "Sheridan, CO 80110",
    ownerSalaryForSdeAdjustment: 95000,
  },
};

async function main() {
  console.log("Seeding AcquisitionThesisConfig for 4 ranks...");

  for (const config of RANK_CONFIGS) {
    await prisma.acquisitionThesisConfig.upsert({
      where: { targetRank: config.targetRank },
      update: config,
      create: config,
    });
    console.log(`  Rank ${config.targetRank}: ${config.rankLabel} ✓`);
  }

  console.log("\nSeeding acquisition_scoring_config AppSetting...");

  await prisma.appSetting.upsert({
    where: { key: "acquisition_scoring_config" },
    update: { value: JSON.stringify(DEFAULT_SCORING_CONFIG) },
    create: {
      key: "acquisition_scoring_config",
      value: JSON.stringify(DEFAULT_SCORING_CONFIG),
    },
  });
  console.log("  acquisition_scoring_config ✓");

  console.log("\nDone!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Step 2: Run the seed script**

```bash
npx tsx scripts/seed-acquisition-config.ts
```

Expected: 4 AcquisitionThesisConfig rows created, 1 AppSetting row created/updated.

**Step 3: Commit**

```bash
git add scripts/seed-acquisition-config.ts
git commit -m "feat: seed 4-rank acquisition thesis config + scoring defaults"
```

---

## Task 4: Scoring Engine — `acquisition-scorer.ts`

**Files:**
- Create: `src/lib/scoring/acquisition-scorer.ts`
- Modify: `src/lib/scoring/index.ts` (add exports)

**Step 1: Create the acquisition scorer**

Create `src/lib/scoring/acquisition-scorer.ts`:

```typescript
/**
 * Acquisition Scoring Engine — 100-point rubric for companion acquisition targets.
 *
 * Three sub-scores:
 *   Financial (max 40): EBITDA margin + MRR% + Revenue trend + Client concentration
 *   Strategic (raw max 48, capped at 35): Rank + Client overlap + Geography + Owner situation
 *   Operator Fit (raw max 36, capped at 25): Owner-as-salesperson + Tech staff + SBA eligible
 *
 * 8 automatic disqualifiers force tier = "Inactive" regardless of score.
 *
 * All thresholds loaded from AppSetting key "acquisition_scoring_config".
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AcquisitionScoreInput {
  // Target classification
  targetRank: number | null;

  // Financial data
  ebitda: number | null;
  revenue: number | null;
  askingPrice: number | null;
  mrrPctOfRevenue: number | null;
  revenueTrendDetail: string | null;
  topClientPct: number | null;

  // Strategic data
  clientIndustryOverlap: string | null;
  state: string | null;
  city: string | null;
  metroArea: string | null;
  ownerRetirementSignal: string | null;

  // Operator fit data
  ownerIsPrimarySales: boolean | null;
  technicalStaffCount: number | null;
  sbaEligible: boolean | null;

  // Disqualifier fields
  ownerIsSoleTech: boolean | null;
  clientBaseType: string | null;
  hasActiveLitigation: boolean | null;
  hasKeyManInsurance: boolean | null;
}

export interface SubScoreDetail {
  label: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface AcquisitionScoreResult {
  total: number;              // 0-100
  financialScore: number;     // 0-40
  strategicScore: number;     // 0-35 (capped)
  operatorScore: number;      // 0-25 (capped)
  tier: "A" | "B" | "C" | "Inactive";
  disqualifiers: string[];
  financialDetails: SubScoreDetail[];
  strategicDetails: SubScoreDetail[];
  operatorDetails: SubScoreDetail[];
}

export interface ScoringConfig {
  financial: {
    ebitdaMargin: { thresholds: number[]; points: number[] };
    mrrPct: { thresholds: number[]; points: number[] };
    revenueTrend: { values: Record<string, number> };
    clientConcentration: { thresholds: number[]; points: number[] };
  };
  strategic: {
    targetRank: { values: Record<string, number> };
    clientOverlap: { values: Record<string, number> };
    geography: {
      denverMetroCities: string[];
      points: Record<string, number>;
      neighboringStates: string[];
    };
    ownerSituation: { values: Record<string, number> };
    cap: number;
  };
  operatorFit: {
    ownerIsPrimarySales: Record<string, number>;
    technicalStaff: { thresholds: number[]; points: number[] };
    sbaEligible: Record<string, number>;
    cap: number;
  };
  tiers: Record<string, number>;
  disqualifiers: Record<string, unknown>;
  pms: { monthlyBurn: number; location: string; ownerSalaryForSdeAdjustment: number };
}

// ─────────────────────────────────────────────
// Disqualifier Check
// ─────────────────────────────────────────────

export function checkDisqualifiers(
  input: AcquisitionScoreInput,
  config: ScoringConfig
): string[] {
  const reasons: string[] = [];

  // 1. Owner is sole technical resource
  if (input.ownerIsSoleTech === true) {
    reasons.push("Owner is the sole technical resource");
  }

  // 2. Single client > 40% of revenue
  const maxClientPct = (config.disqualifiers.topClientPctMax as number) ?? 0.40;
  if (input.topClientPct !== null && input.topClientPct > maxClientPct) {
    reasons.push(`Single client > ${Math.round(maxClientPct * 100)}% of revenue (${Math.round((input.topClientPct ?? 0) * 100)}%)`);
  }

  // 3. Revenue declining >15% YoY for 2+ consecutive years
  if (input.revenueTrendDetail === "Declining >10%") {
    reasons.push("Revenue declining >15% YoY for 2+ consecutive years");
  }

  // 4. Residential-only client base
  if (input.clientBaseType === "Residential") {
    reasons.push("Residential-only client base");
  }

  // 5. Outside Colorado
  if (input.state && input.state.toUpperCase().trim() !== "CO" && input.state.toUpperCase().trim() !== "COLORADO") {
    reasons.push(`Outside Colorado (${input.state})`);
  }

  // 6. Negative EBITDA (unless price < $100K asset-only deal)
  if (input.ebitda !== null && input.ebitda < 0) {
    const priceThreshold = (config.disqualifiers.negativeEbitdaUnlessCheap as { priceThreshold: number })?.priceThreshold ?? 100000;
    if (!input.askingPrice || input.askingPrice >= priceThreshold) {
      reasons.push("Negative EBITDA (not a sub-$100K asset deal)");
    }
  }

  // 7. Active disclosed litigation
  if (input.hasActiveLitigation === true) {
    reasons.push("Active disclosed litigation");
  }

  // 8. Key man insurance lapse
  if (input.hasKeyManInsurance === false) {
    reasons.push("Key man insurance lapse without renewal");
  }

  return reasons;
}

// ─────────────────────────────────────────────
// Threshold-based scoring helper
// ─────────────────────────────────────────────

/**
 * Score using descending threshold array.
 * thresholds = [0.20, 0.15, 0.10, 0.05], points = [10, 8, 5, 0]
 * Value >= 0.20 → 10, >= 0.15 → 8, >= 0.10 → 5, else → 0
 */
function scoreByThreshold(
  value: number | null,
  thresholds: number[],
  points: number[],
  ascending = false
): number {
  if (value === null || value === undefined) return 0;

  if (ascending) {
    // Lower is better (e.g., client concentration)
    for (let i = 0; i < thresholds.length; i++) {
      if (value <= thresholds[i]) return points[i];
    }
    return points[points.length - 1] ?? 0;
  }

  // Higher is better (default)
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) return points[i];
  }
  return points[points.length - 1] ?? 0;
}

// ─────────────────────────────────────────────
// Main Scoring Function
// ─────────────────────────────────────────────

export function scoreAcquisitionTarget(
  input: AcquisitionScoreInput,
  config: ScoringConfig
): AcquisitionScoreResult {
  // 1. Check disqualifiers
  const disqualifiers = checkDisqualifiers(input, config);
  if (disqualifiers.length > 0) {
    return {
      total: 0,
      financialScore: 0,
      strategicScore: 0,
      operatorScore: 0,
      tier: "Inactive",
      disqualifiers,
      financialDetails: [],
      strategicDetails: [],
      operatorDetails: [],
    };
  }

  // 2. Financial Score (max 40)
  const ebitdaMargin = (input.ebitda !== null && input.revenue !== null && input.revenue > 0)
    ? input.ebitda / input.revenue
    : null;

  const fc = config.financial;

  const ebitdaMarginPts = scoreByThreshold(ebitdaMargin, fc.ebitdaMargin.thresholds, fc.ebitdaMargin.points);
  const mrrPts = scoreByThreshold(input.mrrPctOfRevenue, fc.mrrPct.thresholds, fc.mrrPct.points);
  const trendPts = input.revenueTrendDetail
    ? (fc.revenueTrend.values[input.revenueTrendDetail] ?? 0)
    : 0;
  const concPts = scoreByThreshold(input.topClientPct, fc.clientConcentration.thresholds, fc.clientConcentration.points, true);

  const financialScore = Math.min(40, ebitdaMarginPts + mrrPts + trendPts + concPts);
  const financialDetails: SubScoreDetail[] = [
    { label: "EBITDA Margin", points: ebitdaMarginPts, maxPoints: 10, reason: ebitdaMargin !== null ? `${(ebitdaMargin * 100).toFixed(1)}%` : "Unknown" },
    { label: "MRR %", points: mrrPts, maxPoints: 10, reason: input.mrrPctOfRevenue !== null ? `${(input.mrrPctOfRevenue * 100).toFixed(0)}%` : "Unknown" },
    { label: "Revenue Trend", points: trendPts, maxPoints: 10, reason: input.revenueTrendDetail ?? "Unknown" },
    { label: "Client Concentration", points: concPts, maxPoints: 10, reason: input.topClientPct !== null ? `Top client: ${(input.topClientPct * 100).toFixed(0)}%` : "Unknown" },
  ];

  // 3. Strategic Score (raw max 48, capped at 35)
  const sc = config.strategic;

  const rankKey = input.targetRank !== null ? String(input.targetRank) : "null";
  const rankPts = sc.targetRank.values[rankKey] ?? 0;
  const overlapPts = sc.clientOverlap.values[input.clientIndustryOverlap ?? "None"] ?? 0;

  // Geography scoring
  let geoPts = sc.geography.points.other ?? 0;
  const normalizedState = input.state?.toUpperCase().trim();
  if (normalizedState === "CO" || normalizedState === "COLORADO") {
    const cityLower = input.city?.toLowerCase().trim() ?? "";
    const metroLower = input.metroArea?.toLowerCase().trim() ?? "";
    const denverCities = sc.geography.denverMetroCities.map(c => c.toLowerCase());
    if (denverCities.includes(cityLower) || metroLower.includes("denver")) {
      geoPts = sc.geography.points.denverMetro ?? 12;
    } else {
      geoPts = sc.geography.points.colorado ?? 8;
    }
  } else if (normalizedState && sc.geography.neighboringStates.includes(normalizedState)) {
    geoPts = sc.geography.points.neighboringState ?? 5;
  }

  const ownerSitPts = sc.ownerSituation.values[input.ownerRetirementSignal ?? "Unknown"] ?? 0;

  const strategicRaw = rankPts + overlapPts + geoPts + ownerSitPts;
  const strategicScore = Math.min(sc.cap, strategicRaw);
  const strategicDetails: SubScoreDetail[] = [
    { label: "Target Rank", points: rankPts, maxPoints: 12, reason: input.targetRank ? `Rank ${input.targetRank}` : "Unranked" },
    { label: "Client Overlap", points: overlapPts, maxPoints: 12, reason: input.clientIndustryOverlap ?? "Unknown" },
    { label: "Geography", points: geoPts, maxPoints: 12, reason: `${input.city ?? "?"}, ${input.state ?? "?"}` },
    { label: "Owner Situation", points: ownerSitPts, maxPoints: 12, reason: input.ownerRetirementSignal ?? "Unknown" },
  ];

  // 4. Operator Fit Score (raw max 36, capped at 25)
  const oc = config.operatorFit;

  const salesKey = input.ownerIsPrimarySales === null ? "null" : String(input.ownerIsPrimarySales);
  const salesPts = oc.ownerIsPrimarySales[salesKey] ?? 0;
  const techPts = scoreByThreshold(input.technicalStaffCount, oc.technicalStaff.thresholds, oc.technicalStaff.points);
  const sbaKey = input.sbaEligible === null ? "null" : String(input.sbaEligible);
  const sbaPts = oc.sbaEligible[sbaKey] ?? 0;

  const operatorRaw = salesPts + techPts + sbaPts;
  const operatorScore = Math.min(oc.cap, operatorRaw);
  const operatorDetails: SubScoreDetail[] = [
    { label: "Owner as Salesperson", points: salesPts, maxPoints: 12, reason: input.ownerIsPrimarySales === true ? "Yes — Liam fills this role" : input.ownerIsPrimarySales === false ? "No" : "Unknown" },
    { label: "Technical Staff", points: techPts, maxPoints: 12, reason: input.technicalStaffCount !== null ? `${input.technicalStaffCount} techs` : "Unknown" },
    { label: "SBA Eligible", points: sbaPts, maxPoints: 12, reason: input.sbaEligible === true ? "Yes" : input.sbaEligible === false ? "No" : "Unknown" },
  ];

  // 5. Total and Tier
  const total = financialScore + strategicScore + operatorScore;

  let tier: "A" | "B" | "C" | "Inactive";
  if (total >= config.tiers.A) tier = "A";
  else if (total >= config.tiers.B) tier = "B";
  else if (total >= config.tiers.C) tier = "C";
  else tier = "Inactive";

  return {
    total,
    financialScore,
    strategicScore,
    operatorScore,
    tier,
    disqualifiers: [],
    financialDetails,
    strategicDetails,
    operatorDetails,
  };
}

// ─────────────────────────────────────────────
// Helper: Load scoring config from AppSetting
// ─────────────────────────────────────────────

import { prisma } from "@/lib/db";

let _cachedConfig: ScoringConfig | null = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function loadScoringConfig(): Promise<ScoringConfig> {
  const now = Date.now();
  if (_cachedConfig && now - _cachedAt < CACHE_TTL_MS) {
    return _cachedConfig;
  }

  const setting = await prisma.appSetting.findUnique({
    where: { key: "acquisition_scoring_config" },
  });

  if (!setting) {
    throw new Error("acquisition_scoring_config not found in AppSetting. Run: npx tsx scripts/seed-acquisition-config.ts");
  }

  _cachedConfig = JSON.parse(setting.value) as ScoringConfig;
  _cachedAt = now;
  return _cachedConfig;
}

/** Force-clear cache (e.g., after settings update) */
export function clearScoringConfigCache() {
  _cachedConfig = null;
  _cachedAt = 0;
}
```

**Step 2: Update the barrel export**

In `src/lib/scoring/index.ts`, add:

```typescript
export {
  scoreAcquisitionTarget,
  checkDisqualifiers,
  loadScoringConfig,
  clearScoringConfigCache,
  type AcquisitionScoreInput,
  type AcquisitionScoreResult,
  type ScoringConfig,
  type SubScoreDetail,
} from "./acquisition-scorer";
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors from acquisition-scorer.ts. (Existing errors elsewhere are OK.)

**Step 4: Commit**

```bash
git add src/lib/scoring/acquisition-scorer.ts src/lib/scoring/index.ts
git commit -m "feat: 100-point acquisition scoring engine with disqualifier checks"
```

---

## Task 5: Score API — Replace with Acquisition Scorer

**Files:**
- Modify: `src/app/api/listings/[id]/score/route.ts`

**Step 1: Rewrite the score endpoint**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  scoreAcquisitionTarget,
  loadScoringConfig,
  type AcquisitionScoreInput,
} from "@/lib/scoring/acquisition-scorer";
import { computeFitScore, type FitScoreInput } from "@/lib/scoring/fit-score-engine";

/**
 * POST /api/listings/[id]/score
 * Compute both legacy fit score AND new acquisition score for a listing.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        opportunity: {
          include: {
            contacts: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const primaryContact = listing.opportunity?.contacts?.[0] ?? null;

    // Legacy fit score (backward compat)
    const fitInput: FitScoreInput = {
      primaryTrade: listing.primaryTrade,
      secondaryTrades: listing.secondaryTrades as string[],
      revenue: listing.revenue ? Number(listing.revenue) : null,
      established: listing.established,
      state: listing.state,
      metroArea: listing.metroArea,
      certifications: listing.certifications as string[],
      askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
      ebitda: listing.ebitda ? Number(listing.ebitda) : null,
      inferredEbitda: listing.inferredEbitda ? Number(listing.inferredEbitda) : null,
      targetMultipleLow: listing.targetMultipleLow,
      targetMultipleHigh: listing.targetMultipleHigh,
      estimatedAgeRange: primaryContact?.estimatedAgeRange ?? null,
      keyPersonRisk: listing.opportunity?.keyPersonRisk ?? null,
      recurringRevenuePct: listing.opportunity?.recurringRevenuePct ?? null,
    };

    const fitResult = computeFitScore(fitInput);

    // New acquisition score
    const config = await loadScoringConfig();
    const acqInput: AcquisitionScoreInput = {
      targetRank: listing.targetRank,
      ebitda: listing.ebitda ? Number(listing.ebitda) : (listing.inferredEbitda ? Number(listing.inferredEbitda) : null),
      revenue: listing.revenue ? Number(listing.revenue) : null,
      askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
      mrrPctOfRevenue: listing.mrrPctOfRevenue,
      revenueTrendDetail: listing.revenueTrendDetail,
      topClientPct: listing.topClientPct,
      clientIndustryOverlap: listing.clientIndustryOverlap,
      state: listing.state,
      city: listing.city,
      metroArea: listing.metroArea,
      ownerRetirementSignal: listing.ownerRetirementSignal,
      ownerIsPrimarySales: listing.ownerIsPrimarySales,
      technicalStaffCount: listing.technicalStaffCount,
      sbaEligible: listing.sbaEligible,
      ownerIsSoleTech: listing.ownerIsSoleTech,
      clientBaseType: listing.clientBaseType,
      hasActiveLitigation: listing.hasActiveLitigation,
      hasKeyManInsurance: listing.hasKeyManInsurance,
    };

    const acqResult = scoreAcquisitionTarget(acqInput, config);

    // Save both scores
    const previousScore = listing.compositeScore ?? listing.fitScore;
    const scoreChange = previousScore != null ? fitResult.fitScore - previousScore : 0;

    let thesisAlignment: string;
    let recommendedAction: string;
    if (fitResult.fitScore >= 75) { thesisAlignment = "strong"; recommendedAction = "pursue_immediately"; }
    else if (fitResult.fitScore >= 60) { thesisAlignment = "moderate"; recommendedAction = "research_further"; }
    else if (fitResult.fitScore >= 40) { thesisAlignment = "weak"; recommendedAction = "monitor"; }
    else { thesisAlignment = "disqualified"; recommendedAction = "pass"; }

    await prisma.listing.update({
      where: { id },
      data: {
        // Legacy
        fitScore: fitResult.fitScore,
        compositeScore: fitResult.fitScore,
        deterministicScore: fitResult.fitScore,
        thesisAlignment,
        recommendedAction,
        lastScoredAt: new Date(),
        scoreChange,
        // New acquisition
        acquisitionScore: acqResult.total,
        financialScore: acqResult.financialScore,
        strategicScore: acqResult.strategicScore,
        operatorScore: acqResult.operatorScore,
        acquisitionTier: acqResult.tier,
        acquisitionDisqualifiers: acqResult.disqualifiers,
      },
    });

    return NextResponse.json({
      // Legacy
      fitScore: fitResult.fitScore,
      compositeScore: fitResult.fitScore,
      thesisAlignment,
      recommendedAction,
      scoreChange,
      breakdown: fitResult.breakdown,
      // New
      acquisitionScore: acqResult.total,
      financialScore: acqResult.financialScore,
      strategicScore: acqResult.strategicScore,
      operatorScore: acqResult.operatorScore,
      acquisitionTier: acqResult.tier,
      disqualifiers: acqResult.disqualifiers,
      financialDetails: acqResult.financialDetails,
      strategicDetails: acqResult.strategicDetails,
      operatorDetails: acqResult.operatorDetails,
    });
  } catch (error) {
    console.error("Error computing score:", error);
    return NextResponse.json({ error: "Failed to compute score" }, { status: 500 });
  }
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "score/route" | head -10
```

Expected: No errors from this file (new Listing fields exist in schema after Task 1).

**Step 3: Commit**

```bash
git add src/app/api/listings/[id]/score/route.ts
git commit -m "feat: score endpoint now computes both legacy fit + acquisition rubric"
```

---

## Task 6: Rescore-All API Endpoint

**Files:**
- Create: `src/app/api/listings/rescore-all/route.ts`

**Step 1: Create the batch rescore endpoint**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  scoreAcquisitionTarget,
  loadScoringConfig,
  type AcquisitionScoreInput,
} from "@/lib/scoring/acquisition-scorer";

/**
 * POST /api/listings/rescore-all
 * Batch recompute acquisition scores for all active listings.
 * Used after config changes or data migration.
 */
export async function POST() {
  try {
    const config = await loadScoringConfig();

    const listings = await prisma.listing.findMany({
      where: { isActive: true },
      select: {
        id: true,
        targetRank: true,
        ebitda: true,
        inferredEbitda: true,
        revenue: true,
        askingPrice: true,
        mrrPctOfRevenue: true,
        revenueTrendDetail: true,
        topClientPct: true,
        clientIndustryOverlap: true,
        state: true,
        city: true,
        metroArea: true,
        ownerRetirementSignal: true,
        ownerIsPrimarySales: true,
        technicalStaffCount: true,
        sbaEligible: true,
        ownerIsSoleTech: true,
        clientBaseType: true,
        hasActiveLitigation: true,
        hasKeyManInsurance: true,
      },
    });

    let scored = 0;
    let disqualified = 0;
    const tierCounts: Record<string, number> = { A: 0, B: 0, C: 0, Inactive: 0 };

    for (const listing of listings) {
      const input: AcquisitionScoreInput = {
        targetRank: listing.targetRank,
        ebitda: listing.ebitda ? Number(listing.ebitda) : (listing.inferredEbitda ? Number(listing.inferredEbitda) : null),
        revenue: listing.revenue ? Number(listing.revenue) : null,
        askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
        mrrPctOfRevenue: listing.mrrPctOfRevenue,
        revenueTrendDetail: listing.revenueTrendDetail,
        topClientPct: listing.topClientPct,
        clientIndustryOverlap: listing.clientIndustryOverlap,
        state: listing.state,
        city: listing.city,
        metroArea: listing.metroArea,
        ownerRetirementSignal: listing.ownerRetirementSignal,
        ownerIsPrimarySales: listing.ownerIsPrimarySales,
        technicalStaffCount: listing.technicalStaffCount,
        sbaEligible: listing.sbaEligible,
        ownerIsSoleTech: listing.ownerIsSoleTech,
        clientBaseType: listing.clientBaseType,
        hasActiveLitigation: listing.hasActiveLitigation,
        hasKeyManInsurance: listing.hasKeyManInsurance,
      };

      const result = scoreAcquisitionTarget(input, config);

      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          acquisitionScore: result.total,
          financialScore: result.financialScore,
          strategicScore: result.strategicScore,
          operatorScore: result.operatorScore,
          acquisitionTier: result.tier,
          acquisitionDisqualifiers: result.disqualifiers,
        },
      });

      scored++;
      tierCounts[result.tier]++;
      if (result.disqualifiers.length > 0) disqualified++;
    }

    return NextResponse.json({
      scored,
      disqualified,
      tierCounts,
    });
  } catch (error) {
    console.error("Error rescoring all listings:", error);
    return NextResponse.json({ error: "Failed to rescore" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/listings/rescore-all/route.ts
git commit -m "feat: POST /api/listings/rescore-all batch scoring endpoint"
```

---

## Task 7: Acquisition Thesis Config API

**Files:**
- Create: `src/app/api/settings/acquisition-thesis/route.ts`

**Step 1: Create GET and PUT for thesis config**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/settings/acquisition-thesis
 * Returns all 4 rank configs.
 */
export async function GET() {
  try {
    const configs = await prisma.acquisitionThesisConfig.findMany({
      orderBy: { targetRank: "asc" },
    });
    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching thesis config:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * PUT /api/settings/acquisition-thesis
 * Update a single rank config. Body must include `targetRank` to identify which.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetRank, ...data } = body;

    if (!targetRank || typeof targetRank !== "number") {
      return NextResponse.json({ error: "targetRank required" }, { status: 400 });
    }

    const updated = await prisma.acquisitionThesisConfig.update({
      where: { targetRank },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating thesis config:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/settings/acquisition-thesis/route.ts
git commit -m "feat: GET/PUT /api/settings/acquisition-thesis CRUD endpoint"
```

---

## Task 8: Data Migration Script — Map Existing Deals

**Files:**
- Create: `scripts/migrate-acquisition-ranks.ts`

**Step 1: Write the migration script**

```typescript
/**
 * Migrate existing listings to the new acquisition ranking system.
 *
 * Maps:
 *   SECURITY_FIRE_ALARM → Rank 3 (Security Integration)
 *   STRUCTURED_CABLING  → Rank 4 (Structured Cabling)
 *   ELECTRICAL           → Rank 4 (Structured Cabling)
 *   Others               → null (unranked, kept in system)
 *
 * Then rescores every listing with the new acquisition rubric.
 *
 * Run: npx tsx scripts/migrate-acquisition-ranks.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TRADE_TO_RANK: Record<string, { rank: number; label: string }> = {
  SECURITY_FIRE_ALARM: { rank: 3, label: "Security Integration" },
  STRUCTURED_CABLING:  { rank: 4, label: "Structured Cabling" },
  ELECTRICAL:          { rank: 4, label: "Structured Cabling" },
};

async function main() {
  // Load scoring config
  const setting = await prisma.appSetting.findUnique({
    where: { key: "acquisition_scoring_config" },
  });
  if (!setting) {
    console.error("ERROR: Run seed-acquisition-config.ts first!");
    process.exit(1);
  }
  const config = JSON.parse(setting.value);

  const listings = await prisma.listing.findMany({
    where: { isActive: true },
  });

  console.log(`Found ${listings.length} active listings to migrate.\n`);

  let ranked = 0;
  let unranked = 0;
  const tierCounts: Record<string, number> = { A: 0, B: 0, C: 0, Inactive: 0 };

  for (const listing of listings) {
    const mapping = listing.primaryTrade ? TRADE_TO_RANK[listing.primaryTrade] : null;

    const targetRank = mapping?.rank ?? null;
    const targetRankLabel = mapping?.label ?? null;

    // Build score input from listing fields
    const ebitda = listing.ebitda ? Number(listing.ebitda) : (listing.inferredEbitda ? Number(listing.inferredEbitda) : null);
    const revenue = listing.revenue ? Number(listing.revenue) : null;

    // Inline scoring (we can't import from src in a script easily, so inline the logic)
    // For the migration, we just assign rank and set score to null — the rescore-all API will handle scoring
    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        targetRank,
        targetRankLabel,
      },
    });

    if (targetRank) {
      ranked++;
      console.log(`  ${listing.title?.substring(0, 50)} → Rank ${targetRank} (${targetRankLabel})`);
    } else {
      unranked++;
    }
  }

  console.log(`\nMigration complete:`);
  console.log(`  Ranked: ${ranked}`);
  console.log(`  Unranked: ${unranked}`);
  console.log(`\nNext step: Call POST /api/listings/rescore-all to score all listings with new rubric.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Step 2: Commit**

```bash
git add scripts/migrate-acquisition-ranks.ts
git commit -m "feat: migration script to map existing listings to acquisition ranks"
```

---

## Task 9: UI — Rank Badge Component

**Files:**
- Create: `src/components/listings/rank-badge.tsx`

**Step 1: Create the rank badge component**

```tsx
"use client";

const RANK_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", label: "MSP" },
  2: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300", label: "UCaaS" },
  3: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", label: "Security" },
  4: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", label: "Cabling" },
};

interface RankBadgeProps {
  rank: number | null;
  label?: string | null;
  size?: "sm" | "md";
}

export function RankBadge({ rank, label, size = "sm" }: RankBadgeProps) {
  if (!rank) return null;

  const config = RANK_COLORS[rank];
  if (!config) return null;

  const displayLabel = label ?? config.label;
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm";

  return (
    <span className={`inline-flex items-center rounded-md font-medium ${config.bg} ${config.text} ${sizeClasses}`}>
      {displayLabel}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/listings/rank-badge.tsx
git commit -m "ui: add RankBadge component for target type display"
```

---

## Task 10: UI — Acquisition Tier Badge Component

**Files:**
- Create: `src/components/listings/acquisition-tier-badge.tsx`

**Step 1: Create the tier badge**

```tsx
"use client";

const TIER_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", ring: "ring-yellow-500/30" },
  B: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", ring: "ring-green-500/30" },
  C: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-300", ring: "ring-orange-500/30" },
  Inactive: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400", ring: "ring-gray-500/30" },
};

interface AcquisitionTierBadgeProps {
  tier: string | null;
  score?: number | null;
  size?: "sm" | "md" | "lg";
}

export function AcquisitionTierBadge({ tier, score, size = "sm" }: AcquisitionTierBadgeProps) {
  if (!tier) return null;

  const style = TIER_STYLES[tier] ?? TIER_STYLES.Inactive;
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-sm",
    lg: "px-3 py-1.5 text-base font-bold",
  }[size];

  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold ring-1 ring-inset ${style.bg} ${style.text} ${style.ring} ${sizeClasses}`}>
      <span>{tier === "Inactive" ? "—" : tier}</span>
      {score !== null && score !== undefined && (
        <span className="font-normal opacity-75">{score}</span>
      )}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/listings/acquisition-tier-badge.tsx
git commit -m "ui: add AcquisitionTierBadge component"
```

---

## Task 11: UI — Score Breakdown Panel

**Files:**
- Create: `src/components/listings/acquisition-score-panel.tsx`

**Step 1: Create the score breakdown panel**

This component shows the 3 sub-scores as visual bars with detail tooltips. Used on the deal detail page.

```tsx
"use client";

import { RankBadge } from "./rank-badge";
import { AcquisitionTierBadge } from "./acquisition-tier-badge";

interface ScoreBarProps {
  label: string;
  score: number | null;
  max: number;
  color: string;
}

function ScoreBar({ label, score, max, color }: ScoreBarProps) {
  const pct = score !== null ? Math.min(100, (score / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score ?? 0}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface AcquisitionScorePanelProps {
  targetRank: number | null;
  targetRankLabel: string | null;
  acquisitionScore: number | null;
  financialScore: number | null;
  strategicScore: number | null;
  operatorScore: number | null;
  acquisitionTier: string | null;
  disqualifiers: string[];
}

export function AcquisitionScorePanel({
  targetRank,
  targetRankLabel,
  acquisitionScore,
  financialScore,
  strategicScore,
  operatorScore,
  acquisitionTier,
  disqualifiers,
}: AcquisitionScorePanelProps) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Acquisition Score</h3>
        <div className="flex items-center gap-2">
          <RankBadge rank={targetRank} label={targetRankLabel} size="md" />
          <AcquisitionTierBadge tier={acquisitionTier} score={acquisitionScore} size="md" />
        </div>
      </div>

      {disqualifiers.length > 0 && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 space-y-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">Disqualified</p>
          {disqualifiers.map((d, i) => (
            <p key={i} className="text-xs text-red-700 dark:text-red-400">- {d}</p>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <ScoreBar label="Financial" score={financialScore} max={40} color="bg-blue-500" />
        <ScoreBar label="Strategic" score={strategicScore} max={35} color="bg-purple-500" />
        <ScoreBar label="Operator Fit" score={operatorScore} max={25} color="bg-emerald-500" />
      </div>

      {acquisitionScore !== null && (
        <div className="pt-2 border-t flex items-center justify-between">
          <span className="text-sm font-medium">Total</span>
          <span className="text-2xl font-bold tabular-nums">
            {acquisitionScore}
            <span className="text-sm font-normal text-muted-foreground">/100</span>
          </span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/listings/acquisition-score-panel.tsx
git commit -m "ui: add AcquisitionScorePanel with sub-score bars"
```

---

## Task 12: UI — Add Badges to Listings Table

**Files:**
- Modify: `src/components/listings/listings-table.tsx`

**Step 1: Add imports for new badge components**

Add near the top imports:

```typescript
import { RankBadge } from "@/components/listings/rank-badge";
import { AcquisitionTierBadge } from "@/components/listings/acquisition-tier-badge";
```

**Step 2: Add Rank and Acquisition Tier columns**

Find the column definition area (near line 214 where `compositeScore` accessor is). Add two new columns right before the compositeScore column:

```typescript
    columnHelper.accessor("targetRank", {
      header: "Rank",
      cell: ({ row }) => (
        <RankBadge rank={row.original.targetRank} label={row.original.targetRankLabel} />
      ),
      size: 80,
    }),
    columnHelper.accessor("acquisitionTier", {
      header: "Tier",
      cell: ({ row }) => (
        <AcquisitionTierBadge
          tier={row.original.acquisitionTier}
          score={row.original.acquisitionScore}
        />
      ),
      size: 80,
    }),
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "listings-table" | head -5
```

Expected: No new errors.

**Step 4: Commit**

```bash
git add src/components/listings/listings-table.tsx
git commit -m "ui: add Rank and Tier columns to listings table"
```

---

## Task 13: UI — Add Badges to Pipeline Deal Header

**Files:**
- Modify: `src/components/pipeline/deal-header.tsx`

**Step 1: Add imports**

```typescript
import { RankBadge } from "@/components/listings/rank-badge";
import { AcquisitionTierBadge } from "@/components/listings/acquisition-tier-badge";
```

**Step 2: Add badges to the header display**

Find where the existing `TierBadge` and `FitScoreGauge` are rendered. Add the new badges adjacent to them (the exact insertion point depends on the JSX structure — find the spot where score/tier info is displayed and add):

```tsx
<RankBadge rank={listing?.targetRank} label={listing?.targetRankLabel} />
<AcquisitionTierBadge tier={listing?.acquisitionTier} score={listing?.acquisitionScore} />
```

**Step 3: Commit**

```bash
git add src/components/pipeline/deal-header.tsx
git commit -m "ui: add rank and acquisition tier badges to deal header"
```

---

## Task 14: UI — Add Score Panel to Deal Detail Page

**Files:**
- Modify: `src/app/(dashboard)/listings/[id]/page.tsx`

**Step 1: Add import**

```typescript
import { AcquisitionScorePanel } from "@/components/listings/acquisition-score-panel";
```

**Step 2: Add the panel to the detail page**

Find the appropriate location in the detail page JSX (likely near the existing score display section) and add:

```tsx
<AcquisitionScorePanel
  targetRank={listing.targetRank}
  targetRankLabel={listing.targetRankLabel}
  acquisitionScore={listing.acquisitionScore}
  financialScore={listing.financialScore}
  strategicScore={listing.strategicScore}
  operatorScore={listing.operatorScore}
  acquisitionTier={listing.acquisitionTier}
  disqualifiers={listing.acquisitionDisqualifiers ?? []}
/>
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/listings/[id]/page.tsx
git commit -m "ui: add AcquisitionScorePanel to deal detail page"
```

---

## Task 15: UI — Thesis Config in Settings

**Files:**
- Modify: `src/app/(dashboard)/settings/thesis/page.tsx`

**Step 1: Add a "Target Types" section**

Below the existing thesis settings form, add a new section that displays the 4 rank configurations. This section should:
- Fetch from `GET /api/settings/acquisition-thesis`
- Display a card for each rank with key fields (label, revenue range, EBITDA range, multipleLow-High, SIC codes)
- Allow inline editing of thresholds
- Save via `PUT /api/settings/acquisition-thesis`

The exact implementation will be adapted to the existing page's pattern (it uses React Query hooks). Add a new hook in the appropriate hooks file and a new section at the bottom of the page.

**Step 2: Commit**

```bash
git add src/app/(dashboard)/settings/thesis/page.tsx
git commit -m "ui: add target type thesis configuration section to settings"
```

---

## Task 16: Deploy and Run Migration

**Step 1: Verify local build**

```bash
cd ~/dealflow && npm run build
```

Expected: Build succeeds.

**Step 2: Push to GitHub (triggers Railway deploy)**

```bash
git push origin main
```

**Step 3: Run seed script on production**

After Railway deploy completes, run via Railway CLI or the app's admin seed route:

```bash
# Option A: Railway CLI
railway run npx tsx scripts/seed-acquisition-config.ts

# Option B: If Railway CLI not available, add a temporary admin route
# POST /api/admin/seed-acquisition
```

**Step 4: Run migration script on production**

```bash
railway run npx tsx scripts/migrate-acquisition-ranks.ts
```

**Step 5: Trigger rescore-all**

```bash
curl -X POST https://[dealflow-url]/api/listings/rescore-all
```

Expected: All listings rescored with new rubric. Response shows tier distribution.

**Step 6: Verify in browser**

Open DealFlow in browser. Verify:
- Listings table shows Rank and Tier columns
- Deal detail pages show acquisition score panel
- Pipeline cards show rank/tier badges
- Settings > Thesis shows target type configuration

---

*Layer 1 Implementation Plan — 16 tasks, ~2-3 hours estimated implementation time*
*Design doc: `docs/plans/2026-04-07-companion-acquisition-upgrade-design.md`*
