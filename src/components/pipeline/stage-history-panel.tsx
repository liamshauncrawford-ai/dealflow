"use client";

import { useState } from "react";
import { ArrowRightLeft, PenLine, Trash2 } from "lucide-react";
import {
  useUpdateStageHistory,
  useDeleteStageHistory,
  useAddStageHistory,
} from "@/hooks/use-pipeline";
import { PIPELINE_STAGES, type PipelineStageKey } from "@/lib/constants";
import { cn, formatRelativeDate } from "@/lib/utils";

const STAGE_ORDER: PipelineStageKey[] = [
  "CONTACTING", "REQUESTED_CIM", "SIGNED_NDA",
  "DUE_DILIGENCE", "OFFER_SENT", "COUNTER_OFFER_RECEIVED",
  "UNDER_CONTRACT", "CLOSED_WON", "CLOSED_LOST", "ON_HOLD",
];

interface StageHistoryPanelProps {
  opportunityId: string;
  stageHistory: Array<{
    id: string;
    fromStage: string;
    toStage: string;
    note: string | null;
    createdAt: string;
  }> | null;
}

export function StageHistoryPanel({ opportunityId, stageHistory }: StageHistoryPanelProps) {
  const updateStageHistoryMutation = useUpdateStageHistory(opportunityId);
  const deleteStageHistoryMutation = useDeleteStageHistory(opportunityId);
  const addStageHistoryMutation = useAddStageHistory(opportunityId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ note: string; createdAt: string }>({ note: "", createdAt: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({ fromStage: "", toStage: "", note: "", createdAt: "" });

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Stage History</h2>
        </div>
        <button
          onClick={() => {
            setShowAdd(true);
            setNewEntry({ fromStage: "", toStage: "", note: "", createdAt: new Date().toISOString().split("T")[0] });
          }}
          className="text-xs text-primary hover:underline"
        >
          + Add Entry
        </button>
      </div>
      <div className="p-4">
        {showAdd && (
          <div className="mb-4 rounded-md border bg-muted/20 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">From</label>
                <select
                  value={newEntry.fromStage}
                  onChange={(e) => setNewEntry((p) => ({ ...p, fromStage: e.target.value }))}
                  className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs"
                >
                  <option value="">Select...</option>
                  {STAGE_ORDER.map((s) => (
                    <option key={s} value={s}>{PIPELINE_STAGES[s].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">To</label>
                <select
                  value={newEntry.toStage}
                  onChange={(e) => setNewEntry((p) => ({ ...p, toStage: e.target.value }))}
                  className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs"
                >
                  <option value="">Select...</option>
                  {STAGE_ORDER.map((s) => (
                    <option key={s} value={s}>{PIPELINE_STAGES[s].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <input
              type="text"
              placeholder="Note (optional)"
              value={newEntry.note}
              onChange={(e) => setNewEntry((p) => ({ ...p, note: e.target.value }))}
              className="w-full rounded border bg-background px-2 py-1 text-xs"
            />
            <input
              type="date"
              value={newEntry.createdAt}
              onChange={(e) => setNewEntry((p) => ({ ...p, createdAt: e.target.value }))}
              className="w-full rounded border bg-background px-2 py-1 text-xs"
            />
            <div className="flex gap-1">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded border px-2 py-1 text-xs hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newEntry.fromStage || !newEntry.toStage) return;
                  addStageHistoryMutation.mutate({
                    fromStage: newEntry.fromStage,
                    toStage: newEntry.toStage,
                    note: newEntry.note || undefined,
                    createdAt: newEntry.createdAt || undefined,
                  }, { onSuccess: () => setShowAdd(false) });
                }}
                disabled={!newEntry.fromStage || !newEntry.toStage}
                className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {stageHistory && stageHistory.length > 0 ? (
          <div className="relative space-y-4">
            <div className="absolute bottom-0 left-[7px] top-0 w-px bg-border" />

            {stageHistory.map((change) => {
              const fromInfo = PIPELINE_STAGES[change.fromStage as PipelineStageKey];
              const toInfo = PIPELINE_STAGES[change.toStage as PipelineStageKey];
              const isEditingEntry = editingId === change.id;

              return (
                <div key={change.id} className="group relative flex gap-3 pl-6">
                  <div
                    className={cn(
                      "absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-card",
                      toInfo?.color ?? "bg-muted"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        {fromInfo?.label ?? change.fromStage}
                      </span>
                      <span className="mx-1.5 text-muted-foreground/50">&rarr;</span>
                      <span className="font-medium">
                        {toInfo?.label ?? change.toStage}
                      </span>
                    </div>

                    {isEditingEntry ? (
                      <div className="mt-1 space-y-1">
                        <input
                          type="text"
                          placeholder="Note..."
                          value={editData.note}
                          onChange={(e) => setEditData((p) => ({ ...p, note: e.target.value }))}
                          className="w-full rounded border bg-background px-2 py-0.5 text-xs"
                        />
                        <input
                          type="date"
                          value={editData.createdAt}
                          onChange={(e) => setEditData((p) => ({ ...p, createdAt: e.target.value }))}
                          className="w-full rounded border bg-background px-2 py-0.5 text-xs"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              updateStageHistoryMutation.mutate(
                                {
                                  entryId: change.id,
                                  data: {
                                    note: editData.note || undefined,
                                    createdAt: editData.createdAt || undefined,
                                  },
                                },
                                { onSuccess: () => setEditingId(null) }
                              );
                            }}
                            className="rounded bg-primary px-1.5 py-0.5 text-[10px] text-white hover:bg-primary/90"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {change.note && (
                          <p className="mt-0.5 text-xs text-muted-foreground italic">
                            {change.note}
                          </p>
                        )}
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatRelativeDate(change.createdAt)}
                        </div>
                      </>
                    )}
                  </div>

                  {!isEditingEntry && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingId(change.id);
                          setEditData({
                            note: change.note || "",
                            createdAt: new Date(change.createdAt).toISOString().split("T")[0],
                          });
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Edit"
                      >
                        <PenLine className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Remove this stage history entry?")) {
                            deleteStageHistoryMutation.mutate(change.id);
                          }
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            No stage changes yet
          </p>
        )}
      </div>
    </div>
  );
}
