# Market Intelligence & Platform Roll-Up Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Market Intelligence tracking (DC operators, general contractors, cabling opportunities) and a Platform Roll-Up financial dashboard to DealFlow, transforming it from a pure acquisition CRM into a full strategic intelligence tool aligned with the Colorado data center trades thesis.

**Architecture:** Three new Prisma models (DataCenterOperator, GeneralContractor, CablingOpportunity) with full CRUD APIs following existing patterns. A new "Market Intel" sidebar section with three sub-pages. A Platform Roll-Up dashboard card on the main dashboard. All new seed data from the thesis market intelligence document.

**Tech Stack:** Next.js 16.1 (App Router + Turbopack), React 19, Prisma 5.22, PostgreSQL 16, TypeScript, Tailwind CSS 4, shadcn/ui components, Recharts, React Query, Zod validation.

---

## Phase Overview

| Phase | Description | Tasks | Est. Effort |
|-------|-------------|-------|-------------|
| A | Schema: New Prisma models + enums | 1-3 | 30 min |
| B | API Routes: CRUD for operators, GCs, opportunities | 4-9 | 60 min |
| C | Sidebar Navigation: Add Market Intel section | 10 | 10 min |
| D | Operators Page: List + detail views | 11-13 | 45 min |
| E | GC Tracker Page: List + qualification tracking | 14-16 | 45 min |
| F | Cabling Opportunities Page: Pipeline board | 17-19 | 45 min |
| G | Platform Roll-Up Dashboard: Financial model card | 20-22 | 40 min |
| H | Seed Data: Pre-populate from thesis documents | 23-24 | 30 min |
| I | Build + Push | 25 | 10 min |

**Total estimated:** ~5 hours of implementation

---

## Task 1: Add new enums to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add enums after existing `InteractionType` enum (line ~262)**

```prisma
// ── MARKET INTELLIGENCE ENUMS ──────────────────

enum OperatorTier {
  TIER_1_ACTIVE_CONSTRUCTION
  TIER_2_EXPANSION
  TIER_3_EXISTING_MAINTENANCE
  TIER_4_RUMORED
}

enum FacilityStatus {
  OPERATING
  UNDER_CONSTRUCTION
  PLANNED
  RUMORED
}

enum GCPriority {
  HIGHEST
  HIGH
  MODERATE
  MONITOR
}

enum GCDCExperience {
  SPECIALIST
  EXPERIENCED
  SOME
  NONE
}

enum SubQualificationStatus {
  NOT_APPLIED
  APPLICATION_SUBMITTED
  QUALIFIED
  PREFERRED
  REJECTED
}

enum GCRelationshipStatus {
  NO_CONTACT
  IDENTIFIED
  INTRODUCTION_MADE
  MEETING_HELD
  BID_INVITED
  WORK_IN_PROGRESS
}

enum OperatorRelationshipStatus {
  NO_CONTACT
  IDENTIFIED
  INTRODUCTION_MADE
  MEETING_HELD
  RFQ_RECEIVED
  BID_SUBMITTED
  CONTRACT_AWARDED
  ACTIVE_WORK
}

enum CablingScope {
  BACKBONE_FIBER
  HORIZONTAL_COPPER
  CABLE_TRAY_PATHWAY
  CABINET_RACK_INSTALL
  MEET_ME_ROOM
  SECURITY_ACCESS_CONTROL
  CCTV_SURVEILLANCE
  ENVIRONMENTAL_MONITORING
  TESTING_CERTIFICATION
  OTHER
}

enum CablingOpportunityStatus {
  IDENTIFIED
  PRE_RFQ
  RFQ_RECEIVED
  ESTIMATING
  BID_SUBMITTED
  BID_UNDER_REVIEW
  AWARDED
  CONTRACT_NEGOTIATION
  MOBILIZING
  IN_PROGRESS
  PUNCH_LIST
  COMPLETED
  LOST
  NO_BID
}
```

**Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add market intelligence enums"
```

---

## Task 2: Add DataCenterOperator and GeneralContractor models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add models before the `DedupGroup` model (line ~268)**

```prisma
// ─────────────────────────────────────────────
// MARKET INTELLIGENCE TABLES
// ─────────────────────────────────────────────

