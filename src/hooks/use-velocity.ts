"use client";

import { useQuery } from "@tanstack/react-query";

interface VelocityItem {
  stage: string;
  label: string;
  avgDays: number;
  dealCount: number;
}

interface VelocityResponse {
  velocity: VelocityItem[];
}

export function useVelocity() {
  return useQuery<VelocityResponse>({
    queryKey: ["stats", "velocity"],
    queryFn: async () => {
      const res = await fetch("/api/stats/velocity");
      if (!res.ok) throw new Error("Failed to fetch velocity data");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 4 * 60 * 1000,
  });
}
