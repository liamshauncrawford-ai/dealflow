"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bot,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Zap,
  Newspaper,
  BarChart3,
  Search,
  Building2,
  Shield,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatRelativeDate } from "@/lib/utils";
import { useAnthropicUsage } from "@/hooks/use-anthropic-usage";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AgentRun {
  id: string;
  agentName: string;
  status: string;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  apiCallsMade: number;
  totalTokens: number;
  totalCost: number;
  errorMessage: string | null;
  summary: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface AgentRunsResponse {
  runs: AgentRun[];
  total: number;
  page: number;
  totalPages: number;
}

// ─────────────────────────────────────────────
// Agent metadata
// ─────────────────────────────────────────────

const AGENT_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    schedule: string;
    endpoint: string;
    color: string;
  }
> = {
  daily_scan: {
    label: "Daily Target Scan",
    icon: Search,
    schedule: "Daily @ 6:00 AM MT",
    endpoint: "/api/cron/daily-scan",
    color: "text-blue-500",
  },
  news_monitor: {
    label: "News Monitor",
    icon: Newspaper,
    schedule: "Every 6 hours",
    endpoint: "/api/cron/news-monitor",
    color: "text-amber-500",
  },
  market_pulse: {
    label: "Market Pulse",
    icon: BarChart3,
    schedule: "Weekly — Sun 8 PM MT",
    endpoint: "/api/cron/market-pulse",
    color: "text-violet-500",
  },
  csos_scan: {
    label: "CSOS Discovery",
    icon: Building2,
    schedule: "Weekly",
    endpoint: "/api/cron/csos-scan",
    color: "text-blue-400",
  },
  dora_scan: {
    label: "DORA License Scan",
    icon: Shield,
    schedule: "Weekly",
    endpoint: "/api/cron/dora-scan",
    color: "text-emerald-400",
  },
  dedup_scan: {
    label: "Dedup Scanner",
    icon: Copy,
    schedule: "Weekly",
    endpoint: "/api/cron/dedup-scan",
    color: "text-orange-500",
  },
  market_metrics: {
    label: "Market Metrics",
    icon: BarChart3,
    schedule: "Daily @ midnight",
    endpoint: "/api/cron/market-metrics",
    color: "text-teal-500",
  },
  valuation_commentary: {
    label: "Valuation Commentary",
    icon: DollarSign,
    schedule: "On-demand",
    endpoint: "",
    color: "text-emerald-500",
  },
};