model DataCenterOperator {
  id                String   @id @default(cuid())

  // Identity
  name              String
  parentCompany     String?
  hqLocation        String?
  hqState           String?
  website           String?

  // Classification
  tier              OperatorTier     @default(TIER_3_EXISTING_MAINTENANCE)
  cablingOpportunityScore  Int?      // 1-10 scale
  estimatedAnnualCablingRevenue  Decimal?  @db.Decimal(14, 2)

  // Construction activity
  activeConstruction  Boolean   @default(false)
  constructionTimeline String?
  phaseCount          Int?

  // Relationship tracking
  relationshipStatus  OperatorRelationshipStatus  @default(NO_CONTACT)
  primaryContactName  String?
  primaryContactTitle String?
  primaryContactEmail String?
  primaryContactPhone String?
  lastContactDate     DateTime?
  nextFollowUp        DateTime?
  notes               String?   @db.Text

  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  // Relations
  facilities        DCFacility[]
  cablingOpportunities CablingOpportunity[]

  @@index([tier])
  @@index([relationshipStatus])
}

model DCFacility {
  id              String   @id @default(cuid())

  // Parent operator
  operatorId      String
  operator        DataCenterOperator  @relation(fields: [operatorId], references: [id], onDelete: Cascade)

  // Location
  facilityName    String
  address         String?
  city            String?
  state           String?    @default("CO")
  latitude        Float?
  longitude       Float?

  // Specs
  capacityMW      Float?
  sqft            Int?
  status          FacilityStatus   @default(OPERATING)
  yearOpened      Int?
  yearExpectedCompletion  Int?
  tierCertification  String?

  // Construction
  generalContractorId  String?
  generalContractor    GeneralContractor?  @relation(fields: [generalContractorId], references: [id])
  estimatedCablingScopeValue  Decimal?  @db.Decimal(14, 2)

  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  // Relations
  cablingOpportunities  CablingOpportunity[]

  @@index([operatorId])
  @@index([status])
  @@index([generalContractorId])
}

model GeneralContractor {
  id              String   @id @default(cuid())

  // Identity
  name            String
  hqLocation      String?
  website         String?
  coloradoOffice  Boolean  @default(false)
  coloradoOfficeAddress  String?

  // DC experience
  dcExperienceLevel  GCDCExperience  @default(NONE)
  notableDCProjects  String[]
  nationalDCClients  String[]

  // Sub qualification
  approvedSubList          Boolean   @default(false)
  subQualificationStatus   SubQualificationStatus  @default(NOT_APPLIED)
  qualificationDate        DateTime?
  prequalificationRequirements  String?  @db.Text

  // Relationship tracking
  relationshipStatus  GCRelationshipStatus  @default(NO_CONTACT)
  primaryContactName  String?
  primaryContactTitle String?
  primaryContactEmail String?
  primaryContactPhone String?
  lastContactDate     DateTime?
  nextFollowUp        DateTime?
  notes               String?   @db.Text

  // Priority
  priority          GCPriority   @default(MONITOR)
  estimatedAnnualOpportunity  Decimal?  @db.Decimal(14, 2)

  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  // Relations
  facilities        DCFacility[]
  cablingOpportunities CablingOpportunity[]

  @@index([priority])
  @@index([relationshipStatus])
  @@index([subQualificationStatus])
}

model CablingOpportunity {
  id              String   @id @default(cuid())

  // Identity
  name            String
  description     String?   @db.Text

  // Linked entities
  operatorId      String?
  operator        DataCenterOperator?  @relation(fields: [operatorId], references: [id])
  gcId            String?
  gc              GeneralContractor?   @relation(fields: [gcId], references: [id])
  facilityId      String?
  facility        DCFacility?          @relation(fields: [facilityId], references: [id])

  // Scope
  facilityAddress   String?
  facilitySizeMW    Float?
  cablingScopes     CablingScope[]

  // Financials
  estimatedValue    Decimal?  @db.Decimal(14, 2)
  bidSubmittedValue Decimal?  @db.Decimal(14, 2)
  awardedValue      Decimal?  @db.Decimal(14, 2)
  actualRevenue     Decimal?  @db.Decimal(14, 2)
  marginPct         Float?

  // Timeline
  rfqDate           DateTime?
  bidDueDate        DateTime?
  bidSubmittedDate  DateTime?
  awardDate         DateTime?
  constructionStart DateTime?
  constructionEnd   DateTime?

  // Status
  status            CablingOpportunityStatus  @default(IDENTIFIED)
  lossReason        String?   @db.Text
  competitorWhoWon  String?

  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  @@index([operatorId])
  @@index([gcId])
  @@index([facilityId])
  @@index([status])
}
```

**Step 2: Run migration**

```bash
cd ~/dealflow && npx prisma db push
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add DataCenterOperator, DCFacility, GeneralContractor, CablingOpportunity models"
```

---

## Task 3: Add Zod validation schemas

**Files:**
- Create: `src/lib/validations/market-intel.ts`

**Step 1: Create validation file**

```typescript
import { z } from "zod";

