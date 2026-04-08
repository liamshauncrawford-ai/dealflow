"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  BarChart3,
  Sliders,
  Target,
  ChevronDown,
  Layers,
} from "lucide-react";
import {
  useThesisSettings,
  useUpdateThesisSettings,
  useListingsForPlatform,
} from "@/hooks/use-thesis-settings";
import { PageHeader } from "@/components/ui/page-header";
import { PIPELINE_STAGES } from "@/lib/constants";
import {
  SELECTABLE_PIPELINE_STAGES,
  FIT_SCORE_WEIGHT_LABELS,
} from "@/lib/thesis-defaults";
import { formatCurrency } from "@/lib/utils";
import { BvrImportSection } from "@/components/settings/bvr-import-section";

export default function ThesisSettingsPage() {
  const { data: config, isLoading } = useThesisSettings();
  const mutation = useUpdateThesisSettings();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Header />
        <div className="rounded-lg border bg-card p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">
            Failed to load thesis configuration
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Header />

      <PipelineValueStagesSection
        currentStages={config.pipelineValueStages}
        onSave={(stages) => mutation.mutateAsync({ pipelineValueStages: stages })}
        isSaving={mutation.isPending}
      />

      <PlatformCompanySection
        currentPlatformListingId={config.platformListingId}
        onSave={(opportunityId) => mutation.mutateAsync({ platformOpportunityId: opportunityId })}
        isSaving={mutation.isPending}
      />

      <FinancialParametersSection
        exitMultipleLow={config.exitMultipleLow}
        exitMultipleHigh={config.exitMultipleHigh}
        minimumEbitda={config.minimumEbitda}
        minimumSde={config.minimumSde}
        onSave={(params) => mutation.mutateAsync(params)}
        isSaving={mutation.isPending}
      />

      <FitScoreWeightsSection
        currentWeights={config.fitScoreWeights}
        onSave={(weights) => mutation.mutateAsync({ fitScoreWeights: weights })}
        isSaving={mutation.isPending}
      />

      <TargetTypesSection />

      <BvrImportSection />
    </div>
  );
}

/* ─── Header ─── */

function Header() {
  return (
    <div>
      <Link
        href="/settings"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>
      <PageHeader
        title="Thesis Configuration"
        icon={Target}
        description="Configure acquisition thesis parameters that drive dashboard KPIs and analytics."
      />
    </div>
  );
}

/* ─── Section 1: Pipeline Value Stages ─── */

