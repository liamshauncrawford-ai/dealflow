"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn, formatRelativeDate } from "@/lib/utils";

interface FeedItem {
  id: string;
  type: string;
  priority: "high" | "normal" | "low";
  icon: string;
  title: string;
  description: string;
  timestamp: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "border-l-red-500",
  normal: "border-l-blue-500",
  low: "border-l-gray-300 dark:border-l-gray-600",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "HIGH PRIORITY",
  normal: "",
  low: "",
};

export function IntelligenceFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ["intelligence-feed"],
    queryFn: async () => {
      const res = await fetch("/api/ai/intelligence-feed?limit=10");
      if (!res.ok) throw new Error("Failed to fetch feed");
      return res.json() as Promise<{ items: FeedItem[]; total: number }>;
    },
    refetchInterval: 60_000, // Refresh every minute
  });

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="font-medium">AI Intelligence Feed</h2>
        <span className="text-xs text-muted-foreground">
          {data?.total ?? 0} events
        </span>
      </div>
      <div className="divide-y max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data?.items && data.items.length > 0 ? (
          data.items.map((item) => (
            <FeedItemRow key={item.id} item={item} />
          ))
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No intelligence events yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Events will appear here as AI agents run and new targets are discovered
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedItemRow({ item }: { item: FeedItem }) {
  const content = (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 border-l-2 hover:bg-muted/30 transition-colors",
        PRIORITY_COLORS[item.priority]
      )}
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.priority === "high" && (
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
              {PRIORITY_LABELS.high}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatRelativeDate(item.timestamp)}
          </span>
        </div>
        <p className="text-sm font-medium mt-0.5 truncate">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}
        {item.actionUrl && (
          <span className="inline-flex items-center gap-0.5 text-xs text-primary mt-1">
            View <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );

  if (item.actionUrl) {
    return (
      <Link href={item.actionUrl} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
