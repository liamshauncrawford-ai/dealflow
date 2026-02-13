"use client";

import { useState, useEffect, useCallback } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";

const STORAGE_KEY = "dealflow-dashboard-card-order";

export const DEFAULT_ORDER = [
  "recent-listings",
  "pipeline-summary",
  "tier-breakdown",
  "upcoming-follow-ups",
  "stale-contacts",
  "listings-by-platform",
  "scraper-health",
] as const;

export type DashboardCardId = (typeof DEFAULT_ORDER)[number];

function loadSavedOrder(): DashboardCardId[] {
  if (typeof window === "undefined") return [...DEFAULT_ORDER];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [...DEFAULT_ORDER];
    const parsed = JSON.parse(stored) as string[];
    const known = new Set<string>(DEFAULT_ORDER);
    const valid = parsed.filter((id) => known.has(id)) as DashboardCardId[];
    // Append any IDs from DEFAULT_ORDER that are missing from stored (future-proofing)
    for (const id of DEFAULT_ORDER) {
      if (!valid.includes(id)) valid.push(id);
    }
    return valid;
  } catch {
    return [...DEFAULT_ORDER];
  }
}

export function useDashboardCardOrder() {
  const [order, setOrder] = useState<DashboardCardId[]>(loadSavedOrder);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }, [order]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as DashboardCardId);
      const newIndex = prev.indexOf(over.id as DashboardCardId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const resetOrder = useCallback(() => {
    setOrder([...DEFAULT_ORDER]);
  }, []);

  return { order, handleDragEnd, resetOrder };
}
