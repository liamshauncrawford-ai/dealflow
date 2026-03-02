"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AlertTriangle } from "lucide-react";

/* ─── Types ─── */

interface TradeCoverage {
  trade: string;
  label: string;
  pipelineCount: number;
  targetCount: number;
}

interface ThesisCoverageProps {
  data: TradeCoverage[];
}

/* ─── Coverage status helpers ─── */

function coverageColor(pipeline: number, targets: number): string {
  if (pipeline + targets === 0) return "#ef4444"; // red — no coverage
  if (pipeline > 0) return "#22c55e"; // green — good coverage
  return "#eab308"; // yellow — targets only
}

function coverageLabel(pipeline: number, targets: number): string {
  if (pipeline + targets === 0) return "No coverage";
  if (pipeline > 0) return "Good";
  return "Targets only";
}

/* ─── Component ─── */

export function ThesisCoverage({ data }: ThesisCoverageProps) {
  const gapTrades = data.filter(
    (d) => d.pipelineCount + d.targetCount === 0,
  );

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: "#22c55e" }}
          />
          <h2 className="font-medium">Thesis Coverage by Trade</h2>
        </div>
        {gapTrades.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" />
            {gapTrades.length} gap{gapTrades.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="p-5">
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No trade data available.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(300, data.length * 36)}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  width={160}
                />
                <Tooltip
                  formatter={(value: number | undefined, name: string | undefined) => [
                    value ?? 0,
                    name === "pipelineCount" ? "Pipeline" : "Targets",
                  ]}
                  labelFormatter={(label) => String(label)}
                />
                <Legend
                  formatter={(value: string) =>
                    value === "pipelineCount" ? "Pipeline" : "Targets"
                  }
                />
                <Bar
                  dataKey="pipelineCount"
                  stackId="coverage"
                  fill="#3b82f6"
                  name="pipelineCount"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="targetCount"
                  stackId="coverage"
                  fill="#8b5cf6"
                  name="targetCount"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Coverage status indicators */}
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
              {data.map((d) => (
                <div key={d.trade} className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: coverageColor(d.pipelineCount, d.targetCount),
                    }}
                  />
                  <span className="text-xs text-muted-foreground truncate">
                    {d.label}
                  </span>
                  <span className="text-xs font-medium ml-auto shrink-0">
                    {coverageLabel(d.pipelineCount, d.targetCount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Gap trades callout */}
            {gapTrades.length > 0 && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/50">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      Coverage Gaps
                    </p>
                    <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
                      No pipeline opportunities or active targets for:{" "}
                      {gapTrades.map((t) => t.label).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
