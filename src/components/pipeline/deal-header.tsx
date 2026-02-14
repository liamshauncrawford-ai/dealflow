"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenLine, Trash2, X, Save, Sparkles, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUpdateOpportunity, useDeleteOpportunity } from "@/hooks/use-pipeline";
import { TierBadge } from "@/components/listings/tier-badge";
import { FitScoreGauge } from "@/components/listings/fit-score-gauge";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DealHeaderProps {
  opportunity: {
    id: string;
    title: string;
    description: string | null;
    offerPrice: number | null;
    offerTerms: string | null;
    listing?: Record<string, any> | null;
  };
}

export function DealHeader({ opportunity }: DealHeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const updateOpportunity = useUpdateOpportunity();
  const deleteOpportunity = useDeleteOpportunity();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [isSummarizing, setIsSummarizing] = useState(false);

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    try {
      const res = await fetch(`/api/pipeline/${opportunity.id}/summarize`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate summary");
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
      toast.success("Description generated");
    } catch {
      toast.error("Failed to generate summary");
    } finally {
      setIsSummarizing(false);
    }
  };

  const startEditing = () => {
    setEditData({
      title: opportunity.title || "",
      description: opportunity.description || "",
      offerPrice: opportunity.offerPrice ? Number(opportunity.offerPrice) : "",
      offerTerms: opportunity.offerTerms || "",
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    const data: Record<string, unknown> = {};
    if (editData.title) data.title = String(editData.title).trim();
    data.description = editData.description ? String(editData.description).trim() : null;
    const price = editData.offerPrice;
    data.offerPrice = price === "" || price === null ? null : Number(price);
    data.offerTerms = editData.offerTerms ? String(editData.offerTerms).trim() : null;
    updateOpportunity.mutate(
      { id: opportunity.id, data },
      { onSuccess: () => setIsEditing(false) }
    );
  };

  const handleDelete = () => {
    deleteOpportunity.mutate(opportunity.id, {
      onSuccess: () => router.push("/pipeline"),
    });
  };

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/pipeline" className="hover:text-foreground">Pipeline</Link>
        <span>/</span>
        <span className="font-medium text-foreground truncate max-w-[300px]">
          {opportunity.title}
        </span>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={String(editData.title || "")}
                  onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))}
                  className="text-2xl font-bold bg-background border rounded-md px-2 py-1 w-full"
                  placeholder="Deal title"
                />
                <textarea
                  value={String(editData.description || "")}
                  onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-background border rounded-md px-2 py-1 text-sm"
                  placeholder="Description..."
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Offer Price ($)</label>
                    <input
                      type="number"
                      value={editData.offerPrice === null || editData.offerPrice === undefined || editData.offerPrice === "" ? "" : String(editData.offerPrice)}
                      onChange={(e) => setEditData((p) => ({ ...p, offerPrice: e.target.value ? Number(e.target.value) : "" }))}
                      className="mt-1 w-full bg-background border rounded-md px-2 py-1 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Offer Terms</label>
                    <input
                      type="text"
                      value={String(editData.offerTerms || "")}
                      onChange={(e) => setEditData((p) => ({ ...p, offerTerms: e.target.value }))}
                      className="mt-1 w-full bg-background border rounded-md px-2 py-1 text-sm"
                      placeholder="e.g., SBA 7(a), 10% down"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={updateOpportunity.isPending}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" /> {updateOpportunity.isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold">{opportunity.title}</h1>
                  {opportunity.listing?.tier && (
                    <TierBadge tier={opportunity.listing.tier} size="sm" />
                  )}
                  {opportunity.listing?.fitScore !== null && opportunity.listing?.fitScore !== undefined && (
                    <FitScoreGauge score={opportunity.listing.fitScore} size="sm" showLabel={false} />
                  )}
                </div>
                {opportunity.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {opportunity.description}
                  </p>
                )}
                {/* AI summary button: show when no description or very long raw blurb */}
                {opportunity.listing && (!opportunity.description || opportunity.description.length > 500) && (
                  <button
                    onClick={handleGenerateSummary}
                    disabled={isSummarizing}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {isSummarizing ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generating summary...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        {opportunity.description ? "Regenerate summary with AI" : "Generate description with AI"}
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={startEditing}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Edit deal details"
              >
                <PenLine className="h-4 w-4" />
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete opportunity"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              {showDeleteConfirm && (
                <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-lg border bg-card p-3 shadow-lg">
                  <p className="mb-2 text-sm font-medium">Delete this opportunity?</p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    This will remove the opportunity from the pipeline. The linked listing will not be affected.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 rounded-md border px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteOpportunity.isPending}
                      className="flex-1 rounded-md bg-destructive px-3 py-1.5 text-xs text-white hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {deleteOpportunity.isPending ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