// ── Operator validations ──

export const operatorQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  tier: z.string().optional(),
  relationshipStatus: z.string().optional(),
  sortBy: z.string().default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const createOperatorSchema = z.object({
  name: z.string().min(1),
  parentCompany: z.string().optional(),
  hqLocation: z.string().optional(),
  hqState: z.string().optional(),
  website: z.string().optional(),
  tier: z.enum([
    "TIER_1_ACTIVE_CONSTRUCTION",
    "TIER_2_EXPANSION",
    "TIER_3_EXISTING_MAINTENANCE",
    "TIER_4_RUMORED",
  ]).optional(),
  cablingOpportunityScore: z.number().int().min(1).max(10).optional(),
  estimatedAnnualCablingRevenue: z.number().optional(),
  activeConstruction: z.boolean().optional(),
  constructionTimeline: z.string().optional(),
  phaseCount: z.number().int().optional(),
  relationshipStatus: z.enum([
    "NO_CONTACT", "IDENTIFIED", "INTRODUCTION_MADE", "MEETING_HELD",
    "RFQ_RECEIVED", "BID_SUBMITTED", "CONTRACT_AWARDED", "ACTIVE_WORK",
  ]).optional(),
  primaryContactName: z.string().optional(),
  primaryContactTitle: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal("")),
  primaryContactPhone: z.string().optional(),
  notes: z.string().optional(),
});

export const updateOperatorSchema = createOperatorSchema.partial();

// ── GC validations ──

export const gcQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  priority: z.string().optional(),
  subQualificationStatus: z.string().optional(),
  sortBy: z.string().default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const createGCSchema = z.object({
  name: z.string().min(1),
  hqLocation: z.string().optional(),
  website: z.string().optional(),
  coloradoOffice: z.boolean().optional(),
  coloradoOfficeAddress: z.string().optional(),
  dcExperienceLevel: z.enum(["SPECIALIST", "EXPERIENCED", "SOME", "NONE"]).optional(),
  notableDCProjects: z.array(z.string()).optional(),
  nationalDCClients: z.array(z.string()).optional(),
  approvedSubList: z.boolean().optional(),
  subQualificationStatus: z.enum([
    "NOT_APPLIED", "APPLICATION_SUBMITTED", "QUALIFIED", "PREFERRED", "REJECTED",
  ]).optional(),
  prequalificationRequirements: z.string().optional(),
  relationshipStatus: z.enum([
    "NO_CONTACT", "IDENTIFIED", "INTRODUCTION_MADE", "MEETING_HELD",
    "BID_INVITED", "WORK_IN_PROGRESS",
  ]).optional(),
  primaryContactName: z.string().optional(),
  primaryContactTitle: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal("")),
  primaryContactPhone: z.string().optional(),
  notes: z.string().optional(),
  priority: z.enum(["HIGHEST", "HIGH", "MODERATE", "MONITOR"]).optional(),
  estimatedAnnualOpportunity: z.number().optional(),
});

export const updateGCSchema = createGCSchema.partial();

// ── Cabling Opportunity validations ──

