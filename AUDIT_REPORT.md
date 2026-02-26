# DealFlow Current State Audit

> Generated: 2026-02-26 | Phase 0 of Thesis Broadening

---

## 1. Project Structure

```
dealflow/
├── prisma/
│   ├── schema.prisma              # 558+ lines, 30+ models, 20+ enums
│   ├── seed.ts                    # DC-thesis seed targets + config
│   ├── seed-market-intel.ts       # DC operators, facilities, GCs, cabling opps
│   ├── seed-targets.ts            # Named thesis targets (SPC, ISI, MSI, etc.)
│   └── seed-scrapers.ts           # DC-specific scraper keywords
├── src/
│   ├── app/
│   │   ├── (dashboard)/           # 15 sidebar pages + 3 hidden pages
│   │   │   ├── activity/
│   │   │   ├── agents/
│   │   │   ├── audit/
│   │   │   ├── contacts/
│   │   │   ├── dashboard/         # Main KPI hub with DC-specific cards
│   │   │   ├── financial/
│   │   │   │   ├── compare/       # Deal comparison
│   │   │   │   ├── rollup/        # Roll-up model
│   │   │   │   └── valuation/     # Valuation calculator
│   │   │   ├── hidden/
│   │   │   ├── listings/          # Target businesses table + detail
│   │   │   ├── market-intel/      # ★ 100% DC-SPECIFIC (6 pages)
│   │   │   │   ├── gcs/           # GC Tracker
│   │   │   │   ├── intelligence/  # Market Intelligence dashboard
│   │   │   │   ├── map/           # Facility map (Google Maps)
│   │   │   │   ├── network/       # Relationship network (D3)
│   │   │   │   ├── operators/     # DC Operators directory
│   │   │   │   └── opportunities/ # Cabling Pipeline
│   │   │   ├── pipeline/          # Kanban + opportunity detail
│   │   │   └── settings/          # Settings hub (7 sub-pages)
│   │   └── api/                   # 60+ API routes
│   │       ├── market-intel/      # ★ 14 DC-specific API routes
│   │       ├── pipeline/          # 25+ endpoints (generic CRM)
│   │       ├── listings/          # 8 endpoints (generic CRM)
│   │       ├── cron/              # 7 cron jobs (mixed DC/generic)
│   │       └── ...
│   ├── components/                # 73 component files
│   │   ├── market-intel/          # ★ 4 DC-specific forms/graph
│   │   ├── maps/                  # ★ 6 DC facility map components
│   │   ├── pipeline/              # 25 components (mostly generic)
│   │   ├── financials/            # 12 components (generic)
│   │   ├── charts/                # 12 chart components (mixed)
│   │   └── ...
│   ├── hooks/                     # 25 custom hooks
│   │   ├── use-market-intel.ts    # ★ DC-specific data fetching
│   │   └── ...                    # Rest are generic
│   ├── lib/
│   │   ├── ai/                    # ★ 13 AI modules (ALL have DC prompts)
│   │   ├── market-intel/          # ★ 4 DC-specific engines
│   │   ├── financial/             # 14 files (generic)
│   │   ├── scoring/               # 3 files (DC-weighted scoring)
│   │   ├── scrapers/              # 17 files (generic infra, DC keywords)
│   │   ├── email/                 # 5 files (generic)
│   │   └── ...
│   └── types/                     # 3 type definition files
├── CLAUDE.md                      # ★ DC-specific project description
└── docs/plans/                    # DC market intel architecture docs
```

**Key counts:**
- 33 user-facing pages (18 generic, 10 DC-specific, 5 mixed)
- 60+ API routes (40+ generic, 14 DC-specific, 7 mixed)
- 73 component files (59 generic, 10 DC-specific, 4 mixed)
- 13 AI modules (ALL contain DC-specific system prompts)

---

## 2. Page Inventory

### Sidebar Navigation (15 pages)

