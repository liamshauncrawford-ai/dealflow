"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Trash2,
  Plus,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isStageUnlocked } from "@/lib/due-diligence/defaults";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DDItem {
  id: string;
  listingId: string;
  stage: string;
  itemText: string;
  isCompleted: boolean;
  completedAt: string | null;
  notes: string | null;
  isCustom: boolean;
  order: number;
}

interface DDResponse {
  items: DDItem[];
  pipelineStage: string | null;
}

interface DueDiligencePanelProps {
  listingId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  PRE_NDA: "Pre-NDA",
  POST_NDA: "Post-NDA",
  LOI_DD: "LOI / Due Diligence",
};

const UNLOCK_LABELS: Record<string, string> = {
  POST_NDA: "Signed NDA",
  LOI_DD: "Offer Sent",
};

const STAGE_ORDER = ["PRE_NDA", "POST_NDA", "LOI_DD"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DueDiligencePanel({ listingId }: DueDiligencePanelProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [addingStage, setAddingStage] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const queryKey = ["due-diligence", listingId];

  const { data, isLoading } = useQuery<DDResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/listings/${listingId}/due-diligence`);
      if (!res.ok) throw new Error("Failed to fetch DD items");
      return res.json();
    },
  });

  const toggleCompletion = useMutation({
    mutationFn: async ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) => {
      const res = await fetch(`/api/listings/${listingId}/due-diligence/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateNotes = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      const res = await fetch(`/api/listings/${listingId}/due-diligence/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error("Failed to update notes");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const addItem = useMutation({
    mutationFn: async ({ stage, itemText }: { stage: string; itemText: string }) => {
      const res = await fetch(`/api/listings/${listingId}/due-diligence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, itemText }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setAddingStage(null);
      setNewItemText("");
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/listings/${listingId}/due-diligence/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const toggleNotes = (itemId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleAddSubmit = (stage: string) => {
    const text = newItemText.trim();
    if (!text) return;
    addItem.mutate({ stage, itemText: text });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-3/4 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { items, pipelineStage } = data;

  // Group items by stage
  const grouped = STAGE_ORDER.reduce<Record<string, DDItem[]>>((acc, stage) => {
    acc[stage] = items.filter((i) => i.stage === stage);
    return acc;
  }, {} as Record<string, DDItem[]>);

  return (
    <div className="rounded-lg border bg-card p-5">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold">Due Diligence Checklist</h2>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-6">
          {!pipelineStage ? (
            <p className="text-sm text-muted-foreground">
              Promote to pipeline to enable due diligence tracking.
            </p>
          ) : (
            STAGE_ORDER.map((stage) => {
              const stageItems = grouped[stage] ?? [];
              const completedCount = stageItems.filter((i) => i.isCompleted).length;
              const totalCount = stageItems.length;
              const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
              const unlocked = isStageUnlocked(stage, pipelineStage);

              return (
                <div key={stage}>
                  {/* Section header */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>
                        {STAGE_LABELS[stage]} &mdash; {completedCount}/{totalCount} complete
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200">
                      <div
                        className="h-1.5 rounded-full bg-green-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Items */}
                  <ul className="space-y-1">
                    {stageItems.map((item) => {
                      const locked = !unlocked;
                      return (
                        <li key={item.id}>
                          <div
                            className={cn(
                              "flex items-start gap-2 rounded px-2 py-1.5 text-sm",
                              locked && "opacity-60"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={item.isCompleted}
                              disabled={locked || toggleCompletion.isPending}
                              onChange={() =>
                                toggleCompletion.mutate({
                                  itemId: item.id,
                                  isCompleted: !item.isCompleted,
                                })
                              }
                              className="mt-0.5 h-4 w-4 rounded border-gray-300"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    item.isCompleted && "line-through text-muted-foreground",
                                    locked && "text-muted-foreground"
                                  )}
                                >
                                  {item.itemText}
                                </span>
                                {item.isCustom && (
                                  <span className="text-xs bg-blue-50 text-blue-700 rounded px-1">
                                    Custom
                                  </span>
                                )}
                                {locked && (
                                  <>
                                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Unlocks at {UNLOCK_LABELS[stage]}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Notes toggle + textarea */}
                              {!locked && (
                                <>
                                  <button
                                    onClick={() => toggleNotes(item.id)}
                                    className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                    {item.notes ? "Edit notes" : "Add notes"}
                                  </button>
                                  {expandedNotes.has(item.id) && (
                                    <textarea
                                      className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
                                      rows={2}
                                      defaultValue={item.notes ?? ""}
                                      onBlur={(e) =>
                                        updateNotes.mutate({
                                          itemId: item.id,
                                          notes: e.target.value,
                                        })
                                      }
                                      placeholder="Add notes..."
                                    />
                                  )}
                                </>
                              )}
                            </div>

                            {/* Delete button for custom items */}
                            {item.isCustom && !locked && (
                              <button
                                onClick={() => deleteItem.mutate(item.id)}
                                className="mt-0.5 text-muted-foreground hover:text-destructive"
                                title="Delete custom item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Add custom item */}
                  {unlocked && (
                    <div className="mt-2">
                      {addingStage === stage ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddSubmit(stage);
                            }}
                            className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                            placeholder="New checklist item..."
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddSubmit(stage)}
                            disabled={addItem.isPending}
                            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => {
                              setAddingStage(null);
                              setNewItemText("");
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingStage(stage);
                            setNewItemText("");
                          }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Item
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
