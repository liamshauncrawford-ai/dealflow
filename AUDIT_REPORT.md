# DealFlow Codebase Audit Report
## Pre-Upgrade Assessment — Companion Acquisition Spec v2.0

**Auditor:** Claude Code (Opus 4.6)
**Date:** 2026-04-07
**Previous audit:** 2026-02-26 (Phase 0 of Thesis Broadening)
**Purpose:** Audit existing codebase before implementing the 4-rank companion acquisition thesis with 100-point scoring, BVR market data integration, and browser-assisted marketplace search.

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, Turbopack dev) |
| Language | TypeScript 5.9.3 |
| Runtime | React 19.2.4 |
| Database | PostgreSQL (Railway production, Docker local) |
| ORM | Prisma 5.22.0 |
| Auth | NextAuth v5.0.0-beta.30 (Google OAuth, Azure AD) |
| Styling | Tailwind CSS 4.1.18 |
| State | TanStack React Query 5.90.20 |
| Forms | React Hook Form 7.71.1 + Zod 4.3.6 |
| AI | Anthropic SDK 0.74.0 (Claude Sonnet/Opus) |
| Charts | Recharts 3.7.0 |
| Maps | Leaflet + Google Maps |
| Scraping | Apify, Cheerio, Playwright (mostly disabled) |
| Drag & Drop | @dnd-kit |
| Monitoring | Sentry + PostHog |
| Deployment | Railway (production), Docker (local) |

---

## 2. Existing Routes (25+ screens)

| Route | Purpose | Maturity |
|-------|---------|----------|
| `/dashboard` | Main metrics overview | 9/10 |
| `/pipeline` | Kanban board (11 stages, drag-drop) | 9/10 |
| `/pipeline/add` | Create new deal | 9/10 |
| `/pipeline/[id]` | Deal detail (multi-tab) | 9/10 |
| `/listings` | Searchable listings table | 9/10 |
| `/listings/add` | Manual listing entry | 8/10 |
| `/listings/[id]` | Listing detail | 8/10 |
| `/financial/valuation` | Multi-scenario valuation | 8/10 |
| `/financial/compare` | Cross-deal comparison | 8/10 |
| `/financial/rollup` | Portfolio modeling | 8/10 |
| `/market-intel/overview` | Market dashboard | 5/10 |
| `/market-intel/map` | Geographic map | 5/10 |
| `/contacts` | Contact management | 8/10 |
| `/audit` | Audit log viewer | 9/10 |
| `/hidden` | Hidden listings | 8/10 |
| `/settings/*` | 6 settings subsections | 9/10 |

---

## 3. Pipeline Stages (Current — KEEP AS-IS)

| Stage | Order | Display Label |
|-------|-------|---------------|
| CONTACTING | 1 | Contacting |
| REQUESTED_CIM | 2 | Requested CIM |
| SIGNED_NDA | 3 | Signed NDA |
| SCHEDULING_FIRST_MEETING | 4 | Initial Owner Meeting |
| OFFER_SENT | 5 | LOI & Offer Sent |
| COUNTER_OFFER_RECEIVED | 6 | Counter Offer |
| DUE_DILIGENCE | 7 | Due Diligence |
| UNDER_CONTRACT | 8 | Under Contract |
| CLOSED_WON | 9 | Closed Won |
| CLOSED_LOST | 10 | Closed Lost |
| ON_HOLD | 11 | On Hold |

---

## 4. Feature Maturity Assessment

| Feature | Maturity | Notes |
|---------|----------|-------|
| Pipeline/Kanban | 9/10 | Production-ready, drag-drop, 11 stages |
| Deal detail pages | 9/10 | Multi-tab: Overview, Financials, Contacts, Docs, Emails, Notes, History, Risk, Tasks |
| Financial P&L extraction (AI) | 8/10 | Line items, add-backs, overrides, year editing |
| Valuation scenarios | 8/10 | EBITDA/SDE/Revenue methods, sensitivity analysis |
| Fit scoring (current) | 8/10 | 10-factor weighted — **TO BE REPLACED** with 100-point rubric |
| AI features (17 modules) | 9/10 | Deep dives, extraction, risk, outreach |
| Email integration | 8/10 | Outlook + Gmail sync + classify |
| Contact management | 8/10 | Rich profiles, sentiment, owner intelligence |
| Document management | 8/10 | Upload, categorize, preview, AI extraction |
| Task automation | 8/10 | Stage triggers + follow-up chains |
| Settings/config | 9/10 | Comprehensive thesis config |
| Audit logging | 9/10 | Field-level change tracking |
| Notifications | 8/10 | 15+ types |
| Scraping | 3/10 | Only Apify BizBuySell + email parsing work |
| Market intelligence | 5/10 | UI exists, data layer incomplete |