| # | Section | Page | Route | DC-Specific? |
|---|---------|------|-------|--------------|
| 1 | Main | Dashboard | `/dashboard` | MIXED — has `CablingPipelineSummaryCard`, `market-intel-summary` card |
| 2 | Main | Target Businesses | `/listings` | MIXED — `dcRelevanceScore`, `dcCertifications` columns/filters |
| 3 | Main | Pipeline | `/pipeline` | Generic (CRM Kanban) |
| 4 | Main | Contacts | `/contacts` | Generic |
| 5 | Market Intel | Market Map | `/market-intel/map` | ★ DC-SPECIFIC — DC facility pins, operator tiers |
| 6 | Market Intel | DC Operators | `/market-intel/operators` | ★ DC-SPECIFIC — DataCenterOperator CRUD |
| 7 | Market Intel | GC Tracker | `/market-intel/gcs` | ★ DC-SPECIFIC — GeneralContractor directory |
| 8 | Market Intel | Cabling Pipeline | `/market-intel/opportunities` | ★ DC-SPECIFIC — CablingOpportunity stages |
| 9 | Market Intel | Network | `/market-intel/network` | ★ DC-SPECIFIC — GC-Operator-Target graph |
| 10 | Market Intel | Intelligence | `/market-intel/intelligence` | ★ DC-SPECIFIC — MW tracked, cabling TAM |
| 11 | Financial | Valuation Calc | `/financial/valuation` | MIXED — DC-weighted commentary |
| 12 | Financial | Roll-Up Model | `/financial/rollup` | Generic structure, DC-weighted commentary |
| 13 | Financial | Deal Comparison | `/financial/compare` | Generic |
| 14 | AI | Agent Dashboard | `/agents` | Generic |
| 15 | Bottom | Settings | `/settings` | MIXED — thesis config has DC defaults |

### Hidden Pages (not in sidebar)

| Page | Route | DC-Specific? |
|------|-------|--------------|
| Activity | `/activity` | Generic |
| Audit Log | `/audit` | Generic |
| Hidden Listings | `/hidden` | Generic |

---

## 3. Market Intel Pages — Detailed Assessment

**Verdict: 100% DC-specific. Must be completely rebuilt for broad commercial services.**

### Market Map (`/market-intel/map`)
- **Data**: `DCFacility` pins on Google Maps + nearby `Listing` targets
- **Filters**: Operator tier, facility status, proximity radius
- **DC content**: Facility capacity in MW, operator color-coding, cabling scope value estimates
- **What changes**: Replace DC facility overlay with generalized industry market view (client locations, project sites, service territory visualization)

### DC Operators (`/market-intel/operators`)
- **Data**: `DataCenterOperator` model — tier classification, relationship status, cabling opportunity score
- **DC content**: Operator tiers (Tier 1 Active Construction → Tier 4 Rumored), MW capacity, construction timelines
- **What changes**: Replace with generalized Client Tracker (any industry customer, not just DC operators)

### GC Tracker (`/market-intel/gcs`)
- **Data**: `GeneralContractor` model — DC experience level, sub-qualification status, approved sub lists
- **DC content**: DC-specific GC qualifications, sub-qualification pipeline, facility assignments
- **What changes**: Repurpose as Channel Partner / Referral Source tracker

### Cabling Pipeline (`/market-intel/opportunities`)
- **Data**: `CablingOpportunity` model — 12-stage pipeline from IDENTIFIED → COMPLETED
- **DC content**: Cabling scopes (BACKBONE_FIBER, HORIZONTAL_COPPER, etc.), MW sizing, RFQ dates
- **What changes**: Replace with generalized Project Pipeline (bid tracking for any commercial services project)

### Network (`/market-intel/network`)
- **Data**: D3 force-directed graph of GC ↔ Operator ↔ Target relationships
- **DC content**: Sub-qualification gap identification, operator-GC relationship mapping
- **What changes**: Generalize to Relationship Network mapping clients, referral sources, and targets

### Intelligence (`/market-intel/intelligence`)
- **Data**: `MarketMetric` time series — MW tracked, construction projects, cabling TAM
- **DC content**: "Total MW Tracked", "Active Construction Projects", "Estimated Cabling TAM"
- **What changes**: Replace KPIs with broad commercial services metrics (total addressable market, industry growth rates, M&A activity)

