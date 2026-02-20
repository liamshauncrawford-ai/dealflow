"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

interface SeedCounts {
  industryMultiples: number;
  scrapeSchedules: number;
  thesisListings: number;
  opportunities: number;
  contacts: number;
  emailTemplates: number;
  keywords: number;
}

export function SeedDataCard() {
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["seed-counts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/seed");
      if (!res.ok) throw new Error("Failed to fetch counts");
      return res.json() as Promise<{ counts: SeedCounts }>;
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/seed", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Seed failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setLastResult(
        `Seeded: ${data.results.industryMultiples} multiples, ${data.results.thesisTargets} targets, ${data.results.emailTemplates} templates, ${data.results.searchKeywords} keywords`,
      );
      queryClient.invalidateQueries({ queryKey: ["seed-counts"] });
    },
    onError: (error: Error) => {
      setLastResult(`Error: ${error.message}`);
    },
  });

  const counts = data?.counts;
  const hasData = counts && (counts.thesisListings > 0 || counts.industryMultiples > 0);

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-emerald-600">
          <Database className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Seed Reference Data</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Populate industry multiples, thesis targets, email templates, and search keywords.
            Idempotent — safe to run multiple times.
          </p>

          {/* Current counts */}
          {isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading counts...
            </div>
          ) : counts ? (
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <CountRow label="Industry Multiples" count={counts.industryMultiples} />
              <CountRow label="Scrape Schedules" count={counts.scrapeSchedules} />
              <CountRow label="Thesis Targets" count={counts.thesisListings} />
              <CountRow label="Opportunities" count={counts.opportunities} />
              <CountRow label="Contacts" count={counts.contacts} />
              <CountRow label="Email Templates" count={counts.emailTemplates} />
            </div>
          ) : null}

          {/* Seed button + result */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {seedMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Seeding...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  {hasData ? "Re-seed Data" : "Seed Now"}
                </>
              )}
            </button>

            {lastResult && (
              <span
                className={`text-xs ${
                  lastResult.startsWith("Error")
                    ? "text-red-500"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {lastResult.startsWith("Error") ? (
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                ) : (
                  <CheckCircle className="inline h-3 w-3 mr-1" />
                )}
                {lastResult}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CountRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
        {count}
      </span>
    </div>
  );
}
