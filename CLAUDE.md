# DealFlow CRM

M&A deal sourcing and pipeline management platform for Crawford Holdings LLC — acquiring commercial service contractors across Colorado's Front Range (multi-trade roll-up acquisition thesis).

## Tech Stack

- **Framework**: Next.js 16.1.6 with React 19, App Router, Turbopack (dev)
- **Database**: PostgreSQL 16 via Prisma 5.22 (Railway-hosted production, Docker local)
- **UI**: TailwindCSS + shadcn/ui components + Recharts for charts
- **State**: React Query (@tanstack/react-query) for server state
- **AI**: Anthropic Claude API (@anthropic-ai/sdk) for CIM analysis, risk assessment, email intelligence
- **Email**: Gmail API + Microsoft Graph (Outlook) with encrypted OAuth tokens
- **Deploy**: Railway (Dockerfile-based), PostgreSQL + Redis via docker-compose locally

## Acquisition Thesis

- **Target profile**: Commercial service contractors (11 trade categories), $1M-$30M revenue, Colorado Front Range
- **Trade categories** (PrimaryTrade enum): ELECTRICAL, STRUCTURED_CABLING, SECURITY_FIRE_ALARM, FRAMING_DRYWALL, HVAC_MECHANICAL, PLUMBING, PAINTING_FINISHING, CONCRETE_MASONRY, ROOFING, SITE_WORK, GENERAL_COMMERCIAL
- **Primary targets**: Electrical, Structured Cabling, Security/Fire Alarm, Framing/Drywall, HVAC/Mechanical, Plumbing
- **Secondary targets**: Painting/Finishing, Concrete/Masonry, Roofing, Site Work
- **Base purchase multiple**: 3.0x - 5.0x (with ±0.5x adjustments for quality factors)
- **Exit multiple**: 7-10x (configurable via thesis settings)
- **Scoring model**: 100-point fit score across 7 categories (Owner & Succession 20%, Financial Health 20%, Strategic Fit 15%, Operational Quality 15%, Growth Potential 10%, Deal Feasibility 10%, Certification Value 10%)
- **Key quality factors**: Recurring revenue %, customer concentration, key-person risk, owner age/succession, revenue trend
- **SDE vs EBITDA**: Both tracked; SDE important for small business acquisitions (SDE_TO_EBITDA_RATIO = 1.15)
- **All thesis parameters are configurable** via Settings > Thesis Configuration (stored in AppSetting table)

## Architecture

### File Structure

```
src/
  app/
    (dashboard)/          # Authenticated layout group
      activity/           # Activity feed page
      audit/              # Global audit log page
      contacts/           # Cross-deal contact directory
      listings/           # Deal listings table + detail + add
      market-intel/       # Market intelligence (map, industry tracker, etc.)
      pipeline/           # Kanban board + opportunity detail + add
      settings/           # Settings hub (email, thesis, import, scraping, dedup)
      hidden/             # Hidden/archived listings
    api/                  # Route handlers (REST API)
      admin/              # Seed data, system administration
      ai/                 # AI enrichment, deep dive, analysis endpoints
      audit/              # Audit log queries
      contacts/           # Contact CRUD
      cron/               # Scheduled jobs (daily scan)
      email/              # Email auth, sync, send, classify, templates
      listings/           # Listing CRUD, scoring, valuation, export
      market-intel/       # Market map data
      pipeline/           # Opportunity CRUD, documents, notes, emails, CIM, risk
      settings/thesis/    # Thesis config get/patch
      stats/              # Dashboard stats + deal velocity
      tasks/              # Task CRUD
    page.tsx              # Dashboard (landing page)
  components/
    charts/               # Recharts chart components (funnel, velocity, value, etc.)
    contacts/             # Contact table, filters, detail sheet
    dashboard/            # Sortable dashboard cards
    financials/           # Historic P&L table, upload, financial period tables
    layout/               # Header, sidebar, notification bell
    listings/             # Listing table, filters, badges, financial summary
    pipeline/             # Pipeline components (deal header, analysis, risk, emails, tabs)
    ui/                   # shadcn/ui primitives (button, card, dialog, etc.)
  hooks/                  # React Query hooks (use-pipeline, use-listings, etc.)
  lib/
    ai/                   # Claude API client, CIM parser, risk assessment, email intelligence
    email/                # Gmail/Outlook sync engines, send engine, email parser
    financial/            # Industry multiples, inference engine, validators, historic P&L parser
    import/               # Excel parser, PDF parser, deal importer, file scanner
    scoring/              # Fit score engine (7-category 100pt model), valuation calculator
    scrapers/             # 6 platform scrapers (BizBuySell, BizQuest, DealStream, etc.)
    validations/          # Zod schemas for all domains
    constants.ts          # Trade categories, tiers, scoring weights, search queries
    valuation.ts          # Canonical 5-tier valuation waterfall (shared)
    thesis-defaults.ts    # ThesisConfig interface + defaults
    thesis-loader.ts      # Server-side thesis config loader from AppSetting
    workflow-engine.ts    # Stage-change automation engine
    audit.ts              # Audit log utility
  types/                  # TypeScript type definitions
```

