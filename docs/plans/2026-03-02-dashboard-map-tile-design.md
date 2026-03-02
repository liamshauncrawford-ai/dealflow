# Dashboard Market Map Tile — Design

**Date:** 2026-03-02
**Status:** Approved

## Goal

Add a smaller version of the Market Map to the dashboard as a draggable card tile, with full legend/toggle controls and consistent behavior.

## Approach

Reuse the existing `DealMapInner` component with a new `compact` prop. No new API endpoints needed — the tile shares the same `/api/market-intel/map` data and `["market-map"]` query key.

## Decisions

| Decision | Choice |
|----------|--------|
| Approach | Reuse `DealMapInner` with `compact` prop |
| Click behavior | Markers → deal/listing detail; card header → full map page |
| Legend/controls | Full legend + layer toggles, scaled for compact layout |
| Default position | Position 2 (after Intelligence Feed, before Recent Listings) |

## Changes

### 1. `DealMapInner` — add `compact` prop

- New optional prop: `compact?: boolean` (default `false`)
- When `compact=true`:
  - Legend panel: smaller padding (`p-2`), `max-h-[50vh]`, tighter spacing
  - Marker radii reduced: listings 4px (was 5), pipeline 7px (was 10)
  - Scroll wheel zoom disabled (prevents accidental zoom on dashboard scroll)
- All else unchanged: tooltips, click navigation, layer toggles, colors

### 2. New `DashboardMapCard` component

- Wraps `DealMap` inside a dashboard card with `h-[400px]` fixed height
- Card header: map icon + "Market Map" + "View Full Map →" link
- Uses `SortableDashboardCard` wrapper for drag-and-drop

### 3. Dashboard page registration

- Add `"market-map"` to `DEFAULT_ORDER` at position 2
- Add `"market-map"` to `DashboardCardId` type
- Register in `cardRegistry` with `isVisible: () => true`

## What stays the same

- Same API endpoint, query key, markers, colors, tooltips, legend
- Full Market Map page unchanged
- Marker clicks navigate to deal/listing detail pages