---

## 4. Financial Analysis Pages — Detailed Assessment

**Verdict: Mostly generic infrastructure. AI commentary prompts are DC-specific.**

### Valuation Calculator (`/financial/valuation`)
- **Generic**: EBITDA inputs, multiple ranges, sensitivity tables, IRR/MOIC calculations
- **DC-specific**: AI valuation commentary prompt references "DC services platform roll-up", 3-5x entry / 8-10x exit multiples hardcoded in AI prompt
- **Change needed**: Update AI commentary prompt and default multiples

### Roll-Up Model (`/financial/rollup`)
- **Generic**: Multi-company aggregation, platform EBITDA, blended multiples
- **DC-specific**: AI commentary references "specialty trade contractors" and "Colorado Front Range"
- **Change needed**: Update AI commentary prompt only

### Deal Comparison (`/financial/compare`)
- **Generic**: Side-by-side listing comparison
- **DC-specific**: Minimal — inherits thesis fit scores which use DC weights
- **Change needed**: No direct changes needed (inherits from scoring engine update)

---

## 5. CRM Pages — DC Reference Check

### Dashboard (`/dashboard`)
- **DC references**: `CablingPipelineSummaryCard` component, `market-intel-summary` card, `DC_PROJECT_NEWS` notification type
- **Change needed**: Remove cabling pipeline summary card, update market intel summary to show generalized metrics

### Target Businesses (`/listings`)
- **DC references in Listing model fields**: `dcRelevanceScore`, `dcExperience`, `dcClients[]`, `dcCertifications[]`
- **DC references in filters/columns**: DC relevance column, DC certification badges
- **Change needed**: Remove DC-specific fields from schema, remove from table columns and filters

### Pipeline (`/pipeline`)
- **DC references**: Minimal — opportunity detail tabs are generic CRM. AI analysis panels use DC-weighted prompts.
- **Change needed**: Update AI analysis prompts (inherited from AI module changes)

### Contacts (`/contacts`)
- **DC references**: None — fully generic contact directory
- **Change needed**: None

### Settings (`/settings`)
- **DC references in thesis settings**: Default target trades (`STRUCTURED_CABLING`, `SECURITY_SURVEILLANCE`, `BUILDING_AUTOMATION_BMS`), geographic defaults (`CO`, `Denver Metro`), search keywords
- **Change needed**: Broaden thesis defaults, update target trades list, expand geography

---

## 6. Codebase String Search Results

### DC-Specific Terms Found (80+ occurrences)

| Category | Files Affected | Key Locations |
|----------|---------------|---------------|
| "data center" / "DC" | 15+ files | CLAUDE.md, schema.prisma, all AI modules, seed files, map-constants.ts |
| "structured cabling" / "cabling" | 20+ files | constants.ts, seed.ts, seed-market-intel.ts, AI prompts, scrapers, dashboard |
| "low voltage" / "low-voltage" | 10+ files | constants.ts, AI prompts, seed.ts, scraper keywords |
| BICSI / RCDD certifications | 5 files | daily-scan.ts, seed.ts, seed-targets.ts |
| Company names (SPC, ISI, MSI, PMS) | 6 files | seed.ts, seed-targets.ts, admin/seed/route.ts |
| DC operators (QTS, CoreSite, Flexential) | 8 files | seed-market-intel.ts, AI prompts (deep-dive, news-monitor), admin/seed |
| GCs (DPR, Holder, Hensel Phelps, Mortenson) | 6 files | seed-market-intel.ts, AI prompts, admin/seed |
| Colorado / Front Range / Denver | 20+ files | constants.ts, AI prompts, seed files, thesis-defaults.ts, scrapers |

### Prisma Models — DC-Specific (4 models, 8 enums)

