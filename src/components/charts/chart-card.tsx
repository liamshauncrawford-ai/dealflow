"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ResponsiveContainer } from "recharts";

interface ChartCardProps {
  title: string;
  icon: LucideIcon;
  isEmpty?: boolean;
  isLoading?: boolean;
  minHeight?: number;
  headerRight?: ReactNode;
  children: ReactNode;
}

export function ChartCard({
  title,
  icon: Icon,
  isEmpty = false,
  isLoading = false,
  minHeight = 250,
  headerRight,
  children,
}: ChartCardProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">{title}</h2>
        </div>
        {headerRight}
      </div>

      <div className="p-4" style={{ minHeight }}>
        {isLoading ? (
          <div
            className="flex items-center justify-center"
            style={{ minHeight: minHeight - 32 }}
          >
            <div className="space-y-3 w-full px-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : isEmpty ? (
          <div
            className="flex items-center justify-center"
            style={{ minHeight: minHeight - 32 }}
          >
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={minHeight - 32}>
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