export const cablingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  status: z.string().optional(),
  operatorId: z.string().optional(),
  gcId: z.string().optional(),
  sortBy: z.string().default("updatedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const createCablingSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  operatorId: z.string().optional(),
  gcId: z.string().optional(),
  facilityId: z.string().optional(),
  facilityAddress: z.string().optional(),
  facilitySizeMW: z.number().optional(),
  cablingScopes: z.array(z.enum([
    "BACKBONE_FIBER", "HORIZONTAL_COPPER", "CABLE_TRAY_PATHWAY",
    "CABINET_RACK_INSTALL", "MEET_ME_ROOM", "SECURITY_ACCESS_CONTROL",
    "CCTV_SURVEILLANCE", "ENVIRONMENTAL_MONITORING", "TESTING_CERTIFICATION", "OTHER",
  ])).optional(),
  estimatedValue: z.number().optional(),
  bidSubmittedValue: z.number().optional(),
  awardedValue: z.number().optional(),
  status: z.enum([
    "IDENTIFIED", "PRE_RFQ", "RFQ_RECEIVED", "ESTIMATING", "BID_SUBMITTED",
    "BID_UNDER_REVIEW", "AWARDED", "CONTRACT_NEGOTIATION", "MOBILIZING",
    "IN_PROGRESS", "PUNCH_LIST", "COMPLETED", "LOST", "NO_BID",
  ]).optional(),
  rfqDate: z.string().datetime().optional(),
  bidDueDate: z.string().datetime().optional(),
  constructionStart: z.string().datetime().optional(),
  constructionEnd: z.string().datetime().optional(),
  lossReason: z.string().optional(),
  competitorWhoWon: z.string().optional(),
});

export const updateCablingSchema = createCablingSchema.partial();
```

**Step 2: Commit**

```bash
git add src/lib/validations/market-intel.ts
git commit -m "feat: add Zod validation schemas for market intel entities"
```

---

## Task 4: Create Operators API routes

**Files:**
- Create: `src/app/api/market-intel/operators/route.ts`
- Create: `src/app/api/market-intel/operators/[id]/route.ts`

**Step 1: Create list/create route** following the exact pattern from `src/app/api/listings/route.ts`

The route should:
- GET: List operators with pagination, search, tier filter, sort
- POST: Create a new operator

**Step 2: Create detail route**

The route should:
- GET: Fetch single operator with facilities and cabling opportunities
- PUT: Update operator fields
- DELETE: Delete operator

**Step 3: Commit**

```bash
git add src/app/api/market-intel/
git commit -m "feat(api): add CRUD routes for DC operators"
```

---

## Task 5: Create General Contractors API routes

**Files:**
- Create: `src/app/api/market-intel/gcs/route.ts`
- Create: `src/app/api/market-intel/gcs/[id]/route.ts`

Same pattern as Task 4, but for GeneralContractor model with priority/qualification filters.

**Commit:**
```bash
git add src/app/api/market-intel/gcs/
git commit -m "feat(api): add CRUD routes for general contractors"
```

---

## Task 6: Create Cabling Opportunities API routes

**Files:**
- Create: `src/app/api/market-intel/opportunities/route.ts`
- Create: `src/app/api/market-intel/opportunities/[id]/route.ts`

Same pattern, with operator/GC relationship includes.

**Commit:**
```bash
git add src/app/api/market-intel/opportunities/
git commit -m "feat(api): add CRUD routes for cabling opportunities"
```

---

## Task 7: Create DC Facilities API routes

**Files:**
- Create: `src/app/api/market-intel/facilities/route.ts`
- Create: `src/app/api/market-intel/facilities/[id]/route.ts`

Facilities are nested under operators. Support creating facilities with operator link.

**Commit:**
```bash
git add src/app/api/market-intel/facilities/
git commit -m "feat(api): add CRUD routes for DC facilities"
```

---

## Task 8: Create Market Intel stats API

**Files:**
- Create: `src/app/api/market-intel/stats/route.ts`

**Step 1: Create stats endpoint** that returns:
- Total operators by tier
- Total GCs by priority
- Total cabling opportunity pipeline value
- Active construction count
- GC qualification status breakdown
- Upcoming follow-ups for operators and GCs
- Total estimated cabling revenue

**Commit:**
```bash
git add src/app/api/market-intel/stats/route.ts
git commit -m "feat(api): add market intel stats endpoint"
```

---

## Task 9: Create React Query hooks for market intel

**Files:**
- Create: `src/hooks/use-market-intel.ts`

**Step 1: Create hooks** following the pattern in `src/hooks/use-pipeline.ts`:
- `useOperators(params)` — list with filters
- `useOperator(id)` — single operator
- `useGCs(params)` — list with filters
- `useGC(id)` — single GC
- `useCablingOpportunities(params)` — list
- `useCablingOpportunity(id)` — single
- `useMarketIntelStats()` — dashboard stats
- Mutation hooks for create/update/delete on each entity

**Commit:**
```bash
git add src/hooks/use-market-intel.ts
git commit -m "feat: add React Query hooks for market intel data"
```

---

## Task 10: Add Market Intel section to sidebar navigation

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Add nav items** to the `mainNavItems` array (after "Audit Log", before "Historical Deals"):

```typescript
import { ..., Building2, HardHat, Cable } from "lucide-react";

