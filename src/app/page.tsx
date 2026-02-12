"use client";

import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Briefcase,
  DollarSign,
  ArrowRight,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Target,
  AlertTriangle,
  CalendarClock,
  Wallet,
} from "lucide-react";
import { useStats } from "@/hooks/use-pipeline";
import { useScrapingStatus } from "@/hooks/use-scraping";
import { formatCurrency, formatRelativeDate, truncate } from "@/lib/utils";
import { PIPELINE_STAGES, PLATFORMS, TIERS, type PlatformKey, type TierKey } from "@/lib/constants";
import { ListingSourceBadges } from "@/components/listings/listing-source-badges";

export default function DashboardPage() {
  const { data: stats, isLoading } = useStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome to DealFlow — your acquisition deal sourcing hub
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={BarChart3}
          label="Active Listings"
          value={isLoading ? "..." : String(stats?.totalActive ?? 0)}
          description="Meeting your criteria"
          color="text-primary"
        />
        <StatCard
          icon={TrendingUp}
          label="New This Week"
          value={isLoading ? "..." : String(stats?.newThisWeek ?? 0)}
          description="Newly discovered"
          color="text-success"
        />
        <StatCard
          icon={Briefcase}
          label="Pipeline Active"
          value={isLoading ? "..." : String(stats?.pipelineActive ?? 0)}
          description="Opportunities in progress"
          color="text-info"
        />
        <StatCard
          icon={DollarSign}
          label="Pipeline Value"
          value={
            isLoading
              ? "..."
              : stats?.pipelineValueLow && stats?.pipelineValueHigh
              ? `${formatCurrency(stats.pipelineValueLow)} – ${formatCurrency(stats.pipelineValueHigh)}`
              : "N/A"
          }
          description="Tier 1 target EV range"
          color="text-warning"
        />
      </div>

      {/* Thesis KPI Cards - Only show if any values exist */}
      {!isLoading && (stats?.capitalDeployed || stats?.platformRevenue || stats?.platformEbitda || stats?.targetMoic) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.capitalDeployed !== null && stats.capitalDeployed !== undefined && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Capital Deployed</p>
              </div>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(stats.capitalDeployed)}</p>
            </div>
          )}
          {stats.platformRevenue !== null && stats.platformRevenue !== undefined && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Platform Revenue</p>
              </div>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(stats.platformRevenue)}</p>
            </div>
          )}
          {stats.platformEbitda !== null && stats.platformEbitda !== undefined && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Platform EBITDA</p>
              </div>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(stats.platformEbitda)}</p>
            </div>
          )}
          {stats.targetMoic !== null && stats.targetMoic !== undefined && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Target MOIC</p>
              </div>
              <p className="mt-1 text-xl font-semibold">{stats.targetMoic.toFixed(1)}x</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Listings */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="font-medium">Recent Listings</h2>
            <Link
              href="/listings"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y">
            {isLoading ? (
              <div className="p-5 text-center text-sm text-muted-foreground">Loading...</div>
            ) : stats?.recentListings?.length > 0 ? (
              stats.recentListings.slice(0, 5).map((listing: {
                id: string;
                title: string;
                askingPrice: string | number | null;
                city: string | null;
                state: string | null;
                industry: string | null;
                firstSeenAt: string;
                sources: Array<{ platform: string; sourceUrl: string }>;
              }) => (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{truncate(listing.title, 40)}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {listing.city && <span>{listing.city}, {listing.state}</span>}
                      {listing.industry && <span>- {listing.industry}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ListingSourceBadges sources={listing.sources} />
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {listing.askingPrice
                          ? formatCurrency(Number(listing.askingPrice))
                          : "Price N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeDate(listing.firstSeenAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No listings yet</p>
                <Link
                  href="/listings/add"
                  className="mt-2 inline-block text-sm text-primary hover:underline"
                >
                  Add your first listing
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Summary */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="font-medium">Pipeline Summary</h2>
            <Link
              href="/pipeline"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View pipeline <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-5">
            {isLoading ? (
              <p className="text-center text-sm text-muted-foreground">Loading...</p>
            ) : stats?.pipelineByStage?.length > 0 ? (
              <div className="space-y-2">
                {Object.entries(PIPELINE_STAGES)
                  .filter(([key]) => !["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(key))
                  .map(([key, stage]) => {
                    const stageData = stats.pipelineByStage.find(
                      (s: { stage: string }) => s.stage === key
                    );
                    const count = stageData?.count ?? 0;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                        <span className="flex-1 text-sm">{stage.label}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">No opportunities in pipeline</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add listings to your pipeline to track them here
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tier Breakdown — Thesis KPI */}
        {stats?.tierBreakdown?.length > 0 && (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-medium">Target Tier Breakdown</h2>
              </div>
              {stats?.avgFitScore !== null && stats?.avgFitScore !== undefined && (
                <span className="text-xs text-muted-foreground">
                  Avg Fit Score: <strong className="text-foreground">{stats.avgFitScore}</strong>/100
                </span>
              )}
            </div>
            <div className="p-5">
              <div className="space-y-2">
                {stats.tierBreakdown.map((t: { tier: string; count: number }) => {
                  const tier = TIERS[t.tier as TierKey];
                  if (!tier) return null;
                  return (
                    <div key={t.tier} className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${tier.dotColor}`} />
                      <span className="flex-1 text-sm">{tier.label}</span>
                      <span className="text-sm font-medium">{t.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Follow-Ups */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-medium">Upcoming Follow-Ups</h2>
            </div>
          </div>
          <div className="p-5">
            {isLoading ? (
              <p className="text-center text-sm text-muted-foreground">Loading...</p>
            ) : stats?.upcomingFollowUps?.length > 0 ? (
              <div className="space-y-2">
                {stats.upcomingFollowUps.map((followUp: {
                  contactName: string;
                  opportunityId: string;
                  opportunityTitle: string;
                  followUpDate: string;
                }) => {
                  const followUpDate = new Date(followUp.followUpDate);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  followUpDate.setHours(0, 0, 0, 0);
                  const isUrgent = followUpDate <= today;

                  return (
                    <Link
                      key={followUp.opportunityId}
                      href={`/pipeline/${followUp.opportunityId}`}
                      className="flex items-start gap-2 rounded-md p-2 hover:bg-muted/50 transition-colors"
                    >
                      {isUrgent && (
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{followUp.contactName}</p>
                        <p className="text-xs text-muted-foreground truncate">{followUp.opportunityTitle}</p>
                      </div>
                      <span className={`text-xs whitespace-nowrap ${isUrgent ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                        {formatRelativeDate(followUp.followUpDate)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">No follow-ups scheduled this week</p>
              </div>
            )}
          </div>
        </div>

        {/* Stale Contacts Warning */}
        {!isLoading && stats?.staleT1Contacts?.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                <h2 className="font-medium text-amber-900 dark:text-amber-100">Stale Tier 1 Contacts</h2>
              </div>
              <span className="text-xs text-amber-700 dark:text-amber-400">
                {stats.staleT1Contacts.length} contact{stats.staleT1Contacts.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-5">
              <div className="space-y-2">
                {stats.staleT1Contacts.map((contact: {
                  contactName: string;
                  opportunityId: string;
                  opportunityTitle: string;
                  daysSinceContact: number | null;
                }) => {
                  const isNeverContacted = contact.daysSinceContact === null;
                  const isVeryStale = contact.daysSinceContact && contact.daysSinceContact > 60;

                  return (
                    <Link
                      key={contact.opportunityId}
                      href={`/pipeline/${contact.opportunityId}`}
                      className="flex items-start gap-2 rounded-md p-2 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100 truncate">
                          {contact.contactName}
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 truncate">
                          {contact.opportunityTitle}
                        </p>
                      </div>
                      <span className={`text-xs whitespace-nowrap font-medium ${
                        isNeverContacted || isVeryStale
                          ? 'text-red-600 dark:text-red-500'
                          : 'text-amber-600 dark:text-amber-500'
                      }`}>
                        {isNeverContacted ? 'Never contacted' : `${contact.daysSinceContact}d ago`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Platform Breakdown */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-3">
            <h2 className="font-medium">Listings by Platform</h2>
          </div>
          <div className="p-5">
            {isLoading ? (
              <p className="text-center text-sm text-muted-foreground">Loading...</p>
            ) : stats?.platformCounts?.length > 0 ? (
              <div className="space-y-2">
                {stats.platformCounts.map((p: { platform: string; count: number }) => {
                  const platform = PLATFORMS[p.platform as PlatformKey];
                  if (!platform) return null;
                  return (
                    <div key={p.platform} className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: platform.color }}
                      />
                      <span className="flex-1 text-sm">{platform.label}</span>
                      <span className="text-sm font-medium">{p.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No scraped listings yet. Set up your scrapers in Settings.
              </p>
            )}
          </div>
        </div>

        {/* Scraper Health / Data Freshness */}
        <ScraperHealthCard />
      </div>
    </div>
  );
}

function ScraperHealthCard() {
  const { data: status, isLoading: statusLoading } = useScrapingStatus();

  // Build per-platform last-run info
  const platformHealth = Object.entries(PLATFORMS)
    .filter(([key]) => key !== "MANUAL")
    .map(([key, platform]) => {
      const latestRun = status?.recentRuns?.find(
        (r) => r.platform === key && r.status === "COMPLETED"
      );
      const isRunning = status?.runningRuns?.some((r) => r.platform === key);
      const schedule = status?.schedules?.find((s) => s.platform === key);

      let freshness: "fresh" | "stale" | "old" | "never" = "never";
      if (latestRun?.completedAt) {
        const hoursAgo =
          (Date.now() - new Date(latestRun.completedAt).getTime()) /
          (1000 * 60 * 60);
        if (hoursAgo < 24) freshness = "fresh";
        else if (hoursAgo < 72) freshness = "stale";
        else freshness = "old";
      }

      return {
        key,
        label: platform.label,
        color: platform.color,
        latestRun,
        isRunning,
        schedule,
        freshness,
      };
    });

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Scraper Health</h2>
        </div>
        <Link
          href="/settings/scraping"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Settings <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y">
        {statusLoading ? (
          <div className="p-5 text-center text-sm text-muted-foreground">
            Loading scraper status...
          </div>
        ) : (
          platformHealth.map((p) => (
            <div
              key={p.key}
              className="flex items-center gap-3 px-5 py-2.5"
            >
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="flex-1 text-sm">{p.label}</span>
              <div className="flex items-center gap-2">
                {p.isRunning ? (
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Running
                  </span>
                ) : p.freshness === "fresh" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {p.latestRun?.completedAt
                      ? formatRelativeDate(p.latestRun.completedAt)
                      : "Fresh"}
                  </span>
                ) : p.freshness === "stale" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                    <Clock className="h-3 w-3" />
                    {p.latestRun?.completedAt
                      ? formatRelativeDate(p.latestRun.completedAt)
                      : "Stale"}
                  </span>
                ) : p.freshness === "old" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {p.latestRun?.completedAt
                      ? formatRelativeDate(p.latestRun.completedAt)
                      : "Old"}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Never scraped
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  description: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className={`rounded-md bg-muted p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