**Models to remove/replace:**
1. `DataCenterOperator` (40 fields) — tier, MW capacity, construction timeline, relationship
2. `DCFacility` (20 fields) — capacity, coordinates, operator link, GC assignment
3. `GeneralContractor` (30 fields) — DC experience, sub-qualification, priority
4. `CablingOpportunity` (30 fields) — cabling scopes, bid stages, win probability

**Enums to remove/replace:**
1. `OperatorTier` — TIER_1_ACTIVE_CONSTRUCTION through TIER_4_RUMORED
2. `FacilityStatus` — OPERATING, UNDER_CONSTRUCTION, PLANNED, DECOMMISSIONED
3. `GCPriority` — P1 through P3
4. `GCDCExperience` — SPECIALIST, EXPERIENCED, SOME, NONE
5. `GCRelationshipStatus` — 7 stages from NO_CONTACT to WORK_IN_PROGRESS
6. `OperatorRelationshipStatus` — 8 stages
7. `CablingScope` — 9 scope types (BACKBONE_FIBER, HORIZONTAL_COPPER, etc.)
8. `CablingOpportunityStatus` — 12 stages from IDENTIFIED to COMPLETED

**Listing model DC fields to remove:**
- `dcRelevanceScore Int?`
- `dcExperience Boolean?`
- `dcClients String[]`
- `dcCertifications String[]`

---

## 7. Database Schema

### Generic / Reusable Models (KEEP)

| Model | Purpose | DC Content? |
|-------|---------|-------------|
| Listing | Deal listings with financials | 4 DC fields to remove |
| ListingSource | Platform scrape tracking | Generic |
| Opportunity | Pipeline deal tracking | Generic (thesis fields are configurable) |
| Contact | Owner/principal directory | Generic |
| FinancialPeriod | P&L periods with overrides | Generic |
| FinancialLineItem | Detailed P&L line items | Generic |
| AddBack | EBITDA add-back items | Generic |
| HistoricPnL / HistoricPnLRow | Uploaded spreadsheet data | Generic |
| ValuationModel | Single-deal valuation | Generic |
| RollupModel | Platform roll-up valuation | Generic |
| DealDocument | File attachments | Generic |
| Email / EmailAccount / EmailAttachment / EmailLink | Email integration | Generic |
| EmailTemplate | Email templates | Content is DC-specific |
| Note | Deal notes | Generic |
| StageChange | Pipeline stage history | Generic |
| AuditLog | Immutable audit trail | Generic |
| AIAnalysisResult | Cached AI results | Generic structure |
| AIAgentRun | Agent execution logs | Generic |
| NewsItem | News article classification | Generic structure, DC classification logic |
| WeeklyBrief | Weekly intelligence digest | Generic structure |
| MarketMetric | Time series metrics | DC-specific field names (MW, cabling TAM) |
| DedupGroup / DedupCandidate | Duplicate detection | Generic |
| IndustryMultiple | Valuation benchmarks | Generic |
| ScrapeRun / ScrapeSchedule / ScraperConfig | Scraper infrastructure | Generic |
| PlatformCookie | Scraper authentication | Generic |
| Tag / ListingTag / OpportunityTag | Tagging system | Generic |
| Notification | Push notifications | Has DC_PROJECT_NEWS type |
| Task | Task management | Generic |
| AppSetting | Key-value configuration | Contains DC-specific seed values |
| User / Account / Session / AccessRequest / LoginHistory | Auth & access | Generic |

### Models to Remove Entirely

| Model | Fields | Relationships |
|-------|--------|---------------|
| DataCenterOperator | 40 | → DCFacility[], CablingOpportunity[] |
| DCFacility | 20 | → DataCenterOperator, GeneralContractor, CablingOpportunity[] |
| GeneralContractor | 30 | → DCFacility[], CablingOpportunity[] |
| CablingOpportunity | 30 | → DataCenterOperator, GeneralContractor, DCFacility |

---

## 8. AI Integration Points

All AI modules live in `src/lib/ai/`. Every module uses the shared `claude-client.ts` (Anthropic SDK v0.74.0).