// Add after { label: "Audit Log", ... }
{ label: "DC Operators", href: "/market-intel/operators", icon: Building2 },
{ label: "GC Tracker", href: "/market-intel/gcs", icon: HardHat },
{ label: "Cabling Pipeline", href: "/market-intel/opportunities", icon: Cable },
```

**Step 2: Update `isActive` function** to handle `/market-intel/` prefix

**Commit:**
```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(nav): add Market Intel section to sidebar"
```

---

## Task 11: Create Operators list page

**Files:**
- Create: `src/app/(dashboard)/market-intel/operators/page.tsx`

**Step 1: Build the operators list page** with:
- Header: "Data Center Operators" with "Add Operator" button
- Filter bar: tier dropdown, relationship status dropdown, search input
- Table columns: Name, Parent Company, Tier (badge), Facilities Count, Active Construction (boolean), Relationship Status (badge), Cabling Score, Next Follow-Up
- Row click → navigate to operator detail
- Pagination

Use existing patterns from `src/app/(dashboard)/listings/page.tsx` and `src/components/listings/listings-table.tsx`.

**Commit:**
```bash
git add src/app/\(dashboard\)/market-intel/
git commit -m "feat(ui): add DC operators list page"
```

---

## Task 12: Create Operator detail page

**Files:**
- Create: `src/app/(dashboard)/market-intel/operators/[id]/page.tsx`

**Step 1: Build operator detail page** with panels:
- **Header:** Name, parent company, tier badge, relationship status badge
- **Overview Panel:** HQ, website, construction activity, timeline, cabling score
- **Contact Panel:** Primary contact info, last contact date, next follow-up (editable)
- **Facilities Table:** List of DCFacility records with status, capacity, GC assignment
- **Cabling Opportunities:** Linked opportunities with status and estimated value
- **Notes:** Freeform text area (auto-saves)

**Commit:**
```bash
git add src/app/\(dashboard\)/market-intel/operators/
git commit -m "feat(ui): add DC operator detail page with facilities"
```

---

## Task 13: Create Add/Edit Operator form

**Files:**
- Create: `src/components/market-intel/operator-form.tsx`

**Step 1: Build form** using react-hook-form + Zod resolver (same pattern as listing add form):
- All fields from createOperatorSchema
- Tier selector, relationship status selector
- Contact info section
- Save/cancel buttons

**Commit:**
```bash
git add src/components/market-intel/
git commit -m "feat(ui): add operator create/edit form component"
```

---

## Task 14: Create GC Tracker list page

**Files:**
- Create: `src/app/(dashboard)/market-intel/gcs/page.tsx`

**Step 1: Build GC list page** with:
- Header: "General Contractors" with "Add GC" button
- Filter bar: priority dropdown, qualification status dropdown, search
- Table columns: Name, Priority (badge), DC Experience, Colorado Office (check), Sub Status (badge), Relationship Status, Est. Annual Opportunity
- Color-coded priority indicators

**Commit:**
```bash
git add src/app/\(dashboard\)/market-intel/gcs/
git commit -m "feat(ui): add general contractor tracker list page"
```

---

## Task 15: Create GC detail page

**Files:**
- Create: `src/app/(dashboard)/market-intel/gcs/[id]/page.tsx`

**Step 1: Build GC detail page** with:
- **Header:** Name, priority badge, qualification status badge
- **Overview Panel:** HQ, Colorado office, DC experience level, notable projects, national clients
- **Qualification Panel:** Sub list status, qualification date, prequalification requirements
- **Contact Panel:** Primary contact, last contact, next follow-up
- **Facilities:** DCFacilities where this GC is assigned
- **Cabling Opportunities:** Linked opportunities
- **Notes:** Freeform text

**Commit:**
```bash
git add src/app/\(dashboard\)/market-intel/gcs/
git commit -m "feat(ui): add GC detail page with qualification tracking"
```

---

## Task 16: Create Add/Edit GC form

**Files:**
- Create: `src/components/market-intel/gc-form.tsx`

Same pattern as operator form, but with GC-specific fields (DC experience, qualification, priority).

**Commit:**
```bash
git add src/components/market-intel/gc-form.tsx
git commit -m "feat(ui): add GC create/edit form component"
```

---

## Task 17: Create Cabling Opportunities list page

**Files:**
- Create: `src/app/(dashboard)/market-intel/opportunities/page.tsx`

**Step 1: Build cabling pipeline page** with:
- Header: "Cabling Pipeline" with "Add Opportunity" button and total pipeline value
- Filter bar: status dropdown, operator filter, GC filter
- Table columns: Name, Operator, GC, Facility Size (MW), Est. Value, Status (badge), Bid Due Date, Scopes (badges)
- Summary stats row: Total pipeline value, Active bids count, Awarded value

**Commit:**
```bash
git add src/app/\(dashboard\)/market-intel/opportunities/
git commit -m "feat(ui): add cabling opportunities pipeline page"
```

---

## Task 18: Create Cabling Opportunity detail page

**Files:**
- Create: `src/app/(dashboard)/market-intel/opportunities/[id]/page.tsx`

**Step 1: Build detail page** with:
- **Header:** Name, status badge, facility size
- **Scope Panel:** Description, cabling scopes (badges), facility address
- **Linked Entities:** Operator card, GC card, Facility info
- **Financials:** Estimated value, bid value, awarded value, actual revenue, margin
- **Timeline:** RFQ date, bid due, bid submitted, award date, construction dates
- **Loss Info:** (if status is LOST) Loss reason, competitor who won

**Commit:**
```bash
git add src/app/\(dashboard\)/market-intel/opportunities/
git commit -m "feat(ui): add cabling opportunity detail page"
```

---

## Task 19: Create Add/Edit Cabling Opportunity form

**Files:**
- Create: `src/components/market-intel/cabling-form.tsx`

Form with operator/GC selectors (async search), scope multi-select, financial fields, date pickers, status selector.

**Commit:**
```bash
git add src/components/market-intel/cabling-form.tsx
git commit -m "feat(ui): add cabling opportunity create/edit form"
```

---

## Task 20: Create Market Intel constants

**Files:**
- Create: `src/lib/market-intel-constants.ts`

**Step 1: Define display mappings** (same pattern as `src/lib/constants.ts` PIPELINE_STAGES):

```typescript
export const OPERATOR_TIERS = {
  TIER_1_ACTIVE_CONSTRUCTION: { label: "Active Construction", color: "bg-red-500", textColor: "text-red-700" },
  TIER_2_EXPANSION: { label: "Expansion Plans", color: "bg-orange-500", textColor: "text-orange-700" },
  TIER_3_EXISTING_MAINTENANCE: { label: "Existing/Maintenance", color: "bg-blue-500", textColor: "text-blue-700" },
  TIER_4_RUMORED: { label: "Rumored/Scouting", color: "bg-gray-500", textColor: "text-gray-700" },
};