const ALL_AGENTS = Object.keys(AGENT_CONFIG);

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function AgentDashboardPage() {
  const [page, setPage] = useState(1);
  const [agentFilter, setAgentFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { data, isLoading, refetch } = useQuery<AgentRunsResponse>({
    queryKey: ["agent-runs", page, agentFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (agentFilter) params.set("agentName", agentFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/ai/agent-runs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch agent runs");
      return res.json();
    },
  });

  const runs = data?.runs ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Manual trigger — calls cron endpoints directly. Session cookie
  // passes automatically (same-origin fetch). Routes accept either
  // CRON_SECRET (Railway scheduler) or session cookie (dashboard).
  const triggerAgent = useMutation({
    mutationFn: async (endpoint: string) => {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Agent trigger failed");
      }
      return res.json();
    },
    onSuccess: () => {
      // Refetch runs after a short delay so the new run appears
      setTimeout(() => refetch(), 2000);
    },
  });

  // Summary stats — prefer real Anthropic data, fall back to local estimates
  const { data: usage } = useAnthropicUsage();
  const localStats = computeStats(runs);
  const isLiveData = usage?.source === "anthropic";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">AI Agent Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor background agents, costs, and execution history.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Agent Cards — one per agent with trigger button */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ALL_AGENTS.filter((a) => AGENT_CONFIG[a].endpoint).map((agentName) => {
          const config = AGENT_CONFIG[agentName];
          const Icon = config.icon;
          const isRunning = triggerAgent.isPending;

          return (
            <Card key={agentName} className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", config.color)} />
                    <CardTitle className="text-base">{config.label}</CardTitle>
                  </div>
                  <button
                    onClick={() => triggerAgent.mutate(config.endpoint)}
                    disabled={isRunning}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Play className="h-3 w-3" />
                    Run Now
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {config.schedule}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total Runs"
          value={data?.total ?? 0}
          icon={Zap}
          color="text-blue-500"
        />
        <StatCard
          label="Success Rate"
          value={localStats.successRate}
          suffix="%"
          icon={CheckCircle2}
          color="text-emerald-500"
        />
        <StatCard
          label={isLiveData ? "API Spend (30d)" : "Total Cost"}
          value={`$${(usage?.totalCostUsd ?? localStats.totalCost).toFixed(2)}`}
          icon={DollarSign}
          color="text-amber-500"
          badge={isLiveData ? "Live" : usage ? "Estimated" : undefined}
        />
        <StatCard
          label={isLiveData ? "Tokens (30d)" : "Total Tokens"}
          value={formatNumber(usage?.totalTokens ?? localStats.totalTokens)}
          icon={Bot}
          color="text-violet-500"
          badge={isLiveData ? "Live" : usage ? "Estimated" : undefined}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={agentFilter ?? ""}
          onChange={(e) => {
            setAgentFilter(e.target.value || undefined);
            setPage(1);
          }}
          className="rounded border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">All Agents</option>
          {ALL_AGENTS.map((name) => (
            <option key={name} value={name}>
              {AGENT_CONFIG[name]?.label ?? name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter ?? ""}
          onChange={(e) => {
            setStatusFilter(e.target.value || undefined);
            setPage(1);
          }}
          className="rounded border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="running">Running</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      {/* Runs Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        </div>
      ) : runs.length === 0 ? (
        <div className="py-16 text-center">
          <Bot className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No agent runs yet. Trigger an agent above or wait for scheduled execution.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Agent</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Summary</th>
                <th className="px-4 py-3 text-right font-medium">Items</th>
                <th className="px-4 py-3 text-right font-medium">Tokens</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const config = AGENT_CONFIG[run.agentName];
                const Icon = config?.icon ?? Bot;
                return (
                  <tr key={run.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", config?.color ?? "text-muted-foreground")} />
                        <span className="font-medium">{config?.label ?? run.agentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="max-w-[300px] truncate px-4 py-3 text-muted-foreground">
                      {run.errorMessage || run.summary || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {run.itemsProcessed}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumber(run.totalTokens)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ${run.totalCost.toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatRelativeDate(run.startedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Trigger error toast */}
      {triggerAgent.isError && (
        <div className="fixed bottom-4 right-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            {triggerAgent.error?.message || "Agent trigger failed"}
          </div>
        </div>
      )}

      {triggerAgent.isSuccess && (
        <div className="fixed bottom-4 right-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-lg dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Agent completed successfully
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ComponentType<{ className?: string }>; className: string; label: string }> = {
    success: {
      icon: CheckCircle2,
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      label: "Success",
    },
    error: {
      icon: XCircle,
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      label: "Error",
    },
    running: {
      icon: RefreshCw,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      label: "Running",
    },
    partial: {
      icon: AlertTriangle,
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      label: "Partial",
    },
  };

  const c = config[status] ?? config.error;
  const Icon = c.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", c.className)}>
      <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
      {c.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  color,
  badge,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("rounded-lg bg-muted p-2.5", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            {badge && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  badge === "Live"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                )}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-xl font-bold tabular-nums">
            {value}{suffix}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function computeStats(runs: AgentRun[]) {
  const total = runs.length;
  const successes = runs.filter((r) => r.status === "success").length;
  return {
    successRate: total > 0 ? Math.round((successes / total) * 100) : 100,
    totalCost: runs.reduce((s, r) => s + r.totalCost, 0),
    totalTokens: runs.reduce((s, r) => s + r.totalTokens, 0),
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