### Key Patterns

1. **API Routes**: Next.js Route Handlers in `src/app/api/`. All mutations validated with Zod schemas from `src/lib/validations/`. Return `NextResponse.json()`.

2. **React Query Hooks**: All in `src/hooks/`. Pattern: `useQuery` for reads, `useMutation` with `onSuccess` invalidation for writes. Query keys namespaced by domain (e.g., `["pipeline"]`, `["opportunity", id]`).

3. **Error Boundaries**: Every section on the opportunity detail page wrapped in `<ErrorBoundary>`. Use `src/components/error-boundary.tsx`.

4. **Audit Logging**: Import `{ logAudit }` from `@/lib/audit`. Call on all significant mutations.

5. **Financial Calculations**: Use shared `getOpportunityValueRange()` and `getImpliedEV()` from `@/lib/valuation` — never duplicate the waterfall logic.

6. **Thesis Configuration**: Use `loadThesisConfig()` server-side, `useThesisSettings()` client-side. All thesis parameters stored in `AppSetting` table with `thesis.*` keys.

7. **Formatting**: Use `formatCurrency()`, `formatPercent()`, `formatMultiple()`, `formatNumber()` from `@/lib/utils`.

8. **Trade Categories**: All 11 trade categories defined in `src/lib/constants.ts` as `PRIMARY_TRADES`. The Prisma `PrimaryTrade` enum must stay in sync with these constants.

## Build & Deploy

```bash
# Local development
npm run dev                    # Next.js dev with Turbopack
docker compose up -d           # PostgreSQL 16 + Redis 7

# Database
npx prisma migrate dev         # Create/apply migrations
npx prisma db push             # Push schema without migration (alternative)
npx prisma generate            # Regenerate Prisma client
npx prisma studio              # Visual DB browser

# Production build
npm run build                  # Next.js production build
npm run build:prod             # prisma generate + next build

# Deploy (Railway)
git push origin main           # Triggers Railway auto-deploy (if configured)
npm run deploy:railway         # Manual Railway redeploy via API
```

## Common Gotchas

- After Prisma schema changes, **restart the dev server** for Turbopack to pick up regenerated client
- `prisma migrate dev` sometimes says "already in sync" — use `prisma db push` as alternative
- Gmail initial sync caps at `MAX_MESSAGES_PER_SYNC` (currently 500)
- All 6 listing platform scrapers hit Akamai/captcha bot protection — browser scrapers return 0 results
- Local project path: `~/dealflow` (migrated from iCloud Drive to avoid Turbopack cache issues)
- PrimaryTrade enum values must match between Prisma schema and `constants.ts` PRIMARY_TRADES

## Key Models (Prisma)

- **Listing**: Deal listings with financial data (askingPrice, revenue, ebitda, sde, inferred values, fit scores, tier, primaryTrade)
- **Opportunity**: Pipeline deals with actual financials, offer tracking, risk assessment, stage progression
- **DealDocument**: File attachments (CIM, financials, LOI, NDA) stored as bytea
- **AIAnalysisResult**: Cached AI extraction results (CIM parsing, risk assessment)
- **HistoricPnL / HistoricPnLRow**: Raw P&L data from uploaded Excel files (exact QuickBooks mirror)
- **FinancialPeriod / FinancialLineItem**: Normalized financial data with categories and adjustments
- **IndustryMultiple**: Benchmark multiples by NAICS code with 30-min cache
- **MarketMetric**: Market tracking data (listing volumes, segment metrics)
- **AppSetting**: Key-value store for thesis configuration
- **Contact**: Cross-deal contact directory with outreach tracking
- **AuditLog**: Global audit trail for all significant actions
