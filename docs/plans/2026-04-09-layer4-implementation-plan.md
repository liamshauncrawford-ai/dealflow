# Layer 4: Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add browser-assisted marketplace search with saved search profiles, scheduled/on-demand scanning, and a Discovery Queue for reviewing and importing scraped listings.

**Architecture:** Extends existing scraping infrastructure (BaseScraper, browser-scraper, PostProcessor). Two new Prisma models (SearchProfile, DiscoveryListing) stage results before pipeline import. New `/discovery` page with profile management and queue review UI. Scraper fixes ensure filters pass through to browser-based marketplace searches.

**Tech Stack:** Next.js 16, Prisma, Playwright/CDP, TanStack Table, react-hook-form + Zod, Tailwind CSS, lucide-react icons

---

### Task 1: Prisma Schema — New Models + Relations

**Files:**
- Modify: `prisma/schema.prisma` (lines 174, 852-874, 1687-end)

**Step 1: Add DiscoveryStatus enum after ScrapeStatus enum (line ~883)**

After the `ScrapeStatus` enum block (ends around line 882), add:

```prisma
enum DiscoveryStatus {
  NEW
  ACCEPTED
  REJECTED
  EXPIRED
}
```

**Step 2: Add SearchProfile model after ScrapeSchedule (line ~895)**

After the `ScrapeSchedule` model closing brace, add:

```prisma
// ─────────────────────────────────────────────
// DISCOVERY
// ─────────────────────────────────────────────

model SearchProfile {
  id             String     @id @default(cuid())
  name           String
  platforms      Platform[]
  filters        Json       // ScraperFilters shape
  cronExpression String?
  isEnabled      Boolean    @default(true)
  lastRunAt      DateTime?
  nextRunAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  discoveryListings DiscoveryListing[]
  scrapeRuns        ScrapeRun[]
}

model DiscoveryListing {
  id              String          @id @default(cuid())
  searchProfileId String
  searchProfile   SearchProfile   @relation(fields: [searchProfileId], references: [id], onDelete: Cascade)

  title       String
  businessName String?
  askingPrice Decimal?  @db.Decimal(14, 2)
  revenue     Decimal?  @db.Decimal(14, 2)
  cashFlow    Decimal?  @db.Decimal(14, 2)
  ebitda      Decimal?  @db.Decimal(14, 2)
  industry    String?
  city        String?
  state       String?
  sourceUrl   String    @unique
  platform    Platform
  brokerName  String?
  brokerCompany String?
  description String?   @db.Text
  rawData     Json?

  status      DiscoveryStatus @default(NEW)
  discoveredAt DateTime       @default(now())
  reviewedAt  DateTime?
  listingId   String?
  listing     Listing?        @relation(fields: [listingId], references: [id])

  @@index([status])
  @@index([searchProfileId])
  @@index([discoveredAt])
  @@index([platform])
}
```

**Step 3: Add relation to ScrapeRun model (line ~853)**

In the `ScrapeRun` model, add after `triggeredBy String`:

```prisma
  searchProfileId String?
  searchProfile   SearchProfile? @relation(fields: [searchProfileId], references: [id])
```

**Step 4: Add relation to Listing model (line ~174)**

In the `Listing` model relations block, after `priorityAPackage  PriorityAPackage?`, add:

```prisma
  discoveryListings DiscoveryListing[]
```

**Step 5: Run Prisma migration**

```bash
cd ~/dealflow && npx prisma db push
```

**Step 6: Generate Prisma client**

```bash
npx prisma generate
```

**Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add SearchProfile and DiscoveryListing models for Layer 4 Discovery"
```

---

### Task 2: Search Profile API Routes

**Files:**
- Create: `src/app/api/discovery/profiles/route.ts`
- Create: `src/app/api/discovery/profiles/[id]/route.ts`
- Create: `src/app/api/discovery/profiles/[id]/run/route.ts`

**Step 1: Create profiles list + create endpoint**

Create `src/app/api/discovery/profiles/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ScraperFilters } from "@/lib/scrapers/base-scraper";