function PipelineValueStagesSection({
  currentStages,
  onSave,
  isSaving,
}: {
  currentStages: string[];
  onSave: (stages: string[]) => Promise<unknown>;
  isSaving: boolean;
}) {
  const [stages, setStages] = useState<string[]>(currentStages);
  const [saved, setSaved] = useState(false);
  const isDirty = JSON.stringify(stages.sort()) !== JSON.stringify([...currentStages].sort());

  useEffect(() => {
    setStages(currentStages);
  }, [currentStages]);

  const handleSave = async () => {
    if (stages.length === 0) return;
    await onSave(stages);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Pipeline Value Stages</h2>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Select which pipeline stages are included in the &quot;Pipeline
          Value&quot; calculation on the dashboard.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SELECTABLE_PIPELINE_STAGES.map((stageKey) => {
            const stage = PIPELINE_STAGES[stageKey as keyof typeof PIPELINE_STAGES];
            if (!stage) return null;
            const isChecked = stages.includes(stageKey);
            return (
              <label
                key={stageKey}
                className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setStages((prev) => [...prev, stageKey]);
                    } else {
                      setStages((prev) => prev.filter((s) => s !== stageKey));
                    }
                  }}
                  className="h-4 w-4 rounded border-muted-foreground/30"
                />
                <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                <span className="text-sm">{stage.label}</span>
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-between pt-2">
          {stages.length === 0 && (
            <p className="text-sm text-destructive">
              At least one stage must be selected
            </p>
          )}
          <div className="ml-auto flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || stages.length === 0 || isSaving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Stages
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section 2: Platform Company ─── */

function PlatformCompanySection({
  currentPlatformListingId,
  onSave,
  isSaving,
}: {
  currentPlatformListingId: string | null;
  onSave: (opportunityId: string | null) => Promise<unknown>;
  isSaving: boolean;
}) {
  const { data: options, isLoading: optionsLoading } = useListingsForPlatform();
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Resolve current platform listing ID → opportunity ID for initial selection
  useEffect(() => {
    if (!options || selectedOppId !== null) return;
    const current = options.find(
      (o) => o.tier === "OWNED" || o.listingId === currentPlatformListingId,
    );
    setSelectedOppId(current?.opportunityId ?? null);
  }, [options, currentPlatformListingId, selectedOppId]);

  // Detect dirty state: compare selected opportunity's listing to current platform listing
  const selectedOption = options?.find((o) => o.opportunityId === selectedOppId);
  const currentOption = options?.find(
    (o) => o.tier === "OWNED" || o.listingId === currentPlatformListingId,
  );
  const isDirty = selectedOppId !== (currentOption?.opportunityId ?? null);

  const handleSave = async () => {
    await onSave(selectedOppId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Platform Company</h2>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Designate which pipeline company is the &quot;platform&quot; for your
          roll-up thesis. This drives Capital Deployed, Platform Revenue,
          Platform EBITDA, and MOIC calculations.
        </p>

        {currentOption && (
          <div className="rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 px-4 py-3">
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
              Current Platform
            </p>
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
              {currentOption.title}
            </p>
            {currentOption.revenue && (
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                Revenue: {formatCurrency(currentOption.revenue)}
                {currentOption.ebitda && ` | EBITDA: ${formatCurrency(currentOption.ebitda)}`}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Select Platform Company
          </label>
          {optionsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading pipeline companies...
            </div>
          ) : (
            <select
              value={selectedOppId || ""}
              onChange={(e) => setSelectedOppId(e.target.value || null)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">None (no platform designated)</option>
              {options?.map((opt) => (
                <option key={opt.opportunityId} value={opt.opportunityId}>
                  {opt.title}
                  {opt.tier === "OWNED" ? " (current platform)" : ""}
                  {opt.ebitda ? ` — EBITDA: ${formatCurrency(opt.ebitda)}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Platform
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Section 3: Financial Parameters ─── */

function FinancialParametersSection({
  exitMultipleLow,
  exitMultipleHigh,
  minimumEbitda,
  minimumSde,
  onSave,
  isSaving,
}: {
  exitMultipleLow: number;
  exitMultipleHigh: number;
  minimumEbitda: number;
  minimumSde: number;
  onSave: (params: {
    exitMultipleLow: number;
    exitMultipleHigh: number;
    minimumEbitda: number;
    minimumSde: number;
  }) => Promise<unknown>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({
    exitMultipleLow,
    exitMultipleHigh,
    minimumEbitda,
    minimumSde,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({ exitMultipleLow, exitMultipleHigh, minimumEbitda, minimumSde });
  }, [exitMultipleLow, exitMultipleHigh, minimumEbitda, minimumSde]);

  const isDirty =
    form.exitMultipleLow !== exitMultipleLow ||
    form.exitMultipleHigh !== exitMultipleHigh ||
    form.minimumEbitda !== minimumEbitda ||
    form.minimumSde !== minimumSde;

  const handleSave = async () => {
    setError(null);
    if (form.exitMultipleLow > form.exitMultipleHigh) {
      setError("Low multiple must be less than or equal to high multiple");
      return;
    }
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <Sliders className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Financial Parameters</h2>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure exit multiples and financial thresholds used in thesis
          calculations.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              Exit Multiple — Low
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                step={0.5}
                value={form.exitMultipleLow}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    exitMultipleLow: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <span className="text-sm text-muted-foreground">x</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Conservative exit EBITDA multiple
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Exit Multiple — High
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                step={0.5}
                value={form.exitMultipleHigh}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    exitMultipleHigh: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <span className="text-sm text-muted-foreground">x</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Optimistic exit EBITDA multiple
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Minimum EBITDA
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                type="number"
                min={0}
                step={50000}
                value={form.minimumEbitda}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    minimumEbitda: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Listings below this EBITDA are excluded from active count
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Minimum SDE
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                type="number"
                min={0}
                step={50000}
                value={form.minimumSde}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    minimumSde: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Listings below this SDE are excluded from active count
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Parameters
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Section 4: Fit Score Weights ─── */

function FitScoreWeightsSection({
  currentWeights,
  onSave,
  isSaving,
}: {
  currentWeights: Record<string, number>;
  onSave: (weights: Record<string, number>) => Promise<unknown>;
  isSaving: boolean;
}) {
  const [weights, setWeights] = useState<Record<string, number>>(currentWeights);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeights(currentWeights);
  }, [currentWeights]);

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const isValid = Math.abs(sum - 1.0) <= 0.01;
  const isDirty = JSON.stringify(weights) !== JSON.stringify(currentWeights);

  const handleSave = async () => {
    setError(null);
    if (!isValid) {
      setError(`Weights must sum to 100% (currently ${(sum * 100).toFixed(0)}%)`);
      return;
    }
    try {
      await onSave(weights);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <Target className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Fit Score Weights</h2>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Adjust how each category contributes to the overall fit score. Weights
          must sum to 100%.
        </p>

        <div className="space-y-3">
          {Object.entries(weights).map(([key, value]) => {
            const label = FIT_SCORE_WEIGHT_LABELS[key] || key;
            return (
              <div key={key} className="flex items-center gap-4">
                <span className="w-44 text-sm flex-shrink-0">{label}</span>
                <input
                  type="range"
                  min={0}
                  max={0.5}
                  step={0.01}
                  value={value}
                  onChange={(e) =>
                    setWeights((prev) => ({
                      ...prev,
                      [key]: parseFloat(e.target.value),
                    }))
                  }
                  className="flex-1 h-2 appearance-none bg-muted rounded-lg cursor-pointer accent-primary"
                />
                <span className="w-12 text-right text-sm font-mono tabular-nums">
                  {(value * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div>
            <span className={`text-sm font-medium ${isValid ? "text-green-600" : "text-destructive"}`}>
              Total: {(sum * 100).toFixed(0)}%
            </span>
            {!isValid && (
              <span className="ml-2 text-xs text-destructive">
                (must be 100%)
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || !isValid || isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Weights
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Types for Target Types Section ─── */

interface AcquisitionThesisConfig {
  id: string;
  targetRank: number;
  rankLabel: string;
  description: string | null;
  synergyDescription: string | null;
  isActive: boolean;
  hardFilterMinRevenue: number | null;
  hardFilterMinEbitda: number | null;
  hardFilterMinEbitdaMargin: number | null;
  hardFilterMinMrrPct: number | null;
  hardFilterMinYears: number | null;
  softFilterRevenueLow: number | null;
  softFilterRevenueHigh: number | null;
  softFilterEbitdaLow: number | null;
  softFilterEbitdaHigh: number | null;
  valuationMultipleLow: number | null;
  valuationMultipleMid: number | null;
  valuationMultipleHigh: number | null;
  impliedPriceLow: number | null;
  impliedPriceHigh: number | null;
  sicCodes: string[];
  naicsCodes: string[];
}

const RANK_COLORS: Record<number, { border: string; bg: string; text: string; badge: string }> = {
  1: { border: "border-blue-300 dark:border-blue-700", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  2: { border: "border-purple-300 dark:border-purple-700", bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-300", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  3: { border: "border-amber-300 dark:border-amber-700", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  4: { border: "border-emerald-300 dark:border-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
};

/* ─── Section 5: Target Types ─── */

function TargetTypesSection() {
  const [configs, setConfigs] = useState<AcquisitionThesisConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/acquisition-thesis")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => setConfigs(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Target Types</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure acquisition target rank definitions, hard/soft filter thresholds, and valuation multiples for each target type.
      </p>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border bg-card p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && !error && configs.map((cfg) => (
        <TargetTypeCard
          key={cfg.id}
          config={cfg}
          onSaved={(updated) =>
            setConfigs((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            )
          }
        />
      ))}
    </div>
  );
}

/* ─── Target Type Card ─── */

function TargetTypeCard({
  config,
  onSaved,
}: {
  config: AcquisitionThesisConfig;
  onSaved: (updated: AcquisitionThesisConfig) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSavedState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(config);
  }, [config]);

  const colors = RANK_COLORS[config.targetRank] ?? RANK_COLORS[1];

  const isDirty = JSON.stringify(form) !== JSON.stringify(config);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const { id, sicCodes, naicsCodes, ...fields } = form;
      const res = await fetch("/api/settings/acquisition-thesis", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      const updated = await res.json();
      onSaved(updated);
      setSavedState(true);
      setTimeout(() => setSavedState(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: keyof AcquisitionThesisConfig, value: number | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className={`rounded-lg border ${colors.border} bg-card overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center justify-between px-5 py-3 ${colors.bg} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}>
            Rank {config.targetRank}
          </span>
          <span className={`font-semibold ${colors.text}`}>{config.rankLabel}</span>
          {config.description && (
            <span className="text-sm text-muted-foreground hidden sm:inline">
              — {config.description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              form.isActive
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {form.isActive ? "Active" : "Inactive"}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="p-5 space-y-5">
          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField("isActive", e.target.checked)}
                className="h-4 w-4 rounded border-muted-foreground/30"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
            <span className="text-xs text-muted-foreground">
              Inactive types are excluded from scoring and pipeline matching
            </span>
          </div>

          {/* Hard Filters */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Hard Filter Thresholds</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Minimum values required for a deal to qualify for this target type.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumericField
                label="Min Revenue"
                value={form.hardFilterMinRevenue}
                onChange={(v) => setField("hardFilterMinRevenue", v)}
                prefix="$"
                step={100000}
              />
              <NumericField
                label="Min EBITDA"
                value={form.hardFilterMinEbitda}
                onChange={(v) => setField("hardFilterMinEbitda", v)}
                prefix="$"
                step={50000}
              />
              <NumericField
                label="Min EBITDA Margin"
                value={form.hardFilterMinEbitdaMargin}
                onChange={(v) => setField("hardFilterMinEbitdaMargin", v)}
                suffix="%"
                step={1}
              />
              <NumericField
                label="Min MRR %"
                value={form.hardFilterMinMrrPct}
                onChange={(v) => setField("hardFilterMinMrrPct", v)}
                suffix="%"
                step={5}
              />
              <NumericField
                label="Min Years in Business"
                value={form.hardFilterMinYears}
                onChange={(v) => setField("hardFilterMinYears", v)}
                step={1}
              />
            </div>
          </div>

          {/* Soft Filters */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Soft Filter Ranges</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Preferred ranges for scoring. Deals within range score higher.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <span className="text-sm font-medium">Revenue Range</span>
                <div className="flex items-center gap-2">
                  <NumericField
                    label="Low"
                    value={form.softFilterRevenueLow}
                    onChange={(v) => setField("softFilterRevenueLow", v)}
                    prefix="$"
                    step={100000}
                    compact
                  />
                  <span className="text-muted-foreground mt-5">—</span>
                  <NumericField
                    label="High"
                    value={form.softFilterRevenueHigh}
                    onChange={(v) => setField("softFilterRevenueHigh", v)}
                    prefix="$"
                    step={100000}
                    compact
                  />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">EBITDA Range</span>
                <div className="flex items-center gap-2">
                  <NumericField
                    label="Low"
                    value={form.softFilterEbitdaLow}
                    onChange={(v) => setField("softFilterEbitdaLow", v)}
                    prefix="$"
                    step={50000}
                    compact
                  />
                  <span className="text-muted-foreground mt-5">—</span>
                  <NumericField
                    label="High"
                    value={form.softFilterEbitdaHigh}
                    onChange={(v) => setField("softFilterEbitdaHigh", v)}
                    prefix="$"
                    step={50000}
                    compact
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Valuation Multiples */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Valuation Multiples</h3>
            <p className="text-xs text-muted-foreground mb-3">
              EBITDA multiples used to calculate implied acquisition price range.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumericField
                label="Low Multiple"
                value={form.valuationMultipleLow}
                onChange={(v) => setField("valuationMultipleLow", v)}
                suffix="x"
                step={0.5}
              />
              <NumericField
                label="Mid Multiple"
                value={form.valuationMultipleMid}
                onChange={(v) => setField("valuationMultipleMid", v)}
                suffix="x"
                step={0.5}
              />
              <NumericField
                label="High Multiple"
                value={form.valuationMultipleHigh}
                onChange={(v) => setField("valuationMultipleHigh", v)}
                suffix="x"
                step={0.5}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Save */}
          <div className="flex items-center justify-end gap-2 border-t pt-3">
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save {config.rankLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Numeric Field Helper ─── */

function NumericField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  compact = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex-1 min-w-0" : ""}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        {prefix && (
          <span className="text-sm text-muted-foreground">{prefix}</span>
        )}
        <input
          type="number"
          step={step}
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : parseFloat(v) || null);
          }}
          placeholder="—"
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm tabular-nums"
        />
        {suffix && (
          <span className="text-sm text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}