| Module | File | Model | DC-Specific? | What Must Change |
|--------|------|-------|--------------|-----------------|
| Deep Dive | `deep-dive.ts` | sonnet4 | ★ YES — buyer profile, DC market context, GC names, operator projects | Rewrite system prompt for broad commercial services |
| Enrichment | `enrichment.ts` | sonnet4 | ★ YES — DC relevance scoring, cabling contractor revenue benchmarks | Remove DC relevance field, broaden trade benchmarks |
| Daily Scan | `daily-scan.ts` | sonnet4 | ★ YES — DC trades roll-up scoring, BICSI premiums, GC relationship bonuses | Rewrite scoring criteria for generalized commercial services |
| CIM Parser | `cim-parser.ts` | sonnet4 | ★ YES — thesis fit evaluates "CO DC trades roll-up" fit | Update thesis fit assessment to broad commercial services |
| News Monitor | `news-monitor.ts` | sonnet4 | ★ YES — RSS queries for DC construction, operator names, GC projects | Replace RSS queries with broad industry signals |
| Market Pulse | `market-pulse.ts` | sonnet4 | ★ YES — thesis health, MW tracking, cabling TAM, DC market momentum | Rewrite for generalized market health assessment |
| Valuation Commentary | `valuation-commentary.ts` | sonnet4 | ★ YES — DC services platform, Colorado Front Range, 3-5x/8-10x multiples | Update to broad commercial services context |
| Risk Assessment | `risk-assessment.ts` | sonnet4 | ★ YES — thesis fit score references DC trades context | Update thesis fit criteria |
| Outreach Draft | `outreach-draft.ts` | sonnet4 | ★ YES — frames DC market opportunity in outreach letter | Generalize market opportunity framing |
| Financial Extractor | `financial-extractor.ts` | sonnet4 | Minimal — recognizes trades-specific COGS (materials, labor, vehicles) | Minor updates to trade examples |
| Email Intelligence | `email-intelligence.ts` | haiku | NO — generic email classification | No changes needed |
| Claude Client | `claude-client.ts` | — | NO — generic API wrapper | No changes needed |

---

## 9. Seed Data Inventory

### Thesis Target Companies (seed.ts, seed-targets.ts)

| Company | Tier | Revenue | Trade | DC-Specific? |
|---------|------|---------|-------|--------------|
| PMS Commercial Division | OWNED | $1.4M | Security, AV | ★ YES — DC clients, dcRelevanceScore: 8 |
| SPC Communications | TIER_1 | $5M | Structured Cabling | ★ YES — BiCSI RCDD, dcRelevanceScore: 9 |
| ISI Technology | TIER_1 | $6M | Cabling + Security | ★ YES — dcRelevanceScore: 8 |
| Mechanical Solutions Inc | TIER_1 | $5M | BMS / HVAC Controls | ★ YES — dcRelevanceScore: 9 |
| Colorado Controls | TIER_2 | $2M | Building Automation | ★ YES — dcRelevanceScore: 6 |
| Anchor Network Solutions | TIER_2 | $3M | Managed IT + Cabling | ★ YES — dcRelevanceScore: 5 |
| 5 Tier 3 companies | TIER_3 | Various | Various | ★ YES — DC-specific disqualification reasons |

### Market Intel Seed Data (seed-market-intel.ts)

| Category | Count | Examples |
|----------|-------|---------|
| DC Operators | 15+ | QTS, CoreSite, Flexential, Global AI/Humain, Iron Mountain, STACK, Zenlayer, RadiusDC, Novva, Expedient, CyrusOne, Viaero |
| Facilities | 10+ | QTS Aurora (177MW), CoreSite DE1/DE2/DE3, Flexential Parker, Novva CO Springs, Iron Mountain DEN-1 |
| General Contractors | 10+ | DPR, Holder, Hensel Phelps, Mortenson, Constructiv, JE Dunn, PCL, Saunders, Turner, Whiting-Turner |
| Cabling Opportunities | 3+ | QTS Aurora Phase 1, CoreSite DE3, Flexential Parker |

