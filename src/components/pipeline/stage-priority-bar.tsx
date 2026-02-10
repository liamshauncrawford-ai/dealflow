"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Clock, DollarSign, FileText, Flag, Phone, Send, TrendingUp } from "lucide-react";
import { useUpdateOpportunity } from "@/hooks/use-pipeline";
import {
  PIPELINE_STAGES,
  PRIORITY_LEVELS,
  type PipelineStageKey,
} from "@/lib/constants";
import { cn, formatCurrency, formatRelativeDate } from "@/lib/utils";

const STAGE_ORDER: PipelineStageKey[] = [
  "CONTACTING",
  "REQUESTED_CIM",
  "SIGNED_NDA",
  "DUE_DILIGENCE",
  "OFFER_SENT",
  "COUNTER_OFFER_RECEIVED",
  "UNDER_CONTRACT",
  "CLOSED_WON",
  "CLOSED_LOST",
  "ON_HOLD",
];

const LOST_CATEGORIES = ["Price", "Competition", "Timing", "Fit", "Other"];

interface StagePriorityBarProps {
  opportunity: {
    id: string;
    stage: string;
    priority: string;
    contactedAt: string | null;
    ndaSignedAt: string | null;
    offerSentAt: string | null;
    updatedAt: string;
    winProbability: number | null;
    dealValue: number | null;
  };
}

