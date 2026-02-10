"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Cookie,
  Play,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  useScrapingStatus,
  useTriggerScrape,
  useSaveCookies,
  useDeleteCookies,
  useUpdateSchedule,
} from "@/hooks/use-scraping";
import { PLATFORMS, type PlatformKey } from "@/lib/constants";
import { cn, formatDate, formatRelativeDate } from "@/lib/utils";

const SCRAPING_PLATFORMS: PlatformKey[] = [
  "BIZBUYSELL",
  "BIZQUEST",
  "DEALSTREAM",
  "TRANSWORLD",
  "LOOPNET",
  "BUSINESSBROKER",
];

export default function ScrapingSettingsPage() {
  const { data: status, isLoading } = useScrapingStatus();
  const triggerScrape = useTriggerScrape();
  const saveCookies = useSaveCookies();
  const deleteCookies = useDeleteCookies();
  const updateSchedule = useUpdateSchedule();
  const [cookieInput, setCookieInput] = useState<{ platform: string; value: string } | null>(null);

  const getSchedule = (platform: string) =>
    status?.schedules?.find((s) => s.platform === platform);

  const getLatestRun = (platform: string) =>
    status?.recentRuns?.find((r) => r.platform === platform);

  const isRunning = (platform: string) =>
    status?.runningRuns?.some((r) => r.platform === platform);

  const handleSaveCookies = async (platform: string) => {
    if (!cookieInput?.value) return;

    try {
      // Parse the pasted cookie JSON
      const cookies = JSON.parse(cookieInput.value);
      if (!Array.isArray(cookies)) {
        alert("Cookies must be a JSON array");
        return;
      }
      await saveCookies.mutateAsync({ platform, cookies });
      setCookieInput(null);
    } catch (err) {
      // If it's not JSON, try parsing as a cookie header string (name=value; name=value)
      try {
        const cookieStr = cookieInput.value;
        const cookies = cookieStr.split(";").map((c) => {
          const [name, ...rest] = c.trim().split("=");
          return {
            name: name.trim(),
            value: rest.join("=").trim(),
            domain: getDomainForPlatform(platform),
            path: "/",
          };
        }).filter((c) => c.name && c.value);

        if (cookies.length === 0) {
          alert("Could not parse cookies. Please paste a JSON array or cookie header string.");
          return;
        }

        await saveCookies.mutateAsync({ platform, cookies });
        setCookieInput(null);
      } catch {
        alert("Could not parse cookies. Please paste a JSON array or a cookie header string (name=value; name=value).");
      }
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/settings" className="hover:text-foreground">Settings</Link>
        <span>/</span>
        <span className="font-medium text-foreground">Scraping Configuration</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Scraping Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Manage platform logins, scrape schedules, and trigger manual scrapes
          </p>
        </div>
          <button
            onClick={() => triggerScrape.mutate(undefined)}
            disabled={triggerScrape.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {triggerScrape.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Scrape All Platforms
          </button>
      </div>

      {/* How It Works */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-4">
        <h3 className="text-sm font-medium text-info">How Cookie Authentication Works</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Open the platform website in your normal browser and log in</li>
          <li>Open DevTools (Cmd+Opt+I), go to Application &gt; Cookies</li>
          <li>Copy the cookie data (JSON export or as header string)</li>
          <li>Paste it below for the corresponding platform</li>
          <li>The scraper will use these cookies to access authenticated content</li>
        </ol>
      </div>

      {/* Platform Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {SCRAPING_PLATFORMS.map((platformKey) => {
            const platform = PLATFORMS[platformKey];
            const schedule = getSchedule(platformKey);
            const latestRun = getLatestRun(platformKey);
            const running = isRunning(platformKey);

            return (
              <div
                key={platformKey}
                className="rounded-lg border bg-card overflow-hidden"
              >
                {/* Platform header */}
                <div className="flex items-center justify-between border-b px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: platform.color }}
                    />
                    <h3 className="font-medium">{platform.label}</h3>
                    <CookieStatusBadge platform={platformKey} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerScrape.mutate(platformKey)}
                      disabled={running || triggerScrape.isPending}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                        running
                          ? "bg-warning/10 text-warning"
                          : "border hover:bg-muted"
                      )}
                    >
                      {running ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Scraping...
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          Scrape Now
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Platform body */}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Cookie management */}
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        Cookies
                      </h4>
                      {cookieInput?.platform === platformKey ? (
                        <div className="space-y-2">
                          <textarea
                            value={cookieInput.value}
                            onChange={(e) =>
                              setCookieInput({ ...cookieInput, value: e.target.value })
                            }
                            placeholder='Paste cookies here... (JSON array or "name=value; name=value" format)'
                            rows={3}
                            className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveCookies(platformKey)}
                              disabled={saveCookies.isPending}
                              className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                            >
                              {saveCookies.isPending ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => setCookieInput(null)}
                              className="rounded-md border px-3 py-1 text-xs hover:bg-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setCookieInput({ platform: platformKey, value: "" })
                            }
                            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                          >
                            <Cookie className="h-3 w-3" />
                            Paste Cookies
                          </button>
                          <button
                            onClick={() => deleteCookies.mutate(platformKey)}
                            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-destructive hover:bg-destructive/5 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Clear
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Schedule */}
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        Schedule
                      </h4>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={schedule?.isEnabled ?? false}
                            onChange={(e) =>
                              updateSchedule.mutate({
                                platform: platformKey,
                                isEnabled: e.target.checked,
                              })
                            }
                            className="rounded"
                          />
                          Enabled
                        </label>
                        {schedule && (
                          <span className="text-xs text-muted-foreground">
                            ({schedule.cronExpression})
                          </span>
                        )}
                      </div>
                      {schedule?.lastRunAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Last: {formatRelativeDate(schedule.lastRunAt)}
                        </p>
                      )}
                    </div>

                    {/* Latest Run */}
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        Latest Run
                      </h4>
                      {latestRun ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <RunStatusIcon status={latestRun.status} />
                            <span className="text-sm capitalize">
                              {latestRun.status.toLowerCase()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeDate(latestRun.createdAt)}
                            </span>
                          </div>
                          {latestRun.status === "COMPLETED" && (
                            <p className="text-xs text-muted-foreground">
                              Found {latestRun.listingsFound} | New{" "}
                              {latestRun.listingsNew} | Updated{" "}
                              {latestRun.listingsUpdated}
                              {latestRun.errors > 0 && (
                                <span className="text-destructive">
                                  {" "}
                                  | {latestRun.errors} errors
                                </span>
                              )}
                            </p>
                          )}
                          {latestRun.status === "FAILED" && latestRun.errorLog && (
                            <p className="text-xs text-destructive truncate max-w-[200px]">
                              {latestRun.errorLog}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No runs yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Runs Table */}
      {status?.recentRuns && status.recentRuns.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-3">
            <h2 className="font-medium">Recent Scrape Runs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Platform</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Trigger</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Found</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">New</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Updated</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Errors</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">When</th>
                </tr>
              </thead>
              <tbody>
                {status.recentRuns.map((run) => (
                  <tr key={run.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-medium">
                        {PLATFORMS[run.platform as PlatformKey]?.label ?? run.platform}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <RunStatusIcon status={run.status} />
                        <span className="capitalize text-xs">
                          {run.status.toLowerCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground capitalize">
                      {run.triggeredBy}
                    </td>
                    <td className="px-4 py-2">{run.listingsFound}</td>
                    <td className="px-4 py-2 text-success">{run.listingsNew}</td>
                    <td className="px-4 py-2">{run.listingsUpdated}</td>
                    <td className="px-4 py-2">
                      {run.errors > 0 ? (
                        <span className="text-destructive">{run.errors}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {formatRelativeDate(run.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CookieStatusBadge({ platform }: { platform: string }) {
  // We'll just show a simple inline status — the parent component handles the actual data
  // This is a placeholder that could be enhanced with useCookieStatus hook
  return null; // Cookie status is shown in the card body
}

function RunStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "COMPLETED":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "FAILED":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "RUNNING":
      return <Loader2 className="h-4 w-4 animate-spin text-info" />;
    case "PENDING":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getDomainForPlatform(platform: string): string {
  const domains: Record<string, string> = {
    BIZBUYSELL: ".bizbuysell.com",
    BIZQUEST: ".bizquest.com",
    DEALSTREAM: ".dealstream.com",
    TRANSWORLD: ".tworld.com",
    LOOPNET: ".loopnet.com",
    BUSINESSBROKER: ".businessbroker.net",
  };
  return domains[platform] || "";
}