// GET /api/discovery/profiles — list all profiles with stats
export async function GET() {
  try {
    const profiles = await prisma.searchProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            discoveryListings: { where: { status: "NEW" } },
          },
        },
        scrapeRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, listingsFound: true, completedAt: true },
        },
      },
    });

    const result = profiles.map((p) => ({
      ...p,
      newCount: p._count.discoveryListings,
      lastRun: p.scrapeRuns[0] ?? null,
      _count: undefined,
      scrapeRuns: undefined,
    }));

    return NextResponse.json({ profiles: result });
  } catch (error) {
    console.error("Error fetching search profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch search profiles" },
      { status: 500 },
    );
  }
}

// POST /api/discovery/profiles — create a new profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, platforms, filters, cronExpression, isEnabled } = body;

    if (!name || !platforms?.length) {
      return NextResponse.json(
        { error: "name and platforms are required" },
        { status: 400 },
      );
    }

    // Compute nextRunAt from cronExpression if provided
    let nextRunAt: Date | null = null;
    if (cronExpression) {
      nextRunAt = computeNextRun(cronExpression);
    }

    const profile = await prisma.searchProfile.create({
      data: {
        name,
        platforms,
        filters: (filters ?? {}) as ScraperFilters,
        cronExpression: cronExpression ?? null,
        isEnabled: isEnabled ?? true,
        nextRunAt,
      },
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("Error creating search profile:", error);
    return NextResponse.json(
      { error: "Failed to create search profile" },
      { status: 500 },
    );
  }
}

/**
 * Compute the next run time from a cron expression.
 * Simple implementation: parses basic cron and returns next occurrence.
 * For MVP, defaults to tomorrow at the specified hour.
 */
function computeNextRun(cron: string): Date {
  const parts = cron.split(" ");
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 6;

  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(hour, minute, 0, 0);
  return next;
}
```

**Step 2: Create single-profile CRUD endpoint**

Create `src/app/api/discovery/profiles/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/discovery/profiles/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const profile = await prisma.searchProfile.findUnique({
      where: { id },
      include: {
        _count: { select: { discoveryListings: true } },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 },
    );
  }
}

// PUT /api/discovery/profiles/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, platforms, filters, cronExpression, isEnabled } = body;

    const profile = await prisma.searchProfile.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(platforms !== undefined && { platforms }),
        ...(filters !== undefined && { filters }),
        ...(cronExpression !== undefined && { cronExpression }),
        ...(isEnabled !== undefined && { isEnabled }),
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}

// DELETE /api/discovery/profiles/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.searchProfile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return NextResponse.json(
      { error: "Failed to delete profile" },
      { status: 500 },
    );
  }
}
```

**Step 3: Create on-demand run trigger endpoint**

Create `src/app/api/discovery/profiles/[id]/run/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSearchProfile } from "@/lib/discovery/runner";

// POST /api/discovery/profiles/[id]/run — trigger on-demand scan
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const profile = await prisma.searchProfile.findUnique({ where: { id } });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Run async — don't block the response
    const result = await runSearchProfile(profile);

    return NextResponse.json({
      success: true,
      newDiscoveries: result.newCount,
      skippedDuplicates: result.skippedCount,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Error running search profile:", error);
    return NextResponse.json(
      { error: "Failed to run search profile" },
      { status: 500 },
    );
  }
}
```

**Step 4: Commit**

```bash
git add src/app/api/discovery/
git commit -m "feat: add search profile CRUD and run trigger API routes"
```

---

### Task 3: Discovery Runner — Core Execution Engine

**Files:**
- Create: `src/lib/discovery/runner.ts`

**Step 1: Create the discovery runner**

This is the core orchestration module. It takes a SearchProfile, runs scrapers for each platform, deduplicates results, and inserts new DiscoveryListing records.

Create `src/lib/discovery/runner.ts`:

```typescript
import { Platform, SearchProfile } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ScraperRegistry } from "@/lib/scrapers/scraper-registry";
import { browserScrape } from "@/lib/scrapers/browser-scraper";
import type { RawListing, ScraperFilters } from "@/lib/scrapers/base-scraper";