export const GC_PRIORITIES = {
  HIGHEST: { label: "Highest", color: "bg-red-500" },
  HIGH: { label: "High", color: "bg-orange-500" },
  MODERATE: { label: "Moderate", color: "bg-yellow-500" },
  MONITOR: { label: "Monitor", color: "bg-gray-500" },
};

export const CABLING_STATUSES = {
  IDENTIFIED: { label: "Identified", color: "bg-gray-200" },
  PRE_RFQ: { label: "Pre-RFQ", color: "bg-blue-100" },
  RFQ_RECEIVED: { label: "RFQ Received", color: "bg-blue-300" },
  ESTIMATING: { label: "Estimating", color: "bg-blue-500" },
  BID_SUBMITTED: { label: "Bid Submitted", color: "bg-purple-400" },
  BID_UNDER_REVIEW: { label: "Under Review", color: "bg-purple-500" },
  AWARDED: { label: "Awarded", color: "bg-green-400" },
  CONTRACT_NEGOTIATION: { label: "Negotiating", color: "bg-green-500" },
  MOBILIZING: { label: "Mobilizing", color: "bg-green-600" },
  IN_PROGRESS: { label: "In Progress", color: "bg-emerald-500" },
  PUNCH_LIST: { label: "Punch List", color: "bg-emerald-400" },
  COMPLETED: { label: "Completed", color: "bg-emerald-600" },
  LOST: { label: "Lost", color: "bg-red-400" },
  NO_BID: { label: "No Bid", color: "bg-gray-400" },
};