### Configuration Seed Data (AppSetting)

| Key | DC-Specific? | Content |
|-----|-------------|---------|
| Email templates | ★ YES | References "low-voltage / data center trades", "Colorado-based businesses" |
| Search keywords | ★ YES | 22 keyword sets: "structured cabling" AND Colorado, DC-specific terms |
| Broker contacts | Partial | Colorado-focused brokers (reusable pattern) |
| Target email domains | ★ YES | structuredplus.com, intsysinst.com, msicolorado.com |

### Industry Multiples (Generic — KEEP)

18 industry/category combinations (Construction, Transportation, Manufacturing, Food Service, Retail, Professional Services, Healthcare, Technology, Automotive). These are generic and reusable.

---

## 10. Summary: What Must Change

### Remove Entirely
- [ ] 4 Prisma models: `DataCenterOperator`, `DCFacility`, `GeneralContractor`, `CablingOpportunity`
- [ ] 8 DC-specific enums (OperatorTier, FacilityStatus, GCPriority, etc.)
- [ ] 4 Listing model fields: `dcRelevanceScore`, `dcExperience`, `dcClients`, `dcCertifications`
- [ ] 14 market-intel API routes (`/api/market-intel/*`)
- [ ] 6 market-intel UI pages (`/market-intel/*`)
- [ ] 4 market-intel components (`cabling-form.tsx`, `gc-form.tsx`, `operator-form.tsx`, `network-graph.tsx`)
- [ ] 6 map components (`map-view.tsx`, `map-filter-panel.tsx`, `map-legend.tsx`, etc.)
- [ ] 4 market-intel lib engines (`acquisition-flow-engine.ts`, `dc-project-automation.ts`, `gc-relationship-engine.ts`, `proximity.ts`)
- [ ] `market-intel-constants.ts`, `map-constants.ts`
- [ ] `use-market-intel.ts` hook
- [ ] All DC-specific seed data (market-intel seed, thesis targets with DC scores)
- [ ] `CablingPipelineSummaryCard` from dashboard
- [ ] `DC_PROJECT_NEWS` notification type
- [ ] Sidebar labels: "DC Operators", "GC Tracker", "Cabling Pipeline"

### Rewrite / Update
- [ ] 11 AI module system prompts (all except `email-intelligence.ts` and `claude-client.ts`)
- [ ] `fit-score-engine.ts` — new 100-point scoring model for broad commercial services
- [ ] `constants.ts` — `PRIMARY_TRADES`, `TARGET_TRADES`, `SECONDARY_TARGET_TRADES`, `TARGET_STATES`, `TARGET_METROS`, `THESIS_SEARCH_QUERIES`, `FIT_SCORE_WEIGHTS`
- [ ] `thesis-defaults.ts` — default exit multiples, minimum EBITDA, fit score weights
- [ ] `CLAUDE.md` — project description, acquisition thesis, target profile
- [ ] Dashboard summary cards — replace DC metrics with generalized market intel
- [ ] `MarketMetric` model fields — replace MW/cabling fields with generic market metrics
- [ ] `Notification` types — remove `DC_PROJECT_NEWS`, add generalized industry update type
- [ ] Sidebar navigation labels and icons for Market Intel section
- [ ] Seed data — new generic example companies, new industry-agnostic search keywords
- [ ] Email templates — remove DC/Colorado-specific language
- [ ] News monitor RSS queries — replace with broad industry signals

### Keep As-Is (Generic Infrastructure)
- Pipeline CRM (Kanban, opportunity detail, stage tracking)
- Financial modeling (valuation engine, rollup engine, period tracking, line items, add-backs, overrides)
- Email integration (Gmail/Outlook sync, send, classify)
- Contact management
- Document management
- Audit logging
- Scraper infrastructure (platform scrapers, rate limiting, cookie management)
- Deduplication engine
- Import system (Excel/PDF/deal importer)
- Authentication & access control
- Industry multiples reference data

---

*End of Phase 0 Audit — Ready for Phase 1: Strip DC-Specific Content*