interface RunResult {
  newCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Execute a search profile: scrape each platform, dedup, insert discoveries.
 */
export async function runSearchProfile(profile: SearchProfile): Promise<RunResult> {
  const filters = profile.filters as ScraperFilters;
  const errors: string[] = [];
  let newCount = 0;
  let skippedCount = 0;

  for (const platform of profile.platforms) {
    try {
      // Create a ScrapeRun linked to this profile
      const scrapeRun = await prisma.scrapeRun.create({
        data: {
          platform,
          triggeredBy: "discovery",
          status: "RUNNING",
          startedAt: new Date(),
          searchProfileId: profile.id,
        },
      });

      // Use browser scraper (handles CDP → Playwright fallback)
      await browserScrape(platform, scrapeRun.id, filters);

      // Re-read the scrape run to get results
      const completedRun = await prisma.scrapeRun.findUnique({
        where: { id: scrapeRun.id },
      });

      if (completedRun?.status === "FAILED") {
        errors.push(`${platform}: scrape failed — ${completedRun.errorLog}`);
        continue;
      }

      // The browser scraper already called processScrapedListings which creates
      // Listings directly. For discovery, we need a different flow: instead of
      // auto-importing, we want to stage results in DiscoveryListing.
      //
      // Approach: after browser scrape completes, read any newly created listings
      // from this run and move them to discovery staging.
      //
      // BUT — the browser scraper calls processScrapedListings internally.
      // We need to intercept at a different layer. Let's use the HTTP scraper
      // approach instead for discovery, which gives us RawListing[] without
      // auto-importing.
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${platform}: ${msg}`);
    }
  }

  // Update profile run tracking
  await prisma.searchProfile.update({
    where: { id: profile.id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: profile.cronExpression
        ? computeNextRun(profile.cronExpression)
        : null,
    },
  });

  return { newCount, skippedCount, errors };
}

/**
 * Scrape a platform and return raw listings WITHOUT auto-importing.
 * Uses the Cheerio-based scraper (HTTP fetch) which returns RawListing[]
 * without calling PostProcessor.
 */
export async function scrapeForDiscovery(
  platform: Platform,
  filters: ScraperFilters,
): Promise<{ listings: RawListing[]; errors: string[] }> {
  const scraper = ScraperRegistry.get(platform);
  if (!scraper) {
    return { listings: [], errors: [`No scraper for ${platform}`] };
  }

  const result = await scraper.scrape(filters);
  return { listings: result.listings, errors: result.errors };
}

/**
 * Stage raw listings as DiscoveryListing records, deduplicating
 * against existing discoveries and pipeline listings.
 */
export async function stageDiscoveryListings(
  profileId: string,
  platform: Platform,
  rawListings: RawListing[],
): Promise<{ newCount: number; skippedCount: number }> {
  let newCount = 0;
  let skippedCount = 0;

  for (const raw of rawListings) {
    if (!raw.sourceUrl) {
      skippedCount++;
      continue;
    }

    // Check if already in discovery queue
    const existingDiscovery = await prisma.discoveryListing.findUnique({
      where: { sourceUrl: raw.sourceUrl },
    });
    if (existingDiscovery) {
      skippedCount++;
      continue;
    }

    // Check if already imported to pipeline
    const existingSource = await prisma.listingSource.findUnique({
      where: { sourceUrl: raw.sourceUrl },
    });
    if (existingSource) {
      skippedCount++;
      continue;
    }

    // Insert as new discovery
    await prisma.discoveryListing.create({
      data: {
        searchProfileId: profileId,
        title: raw.title,
        businessName: raw.businessName ?? null,
        askingPrice: raw.askingPrice,
        revenue: raw.revenue,
        cashFlow: raw.cashFlow,
        ebitda: raw.ebitda,
        industry: raw.industry,
        city: raw.city,
        state: raw.state,
        sourceUrl: raw.sourceUrl,
        platform,
        brokerName: raw.brokerName,
        brokerCompany: raw.brokerCompany,
        description: raw.description,
        rawData: raw as unknown as Record<string, unknown>,
        status: "NEW",
      },
    });

    newCount++;
  }

  return { newCount, skippedCount };
}

function computeNextRun(cron: string): Date {
  const parts = cron.split(" ");
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 6;

  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(hour, minute, 0, 0);
  return next;
}
```

**Step 2: Commit**

```bash
git add src/lib/discovery/
git commit -m "feat: add discovery runner with dedup staging pipeline"
```

---

### Task 4: Refactor Runner to Bypass PostProcessor

**Files:**
- Modify: `src/lib/discovery/runner.ts`

The browser scraper (`browserScrape()`) calls `processScrapedListings()` internally, which auto-imports to the Listing table. For discovery, we need raw results without auto-import.

**Step 1: Update `runSearchProfile` to use scraper directly**

Replace the `runSearchProfile` function body's platform loop to use `scrapeForDiscovery` + `stageDiscoveryListings` instead of `browserScrape`:

```typescript
export async function runSearchProfile(profile: SearchProfile): Promise<RunResult> {
  const filters = profile.filters as ScraperFilters;
  const errors: string[] = [];
  let newCount = 0;
  let skippedCount = 0;

  for (const platform of profile.platforms) {
    try {
      // Create a ScrapeRun linked to this profile
      const scrapeRun = await prisma.scrapeRun.create({
        data: {
          platform,
          triggeredBy: "discovery",
          status: "RUNNING",
          startedAt: new Date(),
          searchProfileId: profile.id,
        },
      });

      // Scrape without auto-importing
      const { listings, errors: scrapeErrors } = await scrapeForDiscovery(platform, filters);
      errors.push(...scrapeErrors);

      // Stage results in discovery queue
      const staged = await stageDiscoveryListings(profile.id, platform, listings);
      newCount += staged.newCount;
      skippedCount += staged.skippedCount;

      // Update scrape run
      await prisma.scrapeRun.update({
        where: { id: scrapeRun.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          listingsFound: listings.length,
          listingsNew: staged.newCount,
          errors: scrapeErrors.length,
          errorLog: scrapeErrors.length > 0 ? scrapeErrors.join("\n") : null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${platform}: ${msg}`);
    }
  }