---

## 5. Scraper Audit

### Working Reliably
| Source | Method | Reliability |
|--------|--------|-------------|
| Apify BizBuySell | Cloud actor (paid) | HIGH — bypasses Akamai |
| Email listing parser | Parse broker emails | HIGH — passive |
| CSOS entity search | HTTP form POST | HIGH — government site |
| DORA license search | ASP.NET form POST | MEDIUM — fragile page structure |

### Disabled / Broken (Bot Detection)
| Source | Code Status | Why Broken |
|--------|-------------|------------|
| BizQuest | Complete | Akamai bot detection |
| DealStream | Complete | Bot detection |
| Transworld | Complete | Untested, no bypass |
| LoopNet | Complete (most comprehensive) | Aggressive anti-bot |
| BusinessBroker | Complete | Untested, lighter protection |

**Assessment:** 5 of 7 marketplace scrapers are dead code. The `/api/scraping/trigger` route explicitly skips all non-Apify platforms. The recommended path forward is **Claude Code browser-assisted searching** using the user's real Chrome session.

---

## 6. Gap Analysis — Spec v2.0 vs. Existing

### Completely Missing (New Build)
1. **4-rank target type system** (MSP, UCaaS, Security, Cabling)
2. **100-point scoring rubric** (Financial 40 / Strategic 35 / Operator 25)
3. **Disqualifier engine** (8 auto-disqualifiers)
4. **BVR market data import & intelligence**
5. **Deal structure calculator** (3 SBA scenarios + PMS bridge)
6. **Outreach template system** (3 personalized templates)
7. **Due diligence checklists** (stage-gated)
8. **Priority A fast-track packages**
9. **BVR Query Assistant**
10. **Browser-assisted marketplace search** (Claude Code + Chrome)
11. **`POST /api/import/scraped-listings`** endpoint

### Exists — Needs Enhancement
1. **Scoring engine** → Replace 10-factor with 100-point rubric
2. **Settings/thesis config** → Add 4-rank configuration
3. **Pipeline cards** → Add rank + acquisition tier badges
4. **Listings table** → Add rank/tier columns + filters
5. **Deal detail page** → Add acquisition score panel

### Already Better Than Spec (Preserve As-Is)
1. Pipeline stages (more nuanced than spec's proposal)
2. Financial extraction (full P&L with line items)
3. Email integration (sync + classify + associate)
4. AI analysis (17 modules)
5. Audit logging (field-level tracking)
6. Task automation (stage triggers + follow-up chains)
7. Valuation modeling (multi-method + sensitivity)
8. Document management (categorized + AI extraction)

---

## 7. Implementation Plan

### Approach: Incremental Layers

**Layer 1 — Foundation** (current session)
- Schema: `targetRank`, acquisition score fields, new Listing fields
- Schema: `AcquisitionThesisConfig` table for 4 ranks
- 100-point scoring engine (Financial/Strategic/Operator)
- Disqualifier engine (8 rules)
- Reclassify all existing deals
- UI: rank badges, tier badges, score breakdown panels
- Settings: 4-rank thesis configuration
- New `POST /api/import/scraped-listings` endpoint
- Deploy

**Layer 2 — Target Detail Enrichment**
- Deal structure calculator (3 SBA scenarios)
- SDE→EBITDA adjustment logic
- BVR database schema + import module
- Market intelligence panel on detail pages
- Outreach template system

**Layer 3 — Intelligence**
- BVR Query Assistant screen
- Market data dashboard (per-rank tabs)
- Priority A fast-track auto-generation
- Due diligence checklists

**Layer 4 — Discovery**
- Claude Code browser-assisted marketplace search skill
- Off-market target entry form
- Dashboard upgrades with BVR snapshots
- Export to CSV/Excel

### Principles
- Never delete working functionality without replacement
- All thresholds configurable in settings (not hardcoded)
- Scores recalculate in real time on field changes
- Existing pipeline stages preserved exactly
- BVR integration is import-based (no API dependency)
- Browser-assisted search uses real Chrome session (no bot detection)

---

*Audit completed 2026-04-07 by Claude Code (Opus 4.6)*
