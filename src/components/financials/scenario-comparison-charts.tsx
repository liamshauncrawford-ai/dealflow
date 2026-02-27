"use client";

import { useMemo } from "react";
import {
  TrendingUp,
  DollarSign,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ValuationInputs, ValuationOutputs } from "@/lib/financial/valuation-engine";
import { ChartCard } from "@/components/charts/chart-card";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ChartScenario {
  id: string;
  name: string;
  color: string;
  inputs: ValuationInputs;
  outputs: ValuationOutputs;
}

interface ScenarioComparisonChartsProps {
  scenarios: ChartScenario[];
}

// ─────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────

function fmtK(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tooltipFormatter(value: any): string {
  return fmtK(Number(value));
}

// ─────────────────────────────────────────────
// Data transformers
// ─────────────────────────────────────────────

function buildProjectionData(scenarios: ChartScenario[], field: "revenue" | "adjusted_ebitda") {
  const maxYear = Math.max(...scenarios.map((s) => s.inputs.exit_year));
  const data: Record<string, unknown>[] = [];

  for (let y = 1; y <= maxYear; y++) {
    const point: Record<string, unknown> = { year: y };
    for (const s of scenarios) {
      const yearData = s.outputs.projection.find((p) => p.year === y);
      if (yearData) {
        point[`${s.name} ${field === "revenue" ? "Revenue" : "EBITDA"}`] = yearData[field];
      }
    }
    data.push(point);
  }

  return data;
}

function buildFcfDebtData(scenarios: ChartScenario[]) {
  const maxYear = Math.max(...scenarios.map((s) => s.inputs.exit_year));
  const data: Record<string, unknown>[] = [];

  for (let y = 1; y <= maxYear; y++) {
    const point: Record<string, unknown> = { year: y };
    for (const s of scenarios) {
      const yearData = s.outputs.projection.find((p) => p.year === y);
      if (yearData) {
        point[`${s.name} Cum FCF`] = yearData.cumulative_fcf;
        point[`${s.name} Debt`] = yearData.remaining_debt;
      }
    }
    data.push(point);
  }

  return data;
}

function buildCapitalData(scenarios: ChartScenario[]) {
  return scenarios.map((s) => ({
    name: s.name,
    equity: s.outputs.deal.equity_check,
    bankDebt: s.outputs.deal.bank_debt,
    sellerNote: s.outputs.deal.seller_note,
  }));
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function ScenarioComparisonCharts({ scenarios }: ScenarioComparisonChartsProps) {
  const revenueData = useMemo(() => buildProjectionData(scenarios, "revenue"), [scenarios]);
  const ebitdaData = useMemo(() => buildProjectionData(scenarios, "adjusted_ebitda"), [scenarios]);
  const fcfDebtData = useMemo(() => buildFcfDebtData(scenarios), [scenarios]);
  const capitalData = useMemo(() => buildCapitalData(scenarios), [scenarios]);

  if (scenarios.length < 2) return null;

  return (
    <div className="space-y-4">
      {/* Chart 1: Revenue & EBITDA Projection Overlay */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Revenue Projections" icon={TrendingUp} minHeight={320}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `Y${v}`}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {scenarios.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={`${s.name} Revenue`}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                name={`${s.name}`}
              />
            ))}
          </LineChart>
        </ChartCard>

        <ChartCard title="EBITDA Projections" icon={TrendingUp} minHeight={320}>
          <LineChart data={ebitdaData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `Y${v}`}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {scenarios.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={`${s.name} EBITDA`}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                name={`${s.name}`}
              />
            ))}
          </LineChart>
        </ChartCard>
      </div>

      {/* Chart 2: Cumulative FCF & Debt Paydown */}
      <ChartCard title="Cumulative FCF & Debt Paydown" icon={DollarSign} minHeight={320}>
        <AreaChart data={fcfDebtData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `Y${v}`}
          />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
          <Tooltip formatter={tooltipFormatter} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {scenarios.map((s) => (
            <Area
              key={`fcf-${s.id}`}
              type="monotone"
              dataKey={`${s.name} Cum FCF`}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.15}
              strokeWidth={2}
              name={`${s.name} FCF`}
            />
          ))}
          {scenarios.map((s) => (
            <Line
              key={`debt-${s.id}`}
              type="monotone"
              dataKey={`${s.name} Debt`}
              stroke={s.color}
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              name={`${s.name} Debt`}
            />
          ))}
        </AreaChart>
      </ChartCard>

      {/* Chart 3: Capital Structure Comparison */}
      <ChartCard title="Capital Structure" icon={Layers} minHeight={Math.max(200, scenarios.length * 60 + 80)}>
        <BarChart layout="vertical" data={capitalData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={fmtK} />
          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
          <Tooltip formatter={tooltipFormatter} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="equity" stackId="cap" fill="#3b82f6" name="Equity" />
          <Bar dataKey="bankDebt" stackId="cap" fill="#f59e0b" name="Bank Debt" />
          <Bar dataKey="sellerNote" stackId="cap" fill="#94a3b8" name="Seller Note" />
        </BarChart>
      </ChartCard>
    </div>
  );
}