  // Update profile run tracking
  await prisma.searchProfile.update({
    where: { id: profile.id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: profile.cronExpression
        ? computeNextRun(profile.cronExpression)
        : null,
    },
  });

  return { newCount, skippedCount, errors };
}
```

**Important:** The `scrapeForDiscovery` function uses `BaseScraper.scrape()` which creates its own ScrapeRun internally. We need to either:
- (a) Remove the duplicate ScrapeRun creation in `scrapeForDiscovery`, or
- (b) Accept the double ScrapeRun and link the profile to the one we create

For MVP, use approach (b) — `BaseScraper.scrape()` creates a platform-level run, we create a profile-linked run separately. Clean up in a later iteration.

**Step 2: Commit**

```bash
git add src/lib/discovery/runner.ts
git commit -m "refactor: discovery runner uses scrapeForDiscovery to bypass auto-import"
```

---

### Task 5: Discovery Queue API Routes

**Files:**
- Create: `src/app/api/discovery/queue/route.ts`
- Create: `src/app/api/discovery/queue/[id]/accept/route.ts`
- Create: `src/app/api/discovery/queue/[id]/reject/route.ts`
- Create: `src/app/api/discovery/queue/bulk/route.ts`

**Step 1: Create queue listing endpoint**

Create `src/app/api/discovery/queue/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DiscoveryStatus, Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "25"));
    const status = searchParams.get("status") as DiscoveryStatus | null;
    const profileId = searchParams.get("profileId");
    const platform = searchParams.get("platform");

    const where: Prisma.DiscoveryListingWhereInput = {};
    if (status) where.status = status;
    if (profileId) where.searchProfileId = profileId;
    if (platform) where.platform = platform as Prisma.EnumPlatformFilter["equals"];

    const [items, total] = await Promise.all([
      prisma.discoveryListing.findMany({
        where,
        orderBy: { discoveredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          searchProfile: { select: { name: true } },
        },
      }),
      prisma.discoveryListing.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching discovery queue:", error);
    return NextResponse.json(
      { error: "Failed to fetch discovery queue" },
      { status: 500 },
    );
  }
}
```

**Step 2: Create accept endpoint with detail enrichment**

Create `src/app/api/discovery/queue/[id]/accept/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ScraperRegistry } from "@/lib/scrapers/scraper-registry";
import { processScrapedListings } from "@/lib/scrapers/post-processor";
import type { RawListing } from "@/lib/scrapers/base-scraper";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const discovery = await prisma.discoveryListing.findUnique({ where: { id } });

    if (!discovery) {
      return NextResponse.json({ error: "Discovery listing not found" }, { status: 404 });
    }
    if (discovery.status !== "NEW") {
      return NextResponse.json(
        { error: `Cannot accept listing with status ${discovery.status}` },
        { status: 400 },
      );
    }

    // Step 1: Attempt detail page enrichment via Cheerio HTTP scraper
    let enrichedRaw: RawListing;
    try {
      const scraper = ScraperRegistry.get(discovery.platform);
      if (scraper) {
        const html = await scraper.fetchSinglePage(discovery.sourceUrl);
        enrichedRaw = await scraper.parseDetailPage(html, discovery.sourceUrl);
      } else {
        enrichedRaw = buildRawFromDiscovery(discovery);
      }
    } catch {
      // Enrichment failed (bot detection, 403, etc.) — use existing thin data
      console.warn(`[DISCOVERY] Detail enrichment failed for ${discovery.sourceUrl}, using existing data`);
      enrichedRaw = buildRawFromDiscovery(discovery);
    }

    // Step 2: Import via PostProcessor (creates Listing + ListingSource + inference)
    const result = await processScrapedListings({
      platform: discovery.platform,
      listings: [enrichedRaw],
      errors: [],
      startedAt: new Date(),
      completedAt: new Date(),
    });

    // Step 3: Find the newly created listing by sourceUrl
    const source = await prisma.listingSource.findUnique({
      where: { sourceUrl: discovery.sourceUrl },
      select: { listingId: true },
    });

    // Step 4: Update discovery listing status
    await prisma.discoveryListing.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        reviewedAt: new Date(),
        listingId: source?.listingId ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      listingId: source?.listingId,
      enriched: result.newCount > 0,
    });
  } catch (error) {
    console.error("Error accepting discovery listing:", error);
    return NextResponse.json(
      { error: "Failed to accept discovery listing" },
      { status: 500 },
    );
  }
}

