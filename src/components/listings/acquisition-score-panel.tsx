"use client";

import { RankBadge } from "./rank-badge";
import { AcquisitionTierBadge } from "./acquisition-tier-badge";

interface ScoreBarProps {
  label: string;
  score: number | null;
  max: number;
  color: string;
}

function ScoreBar({ label, score, max, color }: ScoreBarProps) {
  const pct = score !== null ? Math.min(100, (score / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score ?? 0}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface AcquisitionScorePanelProps {
  targetRank: number | null;
  targetRankLabel: string | null;
  acquisitionScore: number | null;
  financialScore: number | null;
  strategicScore: number | null;
  operatorScore: number | null;
  acquisitionTier: string | null;
  disqualifiers: string[];
}

export function AcquisitionScorePanel({
  targetRank, targetRankLabel, acquisitionScore, financialScore,
  strategicScore, operatorScore, acquisitionTier, disqualifiers,
}: AcquisitionScorePanelProps) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Acquisition Score</h3>
        <div className="flex items-center gap-2">
          <RankBadge rank={targetRank} label={targetRankLabel} size="md" />
          <AcquisitionTierBadge tier={acquisitionTier} score={acquisitionScore} size="md" />
        </div>
      </div>
      {disqualifiers.length > 0 && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 space-y-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">Disqualified</p>
          {disqualifiers.map((d, i) => (
            <p key={i} className="text-xs text-red-700 dark:text-red-400">- {d}</p>
          ))}
        </div>
      )}
      <div className="space-y-3">
        <ScoreBar label="Financial" score={financialScore} max={40} color="bg-blue-500" />
        <ScoreBar label="Strategic" score={strategicScore} max={35} color="bg-purple-500" />
        <ScoreBar label="Operator Fit" score={operatorScore} max={25} color="bg-emerald-500" />
      </div>
      {acquisitionScore !== null && (
        <div className="pt-2 border-t flex items-center justify-between">
          <span className="text-sm font-medium">Total</span>
          <span className="text-2xl font-bold tabular-nums">
            {acquisitionScore}<span className="text-sm font-normal text-muted-foreground">/100</span>
          </span>
        </div>
      )}
    </div>
  );
}
