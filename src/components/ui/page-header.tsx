"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Right-aligned action buttons */
  actions?: ReactNode;
  /** Additional content below the title row (e.g., filter tabs) */
  children?: ReactNode;
  className?: string;
}

/**
 * Standardized page header used across all dashboard pages.
 * Enforces consistent typography, spacing, and action layout.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            {Icon && (
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}
