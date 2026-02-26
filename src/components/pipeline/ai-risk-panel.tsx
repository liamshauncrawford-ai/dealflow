"use client";

import { useState } from "react";
import {
  Brain,
  Loader2,
  RefreshCw,
  PenLine,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Shield,
  Sparkles,
  Plus,
  Trash2,
} from "lucide-react";
import { useRiskAssessment } from "@/hooks/use-ai";
import {
  useRiskData,
  useUpdateRiskData,
  useDeleteRiskAssessment,
  type RiskAssessmentData,
} from "@/hooks/use-risk-data";
import { cn, formatRelativeDate } from "@/lib/utils";

interface AIRiskPanelProps {
  opportunityId: string;
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
  },
  MEDIUM: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  LOW: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};

const FLAG_SEVERITY_COLORS: Record<string, string> = {
  HIGH: "text-red-600 dark:text-red-400",
  MEDIUM: "text-amber-600 dark:text-amber-400",
  LOW: "text-blue-600 dark:text-blue-400",
};

export function AIRiskPanel({ opportunityId }: AIRiskPanelProps) {
  const { data: riskResponse, isLoading } = useRiskData(opportunityId);
  const generateMutation = useRiskAssessment(opportunityId);
  const updateMutation = useUpdateRiskData(opportunityId);
  const deleteMutation = useDeleteRiskAssessment(opportunityId);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<RiskAssessmentData | null>(null);

  const riskData = riskResponse?.result ?? null;
  const analysisId = riskResponse?.analysisId ?? null;
  const createdAt = riskResponse?.createdAt ?? null;

  const startEditing = () => {
    if (!riskData) return;
    setEditData(JSON.parse(JSON.stringify(riskData)));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditData(null);
  };

  const saveEdit = () => {
    if (!editData || !analysisId) return;
    updateMutation.mutate(
      { analysisId, resultData: editData },
      { onSuccess: () => { setIsEditing(false); setEditData(null); } }
    );
  };

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const handleDelete = () => {
    if (!analysisId) return;
    if (confirm("Delete this risk assessment? This cannot be undone.")) {
      deleteMutation.mutate(analysisId);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Brain className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold">AI Risk Assessment</h2>
        </div>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // No data — show generate button
  if (!riskData) {
    return (
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Brain className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold">AI Risk Assessment</h2>
        </div>
        <div className="p-4 text-center space-y-3">
          <Sparkles className="mx-auto h-8 w-8 text-violet-400/50" />
          <p className="text-xs text-muted-foreground">
            Generate an AI-powered risk assessment for this deal
          </p>
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {generateMutation.isPending ? "Analyzing..." : "Generate Assessment"}
          </button>
        </div>
      </div>
    );
  }

  // Editing mode
  if (isEditing && editData) {
    return (
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold">AI Risk Assessment</h2>
            <span className="rounded bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
              Editing
            </span>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* Recommendation */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Recommendation</label>
            <textarea
              value={editData.recommendation}
              onChange={(e) => setEditData({ ...editData, recommendation: e.target.value })}
              className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-xs"
              rows={3}
            />
          </div>

          {/* Strengths */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Strengths</label>
            <div className="mt-1 space-y-1">
              {editData.strengths.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={s}
                    onChange={(e) => {
                      const arr = [...editData.strengths];
                      arr[i] = e.target.value;
                      setEditData({ ...editData, strengths: arr });
                    }}
                    className="flex-1 rounded border bg-background px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => setEditData({ ...editData, strengths: editData.strengths.filter((_, j) => j !== i) })}
                    className="text-muted-foreground hover:text-destructive p-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setEditData({ ...editData, strengths: [...editData.strengths, ""] })}
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <Plus className="h-2.5 w-2.5" /> Add strength
              </button>
            </div>
          </div>

          {/* Concerns */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Concerns</label>
            <div className="mt-1 space-y-1">
              {editData.concerns.map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={c}
                    onChange={(e) => {
                      const arr = [...editData.concerns];
                      arr[i] = e.target.value;
                      setEditData({ ...editData, concerns: arr });
                    }}
                    className="flex-1 rounded border bg-background px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => setEditData({ ...editData, concerns: editData.concerns.filter((_, j) => j !== i) })}
                    className="text-muted-foreground hover:text-destructive p-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setEditData({ ...editData, concerns: [...editData.concerns, ""] })}
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <Plus className="h-2.5 w-2.5" /> Add concern
              </button>
            </div>
          </div>

          {/* Key Questions */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Key Questions</label>
            <div className="mt-1 space-y-1">
              {editData.keyQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => {
                      const arr = [...editData.keyQuestions];
                      arr[i] = e.target.value;
                      setEditData({ ...editData, keyQuestions: arr });
                    }}
                    className="flex-1 rounded border bg-background px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => setEditData({ ...editData, keyQuestions: editData.keyQuestions.filter((_, j) => j !== i) })}
                    className="text-muted-foreground hover:text-destructive p-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setEditData({ ...editData, keyQuestions: [...editData.keyQuestions, ""] })}
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <Plus className="h-2.5 w-2.5" /> Add question
              </button>
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2 border-t pt-3">
            <button onClick={cancelEdit} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
              <X className="h-3 w-3" /> Cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-3 w-3" /> {updateMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Display mode — show persisted risk assessment
  const riskColor = RISK_COLORS[riskData.overallRisk] || RISK_COLORS.MEDIUM;

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold">AI Risk Assessment</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={startEditing}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Edit assessment"
          >
            <PenLine className="h-3 w-3" />
          </button>
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Regenerate"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            title="Delete assessment"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Overall risk + thesis fit */}
        <div className="flex items-center gap-3">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold",
            riskColor.bg, riskColor.text, riskColor.border,
          )}>
            <Shield className="h-3 w-3" />
            {riskData.overallRisk} RISK
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
            Thesis Fit: {riskData.thesisFitScore}/10
          </span>
          {createdAt && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {formatRelativeDate(createdAt)}
            </span>
          )}
        </div>

        {/* Recommendation */}
        {riskData.recommendation && (
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Recommendation</div>
            <p className="text-xs text-foreground leading-relaxed">{riskData.recommendation}</p>
          </div>
        )}

        {/* Risk Flags */}
        {riskData.riskFlags && riskData.riskFlags.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase mb-1.5">
              <AlertTriangle className="h-3 w-3" />
              Risk Flags ({riskData.riskFlags.length})
            </div>
            <div className="space-y-1">
              {riskData.riskFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md border px-2.5 py-1.5">
                  <span className={cn("text-[10px] font-bold mt-0.5", FLAG_SEVERITY_COLORS[flag.severity])}>
                    {flag.severity}
                  </span>
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground">{flag.category}</span>
                    <p className="text-xs text-foreground">{flag.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strengths */}
        {riskData.strengths && riskData.strengths.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase mb-1">
              <CheckCircle2 className="h-3 w-3" />
              Strengths
            </div>
            <ul className="space-y-0.5">
              {riskData.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                  <span className="text-emerald-500 mt-0.5">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Concerns */}
        {riskData.concerns && riskData.concerns.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 uppercase mb-1">
              <AlertTriangle className="h-3 w-3" />
              Concerns
            </div>
            <ul className="space-y-0.5">
              {riskData.concerns.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                  <span className="text-amber-500 mt-0.5">-</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Questions */}
        {riskData.keyQuestions && riskData.keyQuestions.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 uppercase mb-1">
              <HelpCircle className="h-3 w-3" />
              Key Questions
            </div>
            <ul className="space-y-0.5">
              {riskData.keyQuestions.map((q, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                  <span className="text-blue-500 mt-0.5">?</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
