# Layer 4: Discovery — Browser-Assisted Marketplace Search

**Date:** 2026-04-09
**Status:** Approved
**Approach:** Extend existing scraping infrastructure (Approach A)

## Summary

Layer 4 adds automated deal sourcing to DealFlow. Users create **Search Profiles** with filters (state, price range, keywords, industry) targeting BizBuySell, BizQuest, and BusinessBroker.net. Profiles run on a cron schedule or on-demand. Scraped results land in a **Discovery Queue** for manual review — accept to import into the pipeline, reject to dismiss.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary focus | Browser-assisted marketplace search | Highest-leverage feature — turns DealFlow from deal management into deal sourcing |
| Trigger model | Scheduled + on-demand hybrid | Saved search profiles run on cron; "Run Now" button for ad-hoc searches |
| Processing | Light touch — Discovery Queue | New listings stage for manual review before pipeline import; user stays in control |
| Marketplaces | BizBuySell, BizQuest, BusinessBroker.net | Maximum coverage across the three largest general-purpose marketplaces |

## Data Models

### SearchProfile

Saved, reusable search configuration with per-profile filters and scheduling.

```prisma
model SearchProfile {
  id              String     @id @default(cuid())
  name            String                          // "Colorado MSPs $1-3M"
  platforms       Platform[]                      // [BIZBUYSELL, BIZQUEST, BUSINESSBROKER]
  filters         Json                            // ScraperFilters: {state, minPrice, maxPrice, keyword, ...}
  cronExpression  String?                         // "0 6 * * 1" (6am Mondays), null = on-demand only
  isEnabled       Boolean    @default(true)
  lastRunAt       DateTime?
  nextRunAt       DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  discoveryListings DiscoveryListing[]
  scrapeRuns        ScrapeRun[]
}
```

### DiscoveryListing

Staging table for scraped results awaiting review. Lightweight — holds a snapshot of scraped data before it becomes a full Listing.

```prisma
model DiscoveryListing {
  id              String          @id @default(cuid())
  searchProfileId String
  searchProfile   SearchProfile   @relation(fields: [searchProfileId], references: [id])

  // Snapshot of scraped data
  title           String
  businessName    String?
  askingPrice     Decimal?
  revenue         Decimal?
  cashFlow        Decimal?
  ebitda          Decimal?
  industry        String?
  city            String?
  state           String?
  sourceUrl       String          @unique         // Dedup key
  platform        Platform
  brokerName      String?
  brokerCompany   String?
  description     String?         @db.Text
  rawData         Json?                           // Full RawListing snapshot

  // Queue management
  status          DiscoveryStatus @default(NEW)
  discoveredAt    DateTime        @default(now())
  reviewedAt      DateTime?
  listingId       String?                         // Set on accept
  listing         Listing?        @relation(fields: [listingId], references: [id])

  @@index([status])
  @@index([searchProfileId])
  @@index([discoveredAt])
}

enum DiscoveryStatus {
  NEW
  ACCEPTED
  REJECTED
  EXPIRED
}
```

### Existing Model Changes

- `Listing`: Add `discoveryListings DiscoveryListing[]` relation
- `ScrapeRun`: Add optional `searchProfileId String?` + relation to `SearchProfile`

## API Routes

### Search Profile CRUD

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/discovery/profiles` | List all search profiles with last run stats |
| `POST` | `/api/discovery/profiles` | Create new search profile |
| `PUT` | `/api/discovery/profiles/[id]` | Update profile filters, cron, enabled |
| `DELETE` | `/api/discovery/profiles/[id]` | Delete profile + cascade discovery listings |
| `POST` | `/api/discovery/profiles/[id]/run` | Trigger on-demand run |

### Discovery Queue

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/discovery/queue` | Paginated queue with filters (status, profile, platform, date) |
| `POST` | `/api/discovery/queue/[id]/accept` | Accept → enrich → create Listing |
| `POST` | `/api/discovery/queue/[id]/reject` | Reject → set status=REJECTED |
| `POST` | `/api/discovery/queue/bulk` | Bulk accept/reject: `{ ids[], action }` |

### Scheduled Trigger

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/cron/discovery-scan` | Cron endpoint: runs all enabled profiles with `nextRunAt <= now()` |

## Execution Pipeline

### Scheduled/On-Demand Scan

1. Query `SearchProfile` where `isEnabled=true AND nextRunAt <= now()` (cron) or specific profile (on-demand)
2. For each profile, for each platform in `profile.platforms`:
   - Use browser scraper (CDP → Playwright fallback)
   - Pass `profile.filters` to `buildSearchUrl()` for filtered results
   - Collect `RawListing[]`
3. Dedup against existing `DiscoveryListing` by `sourceUrl`
4. Dedup against existing `ListingSource` by `sourceUrl`
5. Insert new `DiscoveryListing` records with `status: NEW`
6. Update `ScrapeRun` record, `profile.lastRunAt`, compute `nextRunAt`

### Accept → Enrichment Flow

1. **Detail page enrichment**: HTTP fetch `sourceUrl` via Cheerio scraper to pull full 20+ fields (financials, broker info, employees, etc.)
   - If successful: merge enriched data into RawListing
   - If blocked (403/bot): use existing thin data, continue with what we have
2. **PostProcessor.processOneListing()**: Creates `Listing` + `ListingSource`, runs financial inference, auto-classifies `primaryTrade`, computes initial `fitScore`
3. **Update DiscoveryListing**: `status=ACCEPTED`, `reviewedAt=now()`, `listingId` linked
4. Return enriched Listing to UI

### Expiration

Daily cron (piggybacked on `daily-scan`) marks `DiscoveryListing` as `EXPIRED` when `status=NEW` and `discoveredAt` older than 30 days.

## Scraper Fixes

Three fixes to the existing browser scraper (`browser-scraper.ts`):

1. **BizQuest `scrapeBizQuest()`** — Replace hardcoded `/colorado/` URL with `new BizQuestScraper().buildSearchUrl(filters)` so price/keyword/city filters from SearchProfile are applied
2. **BusinessBroker `scrapeBusinessBroker()`** — Same fix using `new BusinessBrokerScraper().buildSearchUrl(filters)`
3. **BizBuySell `scrapeBizBuySell()`** — Already uses state filter; add keyword and price params from `ScraperFilters`

## UI

### New Page: `/discovery`

**Search Profiles Section (top)**
- Card grid of saved search profiles
- Each card: name, platform badges, filter summary, cron schedule, last run time, new result count
- Actions: Run Now, Edit, Delete, Enable/Disable toggle
- "Create Search Profile" button → modal with name, platform multi-select, filter fields (state, city, price range, cash flow, keyword, category), cron picker (Daily/Weekly/Bi-weekly/Custom)

**Discovery Queue Section (bottom)**
- Table of `DiscoveryListing` records, default filter: `status=NEW`
- Columns: Title (clickable → opens sourceUrl in new tab), Asking Price, Cash Flow, Location, Platform badge, Source Profile, Discovered date
- Row actions: Accept (checkmark), Reject (X)
- Bulk actions toolbar: Select all, Accept selected, Reject selected
- Filter bar: status, profile, platform, date range
- Empty state: "No new discoveries. Create a search profile to start finding deals."

### Existing Page Changes

- **Sidebar**: Add "Discovery" nav item between Pipeline and Market Intel
- **Listing Detail**: Show "Source" badge with marketplace name + clickable link when listing originated from discovery
