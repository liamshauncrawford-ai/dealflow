"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Mail,
  Play,
  Loader2,
  ExternalLink,
  Info,
  Zap,
  Building2,
  Shield,
} from "lucide-react";
import { useScrapingStatus } from "@/hooks/use-scraping";
import { PLATFORMS, type PlatformKey } from "@/lib/constants";
import { cn, formatRelativeDate } from "@/lib/utils";

const SCRAPING_PLATFORMS: PlatformKey[] = [
  "BIZBUYSELL",
  "BIZQUEST",
  "DEALSTREAM",
  "TRANSWORLD",
  "LOOPNET",
  "BUSINESSBROKER",
];

const PLATFORM_ALERT_SETUP: Record<string, { hasAlerts: boolean; signupUrl: string; instructions: string }> = {
  BIZBUYSELL: {
    hasAlerts: true,
    signupUrl: "https://www.bizbuysell.com/saved-searches/",
    instructions: "Create a saved search to receive email alerts for new listings",
  },
  BIZQUEST: {
    hasAlerts: true,
    signupUrl: "https://www.bizquest.com/saved-searches/",
    instructions: "Set up saved search alerts to get listings emailed to you",
  },
  DEALSTREAM: {
    hasAlerts: true,
    signupUrl: "https://www.dealstream.com/search-genius",
    instructions: "Enable 'Search Genius' alerts to receive daily listing digests",
  },
  TRANSWORLD: {
    hasAlerts: true,
    signupUrl: "https://www.tworld.com/",
    instructions: "Subscribe to listing alerts for your target criteria",
  },
  LOOPNET: {
    hasAlerts: true,
    signupUrl: "https://www.loopnet.com/",
    instructions: "Create saved searches for commercial property alerts",
  },
  BUSINESSBROKER: {
    hasAlerts: false,
    signupUrl: "https://www.businessbroker.net/",
    instructions: "Email alerts not currently available for this platform",
  },
};