// Cabling scope value estimates by MW (from thesis)
export const CABLING_VALUE_ESTIMATES: Record<string, { low: number; high: number }> = {
  "2-5": { low: 100_000, high: 500_000 },
  "10-20": { low: 500_000, high: 2_000_000 },
  "20-40": { low: 1_000_000, high: 4_000_000 },
  "50-100": { low: 2_000_000, high: 8_000_000 },
  "100+": { low: 5_000_000, high: 15_000_000 },
};
```

**Commit:**
```bash
git add src/lib/market-intel-constants.ts
git commit -m "feat: add market intel display constants and cabling value estimates"
```

---

## Task 21: Add Platform Roll-Up dashboard card

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/hooks/use-dashboard-card-order.ts`

**Step 1: Add a new `"platform-rollup"` card** to the dashboard card registry

The card should display:
- **Combined Platform Revenue** (sum of OWNED + CLOSED_WON listings)
- **Combined Platform EBITDA** (sum + synergy adjustments)
- **Total Capital Deployed** (sum of closed deal values)
- **Implied Platform Multiple** (Capital Deployed / EBITDA)
- **Exit Valuation Range** (EBITDA × 7x to 10x, configurable from thesis config)
- **Estimated MOIC** (Exit Valuation / Capital Deployed)
- **Multiple Arbitrage Gain** ((Exit Multiple - Avg Entry Multiple) × Combined EBITDA)
- Visual bar showing entry multiple vs exit multiple

The data already comes from the existing stats API (`capitalDeployed`, `platformRevenue`, `platformEbitda`, `targetMoic`, `platformValuationLow/High`).

**Step 2: Add `"platform-rollup"` to DEFAULT_ORDER** in `src/hooks/use-dashboard-card-order.ts`

**Step 3: Add a market intel summary card** showing:
- Total DC operators tracked
- Active construction projects
- Total cabling pipeline value
- GC qualification status summary

**Commit:**
```bash
git add src/app/\(dashboard\)/dashboard/page.tsx src/hooks/use-dashboard-card-order.ts
git commit -m "feat(dashboard): add platform roll-up and market intel summary cards"
```

---

## Task 22: Enhance stats API for market intel

**Files:**
- Modify: `src/app/api/stats/route.ts`

**Step 1: Add market intel queries** to the existing stats API:

```typescript
// Add to Promise.all:
prisma.dataCenterOperator.count({ where: { tier: "TIER_1_ACTIVE_CONSTRUCTION" } }),
prisma.cablingOpportunity.aggregate({
  where: { status: { notIn: ["COMPLETED", "LOST", "NO_BID"] } },
  _sum: { estimatedValue: true },
}),
prisma.generalContractor.count({ where: { approvedSubList: true } }),
```

**Step 2: Include in response:**

```typescript
marketIntel: {
  activeConstructionOperators: ...,
  cablingPipelineValue: ...,
  qualifiedGCs: ...,
}
```

**Commit:**
```bash
git add src/app/api/stats/route.ts
git commit -m "feat(api): add market intel stats to dashboard stats endpoint"
```

---

## Task 23: Create market intel seed data

**Files:**
- Create: `prisma/seed-market-intel.ts`

**Step 1: Create seed script** that populates from thesis document data:

