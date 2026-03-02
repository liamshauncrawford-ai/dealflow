# Dashboard Market Map Tile — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a compact market map tile to the dashboard that reuses the existing `DealMapInner` component.

**Architecture:** Add a `compact` prop to `DealMapInner` for smaller marker radii, tighter legend, and disabled scroll zoom. Create a `DashboardMapCard` wrapper component. Register it as a draggable card at position 2 in the dashboard grid.

**Tech Stack:** React, Leaflet via react-leaflet, @dnd-kit, Next.js dynamic imports, TanStack React Query

---

### Task 1: Add `compact` prop to `DealMapInner`

**Files:**
- Modify: `src/components/market-intel/deal-map-inner.tsx`

**Step 1: Update the interface and apply compact behavior**

In `src/components/market-intel/deal-map-inner.tsx`, update the `DealMapInnerProps` interface and component:

```typescript
interface DealMapInnerProps {
  data: MapData | null;
  isLoading: boolean;
  compact?: boolean;
}

export default function DealMapInner({ data, isLoading, compact = false }: DealMapInnerProps) {
```

Then adjust three areas inside the component based on `compact`:

1. `MapContainer` — disable scroll wheel zoom when compact:
```typescript
<MapContainer
  center={COLORADO_CENTER}
  zoom={DEFAULT_ZOOM}
  className="h-full w-full rounded-lg"
  scrollWheelZoom={!compact}
>
```

2. Listing `CircleMarker` radius — use 4 when compact, 5 otherwise:
```typescript
radius={compact ? 4 : 5}
```

3. Pipeline `CircleMarker` radius — use 7 when compact, 10 otherwise:
```typescript
radius={compact ? 7 : 10}
```

4. Legend panel — tighter styling when compact:
```typescript
<div className={cn(
  "absolute right-3 top-3 z-[1000] overflow-y-auto rounded-lg border bg-card/95 shadow-lg backdrop-blur-sm",
  compact ? "max-h-[50vh] p-2 space-y-1.5" : "max-h-[70vh] p-3"
)}>
```

Note: `cn` must be imported from `@/lib/utils`. The existing file does NOT import it, so add:
```typescript
import { cn } from "@/lib/utils";
```

**Step 2: Verify the full Market Map page still works**

Run: `cd ~/dealflow && npx next build 2>&1 | tail -20`
Expected: Build succeeds — `compact` defaults to `false`, so existing behavior is unchanged.

**Step 3: Commit**

```bash
git add src/components/market-intel/deal-map-inner.tsx
git commit -m "feat: add compact prop to DealMapInner"
```

---

### Task 2: Add `compact` prop passthrough to `DealMap`

**Files:**
- Modify: `src/components/market-intel/deal-map.tsx`

**Step 1: Accept and forward compact prop**

Update the `DealMap` component to accept and forward the `compact` prop:

```typescript
interface DealMapProps {
  compact?: boolean;
}

export default function DealMap({ compact }: DealMapProps) {
  // ... existing useQuery code ...

  return <DealMapInner data={data ?? null} isLoading={isLoading} compact={compact} />;
}
```

**Step 2: Build check**

Run: `cd ~/dealflow && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/market-intel/deal-map.tsx
git commit -m "feat: forward compact prop through DealMap"
```

---

### Task 3: Create `DashboardMapCard` component

**Files:**
- Create: `src/components/dashboard/dashboard-map-card.tsx`

**Step 1: Create the component**

```typescript
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";

const DealMap = dynamic(
  () => import("@/components/market-intel/deal-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export function DashboardMapCard() {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Market Map</h3>
        </div>
        <Link
          href="/market-intel/map"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View Full Map
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="h-[400px]">
        <DealMap compact />
      </div>
    </div>
  );
}
```

Note: This uses its own `dynamic()` import of `DealMap` rather than importing the one from `deal-map.tsx` because the dashboard page needs its own dynamic boundary with its own loading skeleton. The `DealMap` component exported from `deal-map.tsx` is a client component that already handles the `useQuery` — we import it dynamically here only to avoid Leaflet's `window` requirement during SSR.

**Step 2: Build check**

Run: `cd ~/dealflow && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/dashboard/dashboard-map-card.tsx
git commit -m "feat: create DashboardMapCard component"
```

---

### Task 4: Register map card on the dashboard

**Files:**
- Modify: `src/hooks/use-dashboard-card-order.ts` (add to DEFAULT_ORDER + type)
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (import + register in cardRegistry)

**Step 1: Add `"market-map"` to DEFAULT_ORDER**

In `src/hooks/use-dashboard-card-order.ts`, insert `"market-map"` at index 1 (position 2):

```typescript
export const DEFAULT_ORDER = [
  "intelligence-feed",
  "market-map",
  "recent-listings",
  // ... rest unchanged
] as const;
```

The `DashboardCardId` type is derived from `DEFAULT_ORDER` via `(typeof DEFAULT_ORDER)[number]`, so it updates automatically.

**Step 2: Register in cardRegistry on dashboard page**

In `src/app/(dashboard)/dashboard/page.tsx`:

Add import at top:
```typescript
import { DashboardMapCard } from "@/components/dashboard/dashboard-map-card";
```

Add to `cardRegistry` object (after `"intelligence-feed"`):
```typescript
"market-map": {
  render: () => <DashboardMapCard />,
  isVisible: () => true,
},
```

**Step 3: Build and verify**

Run: `cd ~/dealflow && npx next build 2>&1 | tail -20`
Expected: Build succeeds with no type errors.

**Step 4: Commit**

```bash
git add src/hooks/use-dashboard-card-order.ts src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: register market map tile on dashboard"
```

---

### Task 5: Push and verify on production

**Step 1: Push to origin**

```bash
git push origin main
```

**Step 2: Wait for Railway deploy** (~90 seconds)

**Step 3: Browser verification**

1. Navigate to `/dashboard`
2. Verify the Market Map tile appears at position 2 (after Intelligence Feed)
3. Verify markers render with correct colors
4. Verify legend and layer toggles work
5. Verify clicking a marker navigates to the deal/listing detail page
6. Verify "View Full Map →" link navigates to `/market-intel/map`
7. Verify the tile is draggable to a different position
8. Navigate to `/market-intel/map` and confirm the full map page is unchanged