export default function ScrapingSettingsPage() {
  const { data: status, isLoading } = useScrapingStatus();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    synced?: number;
    newListingsFound?: number;
    error?: string;
  } | null>(null);
  const [scrapingAll, setScrapingAll] = useState(false);
  const [scrapeAllResult, setScrapeAllResult] = useState<{
    results?: Record<string, unknown>;
    errors?: number;
    error?: string;
  } | null>(null);

  const getLatestRun = (platform: string) =>
    status?.recentRuns?.find((r) => r.platform === platform);

  const handleSyncAndParse = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      // First, trigger email sync (which auto-parses listing alerts)
      const emailRes = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "cmle1bm1y0000v6ud3b0kh2z0" }),
      });

      if (!emailRes.ok) {
        const err = await emailRes.json();
        setSyncResult({ error: err.error || "Email sync failed" });
        return;
      }

      const data = await emailRes.json();
      setSyncResult({
        synced: data.synced?.synced ?? 0,
        newListingsFound: data.newListingsFound ?? 0,
      });
    } catch (err) {
      setSyncResult({ error: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setSyncing(false);
    }
  };

  const handleScrapeAll = async () => {
    setScrapingAll(true);
    setScrapeAllResult(null);
    try {
      const res = await fetch("/api/scraping/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scrape_all" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScrapeAllResult({ error: data.error || "Scrape all failed" });
        return;
      }
      setScrapeAllResult({ results: data.results, errors: data.errors });
    } catch (err) {
      setScrapeAllResult({ error: err instanceof Error ? err.message : "Failed" });
    } finally {
      setScrapingAll(false);
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
        <span className="font-medium text-foreground">Listing Sources</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Listing Sources</h1>
          <p className="text-sm text-muted-foreground">
            Manage how listings are discovered from each platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAndParse}
            disabled={syncing || scrapingAll}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Sync Gmail
          </button>
          <button
            onClick={handleScrapeAll}
            disabled={scrapingAll || syncing}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {scrapingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Scrape All Sources
          </button>
        </div>
      </div>

      {/* Sync result toast */}
      {syncResult && (
        <div className={cn(
          "rounded-lg border p-3 text-sm",
          syncResult.error
            ? "border-destructive/30 bg-destructive/5 text-destructive"
            : "border-success/30 bg-success/5 text-success"
        )}>
          {syncResult.error ? (
            <p>{syncResult.error}</p>
          ) : (
            <p>
              Synced {syncResult.synced} emails
              {syncResult.newListingsFound
                ? ` — found ${syncResult.newListingsFound} new listings`
                : " — no new listings found"}
            </p>
          )}
        </div>
      )}

      {/* Scrape All result toast */}
      {scrapeAllResult && (
        <div className={cn(
          "rounded-lg border p-3 text-sm",
          scrapeAllResult.error
            ? "border-destructive/30 bg-destructive/5 text-destructive"
            : "border-success/30 bg-success/5 text-success"
        )}>
          {scrapeAllResult.error ? (
            <p>{scrapeAllResult.error}</p>
          ) : (
            <div>
              <p className="font-medium">All sources scraped successfully</p>
              {scrapeAllResult.errors !== undefined && scrapeAllResult.errors > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {scrapeAllResult.errors} non-critical errors occurred
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* How It Works */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-4">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 text-info shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-info">How Listing Discovery Works</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Listings are discovered through your email alert subscriptions. Set up
              saved searches on each platform below — when they email you new listings,
              DealFlow automatically syncs and parses them into your pipeline.
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>Sign up for email alerts on each platform (links below)</li>
              <li>Connect your Gmail account in{" "}
                <Link href="/settings/email" className="text-info hover:underline">Email Settings</Link>
              </li>
              <li>Click &quot;Sync Gmail &amp; Parse Alerts&quot; or wait for automatic sync</li>
              <li>New listings appear in your{" "}
                <Link href="/listings" className="text-info hover:underline">Listings</Link>
                {" "}page
              </li>
            </ol>
          </div>
        </div>
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
            const latestRun = getLatestRun(platformKey);
            const alertSetup = PLATFORM_ALERT_SETUP[platformKey];

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
                    <DataSourceBadge hasAlerts={alertSetup?.hasAlerts ?? false} />
                  </div>
                  {alertSetup?.hasAlerts && (
                    <a
                      href={alertSetup.signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Set Up Alerts
                    </a>
                  )}
                </div>

                {/* Platform body */}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Alert setup info */}
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        Email Alert Status
                      </h4>
                      {alertSetup?.hasAlerts ? (
                        <p className="text-sm text-muted-foreground">
                          {alertSetup.instructions}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          {alertSetup?.instructions ?? "No email alerts available"}
                        </p>
                      )}
                    </div>

                    {/* Latest Run */}
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        Latest Scrape Run
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

      {/* Public Records Sources */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Public Records Sources</h2>
        <p className="text-sm text-muted-foreground">
          Government databases searched for potential acquisition targets and license enrichment data.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Colorado Secretary of State */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-blue-500" />
              <h3 className="font-medium">Colorado Secretary of State</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              Discovery
            </span>
          </div>
          <div className="px-5 py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Searches registered Colorado businesses for trade keywords across all 11 target
              commercial service categories to discover potential acquisition targets.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>20 search terms</span>
              <span>Weekly schedule</span>
            </div>
          </div>
        </div>

        {/* DORA License Lookup */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-emerald-500" />
              <h3 className="font-medium">DORA License Lookup</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Enrichment
            </span>
          </div>
          <div className="px-5 py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Cross-references contractor licenses (electrical, low voltage, fire alarm, security)
              with existing listings. Flags expiring licenses as exit signals.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>4 license types</span>
              <span>Weekly schedule</span>
            </div>
          </div>
        </div>
      </div>

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

function DataSourceBadge({ hasAlerts }: { hasAlerts: boolean }) {
  if (hasAlerts) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-xs text-info">
        <Mail className="h-3 w-3" />
        Email Alerts
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      No Alerts
    </span>
  );
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