**Operators (13 records):**
1. QTS Data Centers — Tier 1 (Blackstone, 177 MW Aurora campus)
2. CoreSite — Tier 1 (American Tower, DE3 under construction)
3. Flexential — Tier 1 (HQ Centennial, Parker facility)
4. Global AI / Humain — Tier 1 (438 acres Windsor, $15.6M land)
5. Iron Mountain — Tier 2 (DEN-1, Tier III Gold)
6. STACK Infrastructure — Tier 2 (HQ Denver)
7. RadiusDC — Tier 2 (1500 Champa)
8. Novva Data Centers — Tier 2 (Colorado Springs, expanding to 30 MW)
9. Expedient — Tier 3 (Centennial, 2 MW)
10. Data Canopy — Tier 3 (Denver)
11. Equinix — Tier 3 (Englewood)
12. Lumen/Level 3 — Tier 3 (Denver)
13. JP Morgan — Tier 3 (Aurora, 25 MW)

**GCs (7 records):**
1. DPR Construction — HIGHEST (CoreSite DE3 GC)
2. Holder Construction — HIGHEST (QTS Aurora GC)
3. Constructiv — HIGH (CoreSite GC of Record for retrofits)
4. Hensel Phelps — HIGH (Greeley HQ, Meta data centers)
5. Mortenson — MODERATE (Denver office, Meta Minnesota)
6. JE Dunn — MODERATE (Denver office)
7. PCL Construction — MODERATE (Denver area)

**Facilities (20+ records):** All addresses from thesis Appendix A

**Opportunities (4 records):**
1. QTS Aurora Phase 1 — Holder — Est. $2M–$5M
2. CoreSite DE3 Phase 1 — DPR — Est. $1M–$3M
3. Flexential Parker — Unknown GC — Est. $500K–$1.5M
4. Global AI Windsor Phase 1 — Unknown GC — Est. $300K–$800K

**Step 2: Integrate with main seed script** by adding to `prisma/seed.ts`:

```typescript
import { seedMarketIntel } from "./seed-market-intel";
// At end of main seed:
await seedMarketIntel();
```

**Commit:**
```bash
git add prisma/seed-market-intel.ts prisma/seed.ts
git commit -m "feat(seed): add market intel seed data — 13 operators, 7 GCs, 20+ facilities, 4 opportunities"
```

---

## Task 24: Run seed on local database

**Step 1: Run seed**

```bash
cd ~/dealflow && npx tsx prisma/seed-market-intel.ts
```

**Step 2: Verify data in Prisma Studio**

```bash
npx prisma studio
```

Check DataCenterOperator, GeneralContractor, DCFacility, CablingOpportunity tables.

---

## Task 25: Build, test, commit, push

**Step 1: Build**

```bash
cd ~/dealflow && npm run build
```

**Step 2: Fix any TypeScript errors**

**Step 3: Final commit and push**

```bash
git add -A
git commit -m "feat: complete market intelligence module — operators, GCs, cabling pipeline, platform roll-up dashboard"
git push origin main
```

---

## Environment Variables Required

None — this feature uses only existing database and no external APIs.

## Post-Implementation Notes

### Future Enhancements (Not in this plan)
1. **Map View** — Plot facilities on a Colorado map using Mapbox GL JS (requires `NEXT_PUBLIC_MAPBOX_TOKEN`)
2. **Standalone Valuation Calculator** — Separate page for what-if valuation modeling
3. **News Feed** — RSS/API monitoring of Data Center Dynamics, Denver Business Journal, etc.
4. **Automated Alerts** — Email notifications when operator construction status changes
5. **GC Prequalification Document Upload** — Attach insurance certs, EMR, bonding capacity docs

### Key Patterns to Follow
- **API routes:** Use `parseSearchParams` / `parseBody` from `src/lib/validations/common.ts`
- **React Query:** Follow `src/hooks/use-pipeline.ts` patterns with query keys, mutation invalidation
- **Components:** Use shadcn/ui primitives (`Card`, `Badge`, `Button`, `Input`, `Select`)
- **Forms:** Use react-hook-form + @hookform/resolvers + Zod
- **Tables:** Use @tanstack/react-table (already installed)
- **Charts:** Use Recharts (already installed)
- **Styling:** Tailwind CSS utility classes, follow existing dark mode patterns (`dark:bg-*`, `dark:text-*`)