function buildRawFromDiscovery(d: {
  title: string;
  businessName: string | null;
  askingPrice: unknown;
  revenue: unknown;
  cashFlow: unknown;
  ebitda: unknown;
  industry: string | null;
  city: string | null;
  state: string | null;
  sourceUrl: string;
  platform: string;
  brokerName: string | null;
  brokerCompany: string | null;
  description: string | null;
  rawData: unknown;
}): RawListing {
  return {
    sourceId: null,
    sourceUrl: d.sourceUrl,
    title: d.title,
    businessName: d.businessName,
    askingPrice: d.askingPrice ? Number(d.askingPrice) : null,
    revenue: d.revenue ? Number(d.revenue) : null,
    cashFlow: d.cashFlow ? Number(d.cashFlow) : null,
    ebitda: d.ebitda ? Number(d.ebitda) : null,
    sde: null,
    industry: d.industry,
    category: null,
    city: d.city,
    state: d.state,
    zipCode: null,
    description: d.description,
    brokerName: d.brokerName,
    brokerCompany: d.brokerCompany,
    brokerPhone: null,
    brokerEmail: null,
    employees: null,
    established: null,
    sellerFinancing: null,
    inventory: null,
    ffe: null,
    realEstate: null,
    reasonForSale: null,
    facilities: null,
    listingDate: null,
    rawData: (d.rawData as Record<string, unknown>) ?? {},
  };
}
```

**Step 3: Create reject endpoint**

Create `src/app/api/discovery/queue/[id]/reject/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    await prisma.discoveryListing.update({
      where: { id },
      data: { status: "REJECTED", reviewedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting discovery listing:", error);
    return NextResponse.json(
      { error: "Failed to reject discovery listing" },
      { status: 500 },
    );
  }
}
```

**Step 4: Create bulk action endpoint**

Create `src/app/api/discovery/queue/bulk/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { ids, action } = await request.json();

    if (!ids?.length || !["accept", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "ids[] and action (accept|reject) required" },
        { status: 400 },
      );
    }

    if (action === "reject") {
      await prisma.discoveryListing.updateMany({
        where: { id: { in: ids }, status: "NEW" },
        data: { status: "REJECTED", reviewedAt: new Date() },
      });
      return NextResponse.json({ success: true, count: ids.length });
    }

    // For bulk accept, process each individually (needs enrichment per listing)
    let accepted = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/discovery/queue/${id}/accept`,
          { method: "POST" },
        );
        if (res.ok) accepted++;
        else errors.push(`${id}: ${(await res.json()).error}`);
      } catch (err) {
        errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({ success: true, accepted, errors });
  } catch (error) {
    console.error("Error in bulk action:", error);
    return NextResponse.json(
      { error: "Failed to process bulk action" },
      { status: 500 },
    );
  }
}
```