export function StagePriorityBar({ opportunity }: StagePriorityBarProps) {
  const updateOpportunity = useUpdateOpportunity();
  const [showStageMenu, setShowStageMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [stageNote, setStageNote] = useState("");

  // Deal scoring state
  const [editingWinProb, setEditingWinProb] = useState(false);
  const [winProbValue, setWinProbValue] = useState("");
  const [editingDealValue, setEditingDealValue] = useState(false);
  const [dealValueInput, setDealValueInput] = useState("");

  // Lost reason modal
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostCategory, setLostCategory] = useState("");
  const [lostReason, setLostReason] = useState("");

  const currentStageInfo = PIPELINE_STAGES[opportunity.stage as PipelineStageKey];
  const priorityInfo = PRIORITY_LEVELS[opportunity.priority as keyof typeof PRIORITY_LEVELS];

  const handleStageChange = (newStage: string) => {
    if (newStage === "CLOSED_LOST") {
      setShowLostModal(true);
      setShowStageMenu(false);
      return;
    }
    updateOpportunity.mutate({
      id: opportunity.id,
      data: { stage: newStage, stageNote: stageNote || undefined },
    });
    setShowStageMenu(false);
    setStageNote("");
  };

  const handleLostSubmit = () => {
    updateOpportunity.mutate({
      id: opportunity.id,
      data: {
        stage: "CLOSED_LOST",
        stageNote: stageNote || undefined,
        lostCategory: lostCategory || undefined,
        lostReason: lostReason || undefined,
      },
    });
    setShowLostModal(false);
    setStageNote("");
    setLostCategory("");
    setLostReason("");
  };

  const handlePriorityChange = (newPriority: string) => {
    updateOpportunity.mutate({
      id: opportunity.id,
      data: { priority: newPriority },
    });
    setShowPriorityMenu(false);
  };

  const saveWinProbability = () => {
    const val = parseFloat(winProbValue);
    if (isNaN(val) || val < 0 || val > 100) {
      setEditingWinProb(false);
      return;
    }
    updateOpportunity.mutate(
      { id: opportunity.id, data: { winProbability: val / 100 } },
      { onSuccess: () => setEditingWinProb(false) }
    );
  };

  const saveDealValue = () => {
    const val = parseFloat(dealValueInput);
    if (isNaN(val)) {
      setEditingDealValue(false);
      return;
    }
    updateOpportunity.mutate(
      { id: opportunity.id, data: { dealValue: val } },
      { onSuccess: () => setEditingDealValue(false) }
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        {/* Stage selector */}
        <div className="relative">
          <button
            onClick={() => setShowStageMenu(!showStageMenu)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium",
              currentStageInfo?.color ?? "bg-muted",
              "bg-opacity-20"
            )}
          >
            <div className={cn("h-2.5 w-2.5 rounded-full", currentStageInfo?.color)} />
            {currentStageInfo?.label ?? opportunity.stage}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {showStageMenu && (
            <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border bg-card shadow-lg">
              <div className="max-h-80 overflow-y-auto p-1">
                {STAGE_ORDER.map((stageKey) => {
                  const stage = PIPELINE_STAGES[stageKey];
                  const isCurrent = opportunity.stage === stageKey;
                  return (
                    <button
                      key={stageKey}
                      onClick={() => handleStageChange(stageKey)}
                      disabled={isCurrent}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                        isCurrent ? "bg-muted font-medium" : "hover:bg-muted/50"
                      )}
                    >
                      <div className={cn("h-2 w-2 rounded-full", stage.color)} />
                      {stage.label}
                      {isCurrent && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <div className="border-t p-2">
                <input
                  type="text"
                  placeholder="Optional note for stage change..."
                  value={stageNote}
                  onChange={(e) => setStageNote(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}
        </div>

        {/* Priority selector */}
        <div className="relative">
          <button
            onClick={() => setShowPriorityMenu(!showPriorityMenu)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50"
          >
            <Flag className={cn("h-3.5 w-3.5", priorityInfo?.color ?? "text-muted-foreground")} />
            {priorityInfo?.label ?? opportunity.priority}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {showPriorityMenu && (
            <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border bg-card p-1 shadow-lg">
              {Object.entries(PRIORITY_LEVELS).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => handlePriorityChange(key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-muted/50",
                    opportunity.priority === key && "bg-muted font-medium"
                  )}
                >
                  <Flag className={cn("h-3.5 w-3.5", info.color)} />
                  {info.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Win probability */}
        <div className="flex items-center gap-1.5">
          {editingWinProb ? (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="number"
                min="0"
                max="100"
                value={winProbValue}
                onChange={(e) => setWinProbValue(e.target.value)}
                onBlur={saveWinProbability}
                onKeyDown={(e) => e.key === "Enter" && saveWinProbability()}
                className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs"
                autoFocus
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          ) : (
            <button
              onClick={() => {
                setWinProbValue(opportunity.winProbability != null ? String(Math.round(opportunity.winProbability * 100)) : "");
                setEditingWinProb(true);
              }}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/50"
              title="Win probability"
            >
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              {opportunity.winProbability != null
                ? `${Math.round(opportunity.winProbability * 100)}%`
                : "Win %"}
            </button>
          )}
        </div>

        {/* Deal value */}
        <div className="flex items-center gap-1.5">
          {editingDealValue ? (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="number"
                value={dealValueInput}
                onChange={(e) => setDealValueInput(e.target.value)}
                onBlur={saveDealValue}
                onKeyDown={(e) => e.key === "Enter" && saveDealValue()}
                className="w-24 rounded border bg-background px-1.5 py-0.5 text-xs"
                placeholder="0"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setDealValueInput(opportunity.dealValue != null ? String(opportunity.dealValue) : "");
                setEditingDealValue(true);
              }}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/50"
              title="Deal value"
            >
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              {opportunity.dealValue != null
                ? formatCurrency(opportunity.dealValue)
                : "Deal Value"}
            </button>
          )}
        </div>

        {/* Key dates */}
        <div className="ml-auto flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {opportunity.contactedAt && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              Contacted {formatRelativeDate(opportunity.contactedAt)}
            </span>
          )}
          {opportunity.ndaSignedAt && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              NDA {formatRelativeDate(opportunity.ndaSignedAt)}
            </span>
          )}
          {opportunity.offerSentAt && (
            <span className="flex items-center gap-1">
              <Send className="h-3 w-3" />
              Offer {formatRelativeDate(opportunity.offerSentAt)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Updated {formatRelativeDate(opportunity.updatedAt)}
          </span>
        </div>
      </div>

      {/* Lost Reason Modal */}
      {showLostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowLostModal(false)} />
          <div className="relative w-full max-w-sm rounded-xl border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Mark as Lost</h3>
            <p className="mt-1 text-sm text-muted-foreground">Why was this deal lost?</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={lostCategory}
                  onChange={(e) => setLostCategory(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a reason...</option>
                  {LOST_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Details (optional)</label>
                <textarea
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Any additional context..."
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowLostModal(false)}
                className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleLostSubmit}
                className="flex-1 rounded-md bg-destructive px-3 py-2 text-sm text-white hover:bg-destructive/90"
              >
                Mark as Lost
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
