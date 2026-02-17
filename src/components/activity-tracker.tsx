"use client";

import { useActivity } from "@/hooks/use-activity";

/**
 * Client component that tracks user activity.
 * Mount this inside the dashboard layout.
 */
export function ActivityTracker() {
  useActivity();
  return null;
}