**Step 5: Commit**

```bash
git add src/app/api/discovery/queue/
git commit -m "feat: add discovery queue API routes with accept/reject/bulk actions"
```

---

### Task 6: Cron Endpoint for Scheduled Discovery Scans

**Files:**
- Create: `src/app/api/cron/discovery-scan/route.ts`

**Step 1: Create the cron endpoint**

Create `src/app/api/cron/discovery-scan/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSearchProfile } from "@/lib/discovery/runner";

export async function POST(request: NextRequest) {
  try {
    // Auth: require CRON_SECRET header or valid session
    const cronSecret = request.headers.get("x-cron-secret");
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all enabled profiles due for a run
    const now = new Date();
    const dueProfiles = await prisma.searchProfile.findMany({
      where: {
        isEnabled: true,
        cronExpression: { not: null },
        OR: [
          { nextRunAt: { lte: now } },
          { nextRunAt: null, lastRunAt: null }, // Never run before
        ],
      },
    });

    if (dueProfiles.length === 0) {
      return NextResponse.json({ message: "No profiles due for scan", ran: 0 });
    }

    const results = [];
    for (const profile of dueProfiles) {
      const result = await runSearchProfile(profile);
      results.push({
        profileId: profile.id,
        name: profile.name,
        ...result,
      });
    }

    // Also expire old discovery listings (> 30 days, still NEW)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expired = await prisma.discoveryListing.updateMany({
      where: {
        status: "NEW",
        discoveredAt: { lt: thirtyDaysAgo },
      },
      data: { status: "EXPIRED" },
    });

    return NextResponse.json({
      ran: results.length,
      results,
      expired: expired.count,
    });
  } catch (error) {
    console.error("Error in discovery scan cron:", error);
    return NextResponse.json(
      { error: "Discovery scan failed" },
      { status: 500 },
    );
  }
}
```

**Step 2: Register in ALLOWED_ENDPOINTS**

In `src/app/api/agents/trigger/route.ts`, add `/api/cron/discovery-scan` to the ALLOWED_ENDPOINTS array.

**Step 3: Commit**

```bash
git add src/app/api/cron/discovery-scan/ src/app/api/agents/trigger/route.ts
git commit -m "feat: add discovery-scan cron endpoint with 30-day expiration"
```

---

### Task 7: Fix Browser Scraper Filter Passthrough

**Files:**
- Modify: `src/lib/scrapers/browser-scraper.ts` (lines 297, 461, 501)

**Step 1: Fix BizBuySell URL to use keyword/price filters**

In `browser-scraper.ts`, find the `scrapeBizBuySell` function (line ~297). Replace the hardcoded URL construction:

