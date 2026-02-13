"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardCardId } from "@/hooks/use-dashboard-card-order";

interface SortableDashboardCardProps {
  id: DashboardCardId;
  children: React.ReactNode;
}

export function SortableDashboardCard({
  id,
  children,
}: SortableDashboardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group/drag",
        isDragging && "opacity-50 z-10"
      )}
      {...attributes}
    >
      {/* Drag handle — appears on hover */}
      <button
        {...listeners}
        className={cn(
          "absolute -left-2 top-3 z-10 cursor-grab rounded p-0.5",
          "opacity-0 group-hover/drag:opacity-100 transition-opacity",
          "hover:bg-muted active:cursor-grabbing",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label={`Drag to reorder ${id} card`}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/60" />
      </button>
      {children}
    </div>
  );
}
