# DealFlow CRM

M&A deal sourcing and pipeline management platform for acquiring data center and B2B commercial electrical contracting companies (Colorado-focused roll-up acquisition thesis).

## Tech Stack

- **Framework**: Next.js 16.1.6 with React 19, App Router, Turbopack (dev)
- **Database**: PostgreSQL 16 via Prisma 5.22 (Railway-hosted production, Docker local)
- **UI**: TailwindCSS + shadcn/ui components + Recharts for charts
- **State**: React Query (@tanstack/react-query) for server state
- **AI**: Anthropic Claude API (@anthropic-ai/sdk) for CIM analysis, risk assessment, email intelligence
- **Email**: Gmail API + Microsoft Graph (Outlook) with encrypted OAuth tokens
- **Deploy**: Railway (Dockerfile-based), PostgreSQL + Redis via docker-compose locally

## Acquisition Thesis

- **Target profile**: Data center trades, B2B commercial electrical contractors, $600K-$2M EBITDA
- **Base purchase multiple**: 3.0x - 5.0x (with ±0.5x adjustments for quality factors)
- **Exit multiple**: 7-10x (configurable via thesis settings)
- **Key quality factors**: Recurring revenue %, customer concentration, key-person risk, DC experience, revenue trend
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
      pipeline/           # Kanban board + opportunity detail + add
      settings/           # Settings hub (email, thesis, import, scraping, dedup)
      hidden/             # Hidden/archived listings
    api/                  # Route handlers (REST API)
      audit/              # Audit log queries
      contacts/           # Contact CRUD
      email/              # Email auth, sync, send, classify, templates
      listings/           # Listing CRUD, scoring, valuation, export
      pipeline/           # Opportunity CRUD, documents, notes, emails, CIM, risk
      settings/thesis/    # Thesis config get/patch
      stats/              # Dashboard stats + deal velocity
      tasks/              # Task CRUD
    page.tsx              # Dashboard (landing page)
  components/
    charts/               # 9 Recharts chart components (funnel, velocity, value, etc.)
    contacts/             # Contact table, filters, detail sheet
    dashboard/            # Sortable dashboard cards
    layout/               # Header, sidebar, notification bell
    listings/             # Listing table, filters, badges, financial summary
    pipeline/             # 14 pipeline components (deal header, analysis, risk, emails, etc.)
    ui/                   # shadcn/ui primitives (button, card, dialog, etc.)
  hooks/                  # 21 React Query hooks (use-pipeline, use-listings, etc.)
  lib/
    ai/                   # Claude API client, CIM parser, risk assessment, email intelligence
    email/                # Gmail/Outlook sync engines, send engine, email parser
    financial/            # Industry multiples, inference engine, validators
    import/               # Excel parser, PDF parser, deal importer, file scanner
    scoring/              # Fit score engine, valuation calculator
    scrapers/             # 6 platform scrapers (BizBuySell, BizQuest, DealStream, etc.)
    validations/          # Zod schemas for all domains
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

## Key Models (Prisma)

- **Listing**: Deal listings with financial data (askingPrice, revenue, ebitda, sde, inferred values, fit scores, tier classification)
- **Opportunity**: Pipeline deals with actual financials, offer tracking, risk assessment, stage progression
- **DealDocument**: File attachments (CIM, financials, LOI, NDA) stored as bytea
- **AIAnalysisResult**: Cached AI extraction results (CIM parsing, risk assessment)
- **IndustryMultiple**: Benchmark multiples by NAICS code with 30-min cache
- **AppSetting**: Key-value store for thesis configuration
- **Contact**: Cross-deal contact directory with outreach tracking
- **AuditLog**: Global audit trail for all significant actions
