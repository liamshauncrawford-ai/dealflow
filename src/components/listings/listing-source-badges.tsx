"use client";

import { PLATFORMS, type PlatformKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ListingSourceBadgesProps {
  sources: Array<{ platform: string; sourceUrl: string }>;
  className?: string;
}

export function ListingSourceBadges({ sources, className }: ListingSourceBadgesProps) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {sources.map((source) => {
        const platform = PLATFORMS[source.platform as PlatformKey];
        if (!platform) return null;

        const isManual = source.sourceUrl.startsWith("manual://");

        if (isManual) {
          return (
            <span
              key={source.sourceUrl}
              className="inline-flex cursor-default items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: platform.color }}
              title={platform.label}
            >
              {platform.shortLabel}
            </span>
          );
        }

        return (
          <a
            key={source.sourceUrl}
            href={source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: platform.color }}
            title={`View on ${platform.label}`}
          >
            {platform.shortLabel}
          </a>
        );
      })}
    </div>
  );
}
