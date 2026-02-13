"use client";

import { useVelocity } from "@/hooks/use-velocity";
import { DealVelocityChart } from "./deal-velocity-chart";

/**
 * Self-contained wrapper that fetches velocity data via its own hook.
 * This keeps the dashboard page from depending on the velocity API.
 */
export function DealVelocityWrapper() {
  const { data, isLoading } = useVelocity();

  return (
    <DealVelocityChart
      velocity={data?.velocity}
      isLoading={isLoading}
    />
  );
}