```typescript
// OLD (line ~296-297):
// Correct URL pattern: /colorado-businesses-for-sale/
let currentUrl: string | null = `https://www.bizbuysell.com/${state}-businesses-for-sale/`;
```

With:

```typescript
// Use the Cheerio scraper's URL builder to include all filters
const parser = new BizBuySellScraper();
let currentUrl: string | null = parser.buildSearchUrl(filters);
```

And remove the duplicate `state` variable computation above it (lines ~294-296) since `buildSearchUrl` handles it.

**Step 2: Fix BizQuest URL to use filters**

In `scrapeBizQuest` function (line ~461), replace:

```typescript
const searchUrl = `https://www.bizquest.com/businesses-for-sale/colorado/`;
```

With:

```typescript
const { BizQuestScraper } = await import("./bizquest");
const searchUrl = new BizQuestScraper().buildSearchUrl(filters);
```

**Step 3: Fix BusinessBroker URL to use filters**

In `scrapeBusinessBroker` function (line ~501), replace:

```typescript
const searchUrl = `https://www.businessbroker.net/businesses-for-sale/colorado`;
```

With:

```typescript
const { BusinessBrokerScraper } = await import("./businessbroker");
const searchUrl = new BusinessBrokerScraper().buildSearchUrl(filters);
```

**Step 4: Verify build compiles**

```bash
cd ~/dealflow && npx next build 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add src/lib/scrapers/browser-scraper.ts
git commit -m "fix: browser scraper now passes search filters to marketplace URLs"
```

---

### Task 8: Sidebar Navigation

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (line 34-39)

**Step 1: Add Search icon import**

At line 22, in the lucide-react import block, add `Search`:

```typescript
import {
  LayoutDashboard,
  Kanban,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Building2,
  Map,
  BarChart3,
  TrendingUp,
  Calculator,
  Layers,
  GitCompare,
  Bot,
  Search,
} from "lucide-react";
```

**Step 2: Add Discovery nav item**

In `mainNavItems` array (line 34-39), add Discovery after Pipeline:

```typescript
const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Target Businesses", href: "/listings", icon: Building2 },
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  { label: "Discovery", href: "/discovery", icon: Search },
  { label: "Contacts", href: "/contacts", icon: Users },
];
```

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Discovery to sidebar navigation"
```

---

### Task 9: Discovery Page — Search Profiles UI

**Files:**
- Create: `src/app/(dashboard)/discovery/page.tsx`

**Step 1: Create the discovery page**

Create `src/app/(dashboard)/discovery/page.tsx` with the search profiles section and discovery queue section. This is a large UI file — implement the full page with:

- Top section: Search Profiles as cards with Run Now / Edit / Delete / Toggle
- Create Profile modal using existing Dialog component
- Bottom section: Discovery Queue table
- Accept/Reject buttons per row
- Bulk actions toolbar
- Filter bar (status, profile, platform)

Use the existing component patterns from the codebase:
- `@/components/ui/card` for profile cards
- `@/components/ui/button` for actions
- `@/components/ui/badge` for platform/status badges
- `@/components/ui/input` and `@/components/ui/select` for form fields
- `@/components/dialog` for the create profile modal
- Format currency with `Intl.NumberFormat` (pattern used in listings-table.tsx)

The page should be a client component (`"use client"`) that:
1. Fetches profiles from `GET /api/discovery/profiles` on mount
2. Fetches queue items from `GET /api/discovery/queue?status=NEW` on mount
3. Handles create/edit/delete profile via the API routes
4. Handles accept/reject/bulk via the queue API routes
5. Refreshes both sections after mutations

**Key UI details:**
- Profile cards show: name, platform badges (colored by marketplace), filter summary text, cron schedule in human-readable format, last run relative time, count of NEW discoveries
- Queue table columns: checkbox (for bulk), Title (external link to sourceUrl), Asking Price, Cash Flow, City/State, Platform badge, Profile name, Discovered (relative date), Actions (Accept ✓ / Reject ✗)
- Empty state for queue: "No new discoveries yet. Create a search profile and run your first scan."

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/discovery/
git commit -m "feat: add Discovery page with search profiles and discovery queue UI"
```

---

### Task 10: Build Verification + Deploy

**Step 1: Generate Prisma client (in case schema changed)**

```bash
cd ~/dealflow && npx prisma generate
```

**Step 2: Run the build**

```bash
npx next build 2>&1 | tail -30
```

Expected: All pages build successfully including new `/discovery` route.

**Step 3: Run tests**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: All existing tests pass (18 tests).

**Step 4: Test locally**

```bash
npm run dev
```

Navigate to `http://localhost:3000/discovery` and verify:
- Page loads without errors
- "Create Search Profile" button opens modal
- Form submits and creates a profile
- "Run Now" triggers a scrape (may fail if no browser/CDP — that's OK)
- Discovery queue renders (empty initially)

**Step 5: Push to deploy**

```bash
git push origin main
```

Railway auto-deploys from main. Monitor the build at Railway dashboard.

**Step 6: Commit any final fixes**

If build fails or tests break, fix and commit:

```bash
git add -A && git commit -m "fix: resolve Layer 4 build issues"
git push origin main
```
