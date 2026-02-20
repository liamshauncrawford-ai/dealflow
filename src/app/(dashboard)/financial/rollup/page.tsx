"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Layers,
  Plus,
  X,
  TrendingUp,
  DollarSign,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  calculateRollup,
  DEFAULT_ROLLUP_INPUTS,
  type RollupInputs,
  type RollupCompany,
} from "@/lib/financial/rollup-engine";
import {
  type ListingSummary,
  mapListingToRollupCompany,
  formatListingOption,
} from "@/lib/financial/listing-mapper";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function fmt(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtK(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return fmt(value);
}

function fmtX(value: number): string {
  return `${value.toFixed(1)}x`;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function RollUpModelPage() {
  const [inputs, setInputs] = useState<RollupInputs>(DEFAULT_ROLLUP_INPUTS);
  const [showProjection, setShowProjection] = useState(true);

  const { data: listings } = useQuery({
    queryKey: ["listings-for-rollup"],
    queryFn: async () => {
      const res = await fetch("/api/listings?pageSize=100&sortBy=compositeScore&sortDir=desc&meetsThreshold=false");
      if (!res.ok) return { listings: [] };
      return res.json() as Promise<{ listings: ListingSummary[] }>;
    },
  });

  const outputs = useMemo(() => calculateRollup(inputs), [inputs]);

  const updatePlatform = useCallback(
    <K extends keyof RollupCompany>(field: K, value: RollupCompany[K]) => {
      setInputs((prev) => ({
        ...prev,
        platform: { ...prev.platform, [field]: value },
      }));
    },
    [],
  );

  const addBoltOn = useCallback(() => {
    setInputs((prev) => ({
      ...prev,
      boltOns: [
        ...prev.boltOns,
        {
          id: `bolton-${Date.now()}`,
          name: `Bolt-On ${prev.boltOns.length + 1}`,
          revenue: 0,
          ebitda: 0,
          entry_multiple: 3.5,
          close_year: prev.boltOns.length + 2,
        },
      ],
    }));
  }, []);

  const updateBoltOn = useCallback(
    (index: number, field: keyof RollupCompany, value: string | number) => {
      setInputs((prev) => ({
        ...prev,
        boltOns: prev.boltOns.map((b, i) =>
          i === index ? { ...b, [field]: value } : b,
        ),
      }));
    },
    [],
  );

  const removeBoltOn = useCallback((index: number) => {
    setInputs((prev) => ({
      ...prev,
      boltOns: prev.boltOns.filter((_, i) => i !== index),
    }));
  }, []);

  const loadListingToPlatform = useCallback(
    (listingId: string) => {
      const listing = listings?.listings.find((l) => l.id === listingId);
      if (!listing) return;
      const mapped = mapListingToRollupCompany(listing, {
        id: "platform",
        close_year: 1,
        entry_multiple: inputs.platform.entry_multiple,
      });
      setInputs((prev) => ({
        ...prev,
        platform: mapped,
      }));
    },
    [listings, inputs.platform.entry_multiple],
  );

  const loadListingToBoltOn = useCallback(
    (index: number, listingId: string) => {
      const listing = listings?.listings.find((l) => l.id === listingId);
      if (!listing) return;
      const mapped = mapListingToRollupCompany(listing, {
        id: `bolton-${index}`,
        close_year: index + 2,
      });
      setInputs((prev) => ({
        ...prev,
        boltOns: prev.boltOns.map((b, i) => (i === index ? mapped : b)),
      }));
    },
    [listings],
  );

  const reset = useCallback(() => setInputs(DEFAULT_ROLLUP_INPUTS), []);

  // Value bridge bar widths
  const maxBridgeVal = Math.max(
    outputs.valueBridge.entry_value,
    outputs.valueBridge.exit_value,
    1,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Roll-Up Model
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Portfolio-level model: platform + bolt-on acquisitions
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Inputs */}
        <div className="lg:col-span-1 space-y-4">
          {/* Platform */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                Platform Acquisition
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {listings?.listings && listings.listings.length > 0 && (
                <select
                  onChange={(e) => e.target.value && loadListingToPlatform(e.target.value)}
                  className="w-full rounded-md border bg-transparent px-3 py-1.5 text-sm"
                  defaultValue=""
                >
                  <option value="">Load from pipeline...</option>
                  {listings.listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {formatListingOption(l)}
                    </option>
                  ))}
                </select>
              )}
              <FieldInput
                label="Company Name"
                value={inputs.platform.name}
                onChange={(v) => updatePlatform("name", v)}
                type="text"
              />
              <FieldInput
                label="Revenue"
                value={inputs.platform.revenue}
                onChange={(v) => updatePlatform("revenue", parseFloat(v) || 0)}
                prefix="$"
              />
              <FieldInput
                label="EBITDA"
                value={inputs.platform.ebitda}
                onChange={(v) => updatePlatform("ebitda", parseFloat(v) || 0)}
                prefix="$"
              />
              <SliderInput
                label="Entry Multiple"
                value={inputs.platform.entry_multiple}
                onChange={(v) => updatePlatform("entry_multiple", v)}
                min={2.0}
                max={6.0}
                step={0.25}
                format={fmtX}
              />
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                EV: {fmt(inputs.platform.ebitda * inputs.platform.entry_multiple)}
              </div>
            </CardContent>
          </Card>

          {/* Bolt-Ons */}
          {inputs.boltOns.map((b, i) => (
            <Card key={b.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    Bolt-On #{i + 1}
                  </CardTitle>
                  <button
                    onClick={() => removeBoltOn(i)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {listings?.listings && listings.listings.length > 0 && (
                  <select
                    onChange={(e) => e.target.value && loadListingToBoltOn(i, e.target.value)}
                    className="w-full rounded-md border bg-transparent px-3 py-1.5 text-sm"
                    defaultValue=""
                  >
                    <option value="">Load from pipeline...</option>
                    {listings.listings.map((l) => (
                      <option key={l.id} value={l.id}>
                        {formatListingOption(l)}
                      </option>
                    ))}
                  </select>
                )}
                <FieldInput
                  label="Name"
                  value={b.name}
                  onChange={(v) => updateBoltOn(i, "name", v)}
                  type="text"
                />
                <FieldInput
                  label="Revenue"
                  value={b.revenue}
                  onChange={(v) => updateBoltOn(i, "revenue", parseFloat(v) || 0)}
                  prefix="$"
                />
                <FieldInput
                  label="EBITDA"
                  value={b.ebitda}
                  onChange={(v) => updateBoltOn(i, "ebitda", parseFloat(v) || 0)}
                  prefix="$"
                />
                <SliderInput
                  label="Entry Multiple"
                  value={b.entry_multiple}
                  onChange={(v) => updateBoltOn(i, "entry_multiple", v)}
                  min={2.0}
                  max={6.0}
                  step={0.25}
                  format={fmtX}
                />
                <SliderInput
                  label="Close Year"
                  value={b.close_year}
                  onChange={(v) => updateBoltOn(i, "close_year", v)}
                  min={2}
                  max={5}
                  step={1}
                  format={(v) => `Year ${v}`}
                />
              </CardContent>
            </Card>
          ))}

          {inputs.boltOns.length < 4 && (
            <button
              onClick={addBoltOn}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Bolt-On Acquisition
            </button>
          )}

          {/* Synergy Assumptions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Synergy Assumptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FieldInput
                label="SG&A Savings / Bolt-On"
                value={inputs.synergies.sg_a_savings_per_bolton}
                onChange={(v) =>
                  setInputs((p) => ({
                    ...p,
                    synergies: { ...p.synergies, sg_a_savings_per_bolton: parseFloat(v) || 0 },
                  }))
                }
                prefix="$"
              />
              <FieldInput
                label="Procurement Savings / Bolt-On"
                value={inputs.synergies.procurement_savings_per_bolton}
                onChange={(v) =>
                  setInputs((p) => ({
                    ...p,
                    synergies: { ...p.synergies, procurement_savings_per_bolton: parseFloat(v) || 0 },
                  }))
                }
                prefix="$"
              />
              <SliderInput
                label="Cross-Sell Uplift"
                value={inputs.synergies.cross_sell_uplift_pct}
                onChange={(v) =>
                  setInputs((p) => ({
                    ...p,
                    synergies: { ...p.synergies, cross_sell_uplift_pct: v },
                  }))
                }
                min={0}
                max={0.25}
                step={0.01}
                format={fmtPct}
              />
              <SliderInput
                label="Margin Expansion (Y3+)"
                value={inputs.synergies.margin_expansion_pct}
                onChange={(v) =>
                  setInputs((p) => ({
                    ...p,
                    synergies: { ...p.synergies, margin_expansion_pct: v },
                  }))
                }
                min={0}
                max={0.05}
                step={0.005}
                format={fmtPct}
              />
            </CardContent>
          </Card>

          {/* Exit + Financing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Exit & Financing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SliderInput
                label="Exit Year"
                value={inputs.exit.exit_year}
                onChange={(v) =>
                  setInputs((p) => ({ ...p, exit: { ...p.exit, exit_year: v } }))
                }
                min={5}
                max={10}
                step={1}
                format={(v) => `Year ${v}`}
              />
              <SliderInput
                label="Exit Multiple"
                value={inputs.exit.exit_multiple}
                onChange={(v) =>
                  setInputs((p) => ({ ...p, exit: { ...p.exit, exit_multiple: v } }))
                }
                min={5.0}
                max={14.0}
                step={0.5}
                format={fmtX}
              />
              <SliderInput
                label="Revenue Growth"
                value={inputs.financing.revenue_growth_rate}
                onChange={(v) =>
                  setInputs((p) => ({
                    ...p,
                    financing: { ...p.financing, revenue_growth_rate: v },
                  }))
                }
                min={0}
                max={0.20}
                step={0.01}
                format={fmtPct}
              />
              <FieldInput
                label="Owner Salary"
                value={inputs.financing.owner_salary}
                onChange={(v) =>
                  setInputs((p) => ({
                    ...p,
                    financing: { ...p.financing, owner_salary: parseFloat(v) || 0 },
                  }))
                }
                prefix="$"
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Outputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniKPI
              label="MOIC"
              value={fmtX(outputs.moic)}
              color={outputs.moic >= 5 ? "emerald" : outputs.moic >= 3 ? "blue" : "amber"}
            />
            <MiniKPI
              label="IRR"
              value={outputs.irr != null ? fmtPct(outputs.irr) : "N/A"}
              color={
                outputs.irr != null && outputs.irr >= 0.3
                  ? "emerald"
                  : outputs.irr != null && outputs.irr >= 0.2
                    ? "blue"
                    : "amber"
              }
            />
            <MiniKPI
              label="Total Equity"
              value={fmtK(outputs.total_equity_invested)}
              color="blue"
            />
            <MiniKPI
              label="Exit EV"
              value={fmtK(outputs.exit_ev)}
              color="emerald"
            />
          </div>

          {/* Multiple Arbitrage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Multiple Arbitrage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Wtd. Entry Multiple</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {fmtX(outputs.weighted_entry_multiple)}
                  </div>
                </div>
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Exit Multiple</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {fmtX(inputs.exit.exit_multiple)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Spread</div>
                  <div className="text-2xl font-bold text-primary">
                    {fmtX(inputs.exit.exit_multiple - outputs.weighted_entry_multiple)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Value Creation Bridge */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Value Creation Bridge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <BridgeBar
                  label="Entry Value"
                  value={outputs.valueBridge.entry_value}
                  maxValue={maxBridgeVal}
                  color="bg-slate-500"
                  display={fmtK(outputs.valueBridge.entry_value)}
                />
                <BridgeBar
                  label="+ Organic Growth"
                  value={outputs.valueBridge.organic_growth_value}
                  maxValue={maxBridgeVal}
                  color="bg-blue-500"
                  display={`+${fmtK(outputs.valueBridge.organic_growth_value)}`}
                />
                <BridgeBar
                  label="+ Synergies"
                  value={outputs.valueBridge.synergy_value}
                  maxValue={maxBridgeVal}
                  color="bg-amber-500"
                  display={`+${fmtK(outputs.valueBridge.synergy_value)}`}
                />
                <BridgeBar
                  label="+ Multiple Expansion"
                  value={outputs.valueBridge.multiple_expansion_value}
                  maxValue={maxBridgeVal}
                  color="bg-emerald-500"
                  display={`+${fmtK(outputs.valueBridge.multiple_expansion_value)}`}
                />
                <div className="border-t pt-2">
                  <BridgeBar
                    label="Exit Value"
                    value={outputs.valueBridge.exit_value}
                    maxValue={maxBridgeVal}
                    color="bg-primary"
                    display={fmtK(outputs.valueBridge.exit_value)}
                    bold
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acquisition Summary */}
          {outputs.acquisitions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Acquisition Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-3">Company</th>
                        <th className="text-right py-2 px-2">Revenue</th>
                        <th className="text-right py-2 px-2">EBITDA</th>
                        <th className="text-right py-2 px-2">Multiple</th>
                        <th className="text-right py-2 px-2">EV</th>
                        <th className="text-right py-2 px-2">Equity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outputs.acquisitions.map((a, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1.5 pr-3 font-medium">{a.company}</td>
                          <td className="text-right py-1.5 px-2">{fmtK(a.revenue)}</td>
                          <td className="text-right py-1.5 px-2">{fmtK(a.ebitda)}</td>
                          <td className="text-right py-1.5 px-2">{fmtX(a.multiple)}</td>
                          <td className="text-right py-1.5 px-2">{fmtK(a.ev)}</td>
                          <td className="text-right py-1.5 px-2">{fmtK(a.equity)}</td>
                        </tr>
                      ))}
                      <tr className="font-medium">
                        <td className="py-1.5 pr-3">Total</td>
                        <td className="text-right py-1.5 px-2">
                          {fmtK(outputs.acquisitions.reduce((s, a) => s + a.revenue, 0))}
                        </td>
                        <td className="text-right py-1.5 px-2">
                          {fmtK(outputs.acquisitions.reduce((s, a) => s + a.ebitda, 0))}
                        </td>
                        <td className="text-right py-1.5 px-2">
                          {fmtX(outputs.weighted_entry_multiple)}
                        </td>
                        <td className="text-right py-1.5 px-2">{fmtK(outputs.total_capital_deployed)}</td>
                        <td className="text-right py-1.5 px-2">{fmtK(outputs.total_equity_invested)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Projection Table */}
          <Card>
            <CardHeader className="pb-3">
              <button
                onClick={() => setShowProjection(!showProjection)}
                className="flex w-full items-center justify-between"
              >
                <CardTitle className="text-sm">Combined Projection</CardTitle>
                {showProjection ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CardHeader>
            {showProjection && (
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-3">Year</th>
                        <th className="text-right py-2 px-2"># Cos</th>
                        <th className="text-right py-2 px-2">Revenue</th>
                        <th className="text-right py-2 px-2">EBITDA</th>
                        <th className="text-right py-2 px-2">Synergies</th>
                        <th className="text-right py-2 px-2">FCF</th>
                        <th className="text-right py-2 px-2">Cum FCF</th>
                        <th className="text-right py-2 pl-2">Debt Bal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outputs.projection
                        .filter((p) => p.year <= Math.max(inputs.exit.exit_year, 7))
                        .map((p) => (
                          <tr
                            key={p.year}
                            className={`border-b border-border/50 ${p.year === inputs.exit.exit_year ? "bg-primary/5 font-medium" : ""}`}
                          >
                            <td className="py-1.5 pr-3">{p.year}</td>
                            <td className="text-right py-1.5 px-2">{p.companies_count}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.combined_revenue)}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.adjusted_ebitda)}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.synergies)}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.free_cash_flow)}</td>
                            <td className="text-right py-1.5 px-2">{fmtK(p.cumulative_fcf)}</td>
                            <td className="text-right py-1.5 pl-2">{fmtK(p.remaining_debt)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Exit Summary */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <div className="text-xs text-muted-foreground">Exit EV</div>
                  <div className="text-lg font-bold">{fmtK(outputs.exit_ev)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Less Debt</div>
                  <div className="text-lg font-bold">({fmtK(outputs.remaining_debt_at_exit)})</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">+ Cum FCF</div>
                  <div className="text-lg font-bold">{fmtK(outputs.cumulative_fcf)}</div>
                </div>
                <div className="border-l pl-6">
                  <div className="text-xs text-muted-foreground">Total Return</div>
                  <div className="text-xl font-bold text-primary">{fmtK(outputs.total_return)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">MOIC</div>
                  <div className="text-xl font-bold">{fmtX(outputs.moic)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">IRR</div>
                  <div className="text-xl font-bold">
                    {outputs.irr != null ? fmtPct(outputs.irr) : "N/A"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────

function FieldInput({
  label,
  value,
  onChange,
  prefix,
  type = "number",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  prefix?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`h-8 text-sm ${prefix ? "pl-6" : ""}`}
        />
      </div>
    </div>
  );
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="text-xs font-medium">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
      />
    </div>
  );
}

function BridgeBar({
  label,
  value,
  maxValue,
  color,
  display,
  bold,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  display: string;
  bold?: boolean;
}) {
  const width = maxValue > 0 ? Math.max(2, (value / maxValue) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs w-36 shrink-0 ${bold ? "font-bold" : "text-muted-foreground"}`}>
        {label}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div
          className={`h-5 rounded ${color} transition-all`}
          style={{ width: `${width}%` }}
        />
        <span className={`text-xs shrink-0 ${bold ? "font-bold" : ""}`}>{display}</span>
      </div>
    </div>
  );
}

function MiniKPI({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "emerald" | "blue" | "amber";
}) {
  const borderColor = {
    emerald: "border-emerald-500",
    blue: "border-blue-500",
    amber: "border-amber-500",
  }[color];

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="py-3 px-4">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
