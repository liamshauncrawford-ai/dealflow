"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  CalendarClock,
  Wallet,
  Target,
  RotateCcw,
  LayoutDashboard,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useStats } from "@/hooks/use-pipeline";
import { formatCurrency, formatRelativeDate, truncate } from "@/lib/utils";
import { ListingSourceBadges } from "@/components/listings/listing-source-badges";
import { SortableDashboardCard } from "@/components/dashboard/sortable-card";
import {
  useDashboardCardOrder,
  DEFAULT_ORDER,
  type DashboardCardId,
} from "@/hooks/use-dashboard-card-order";
import { PipelineFunnelChart } from "@/components/charts/pipeline-funnel-chart";
import { SourceDistributionChart } from "@/components/charts/source-distribution-chart";
import { TierDistributionChart } from "@/components/charts/tier-distribution-chart";
import { DealVelocityWrapper } from "@/components/charts/deal-velocity-wrapper";
import { PipelineValueChart } from "@/components/charts/pipeline-value-chart";
import { IntelligenceFeed } from "@/components/ai/intelligence-feed";
import { WinLossIndicator } from "@/components/charts/win-loss-indicator";
import { DashboardMapCard } from "@/components/dashboard/dashboard-map-card";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DashboardCardProps {
  stats: any;
  isLoading: boolean;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useStats();
  const { order, handleDragEnd, resetOrder } = useDashboardCardOrder();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const cardRegistry: Record<
    DashboardCardId,
    { render: () => React.ReactNode; isVisible: () => boolean }
  > = {
    "intelligence-feed": {
      render: () => <IntelligenceFeed />,
      isVisible: () => true,
    },
    "market-map": {
      render: () => <DashboardMapCard />,
      isVisible: () => true,
    },
    "recent-listings": {
      render: () => <RecentListingsCard stats={stats} isLoading={isLoading} />,
      isVisible: () => true,
    },
    "pipeline-funnel-chart": {
      render: () => (
        <PipelineFunnelChart
          pipelineByStage={stats?.pipelineByStage}
          isLoading={isLoading}
        />
      ),
      isVisible: () => true,
    },
    "source-distribution-chart": {
      render: () => (
        <SourceDistributionChart
          platformCounts={stats?.platformCounts}
          isLoading={isLoading}
        />
      ),
      isVisible: () => true,
    },
    "tier-distribution-chart": {
      render: () => (
        <TierDistributionChart
          tierBreakdown={stats?.tierBreakdown}
          avgFitScore={stats?.avgFitScore}
          isLoading={isLoading}
        />
      ),
      isVisible: () => (stats?.tierBreakdown?.length ?? 0) > 0,
    },
    "deal-velocity-chart": {
      render: () => <DealVelocityWrapper />,
      isVisible: () => true,
    },
    "pipeline-value-chart": {
      render: () => (
        <PipelineValueChart
          pipelineValueByStage={stats?.pipelineValueByStage}
          isLoading={isLoading}
        />
      ),
      isVisible: () => true,
    },
    "win-loss-indicator": {
      render: () => (
        <WinLossIndicator
          wonCount={stats?.wonCount ?? 0}
          lostCount={stats?.lostCount ?? 0}
          winRate={stats?.winRate ?? null}
        />
      ),
      isVisible: () => !isLoading && (stats?.wonCount ?? 0) + (stats?.lostCount ?? 0) > 0,
    },
    "upcoming-follow-ups": {
      render: () => <UpcomingFollowUpsCard stats={stats} isLoading={isLoading} />,
      isVisible: () => true,
    },
    "stale-contacts": {
      render: () => <StaleContactsCard stats={stats} isLoading={isLoading} />,
      isVisible: () => !isLoading && (stats?.staleT1Contacts?.length ?? 0) > 0,
    },
  };

  const visibleCardIds = order.filter((id) => cardRegistry[id]?.isVisible());
  const isCustomOrder = JSON.stringify(order) !== JSON.stringify([...DEFAULT_ORDER]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        icon={LayoutDashboard}
        description="Pipeline overview and actionable intelligence"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Targets"
          value={isLoading ? "..." : String(stats?.totalActive ?? 0)}
          description="Meeting your criteria"
        />
        <StatCard
          label="New This Week"
          value={isLoading ? "..." : String(stats?.newThisWeek ?? 0)}
          description="Newly discovered"
        />
        <StatCard
          label="Pipeline Active"
          value={isLoading ? "..." : String(stats?.pipelineActive ?? 0)}
          description="Opportunities in progress"
        />
        <StatCard
          label="Pipeline Value"
          value={
            isLoading
              ? "..."
              : stats?.pipelineValueLow && stats?.pipelineValueHigh
              ? stats.pipelineValueLow === stats.pipelineValueHigh
                ? formatCurrency(stats.pipelineValueLow)
                : `${formatCurrency(stats.pipelineValueLow)} – ${formatCurrency(stats.pipelineValueHigh)}`
              : "N/A"
          }
          description={
            isLoading
              ? "Calculating..."
              : stats?.pipelineValuedCount
              ? `${stats.pipelineValuedCount} of ${stats.pipelineOppCount} opps valued`
              : "No valued opportunities"
          }
        />
      </div>

      {/* Thesis KPI Cards - Only show if any values exist */}
      {!isLoading && (stats?.capitalDeployed || stats?.platformRevenue || stats?.platformEbitda || stats?.targetMoic) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.capitalDeployed !== null && stats.capitalDeployed !== undefined && (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Capital Deployed</p>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(stats.capitalDeployed)}</p>
            </div>
          )}
          {stats.platformRevenue !== null && stats.platformRevenue !== undefined && (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Platform Revenue</p>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(stats.platformRevenue)}</p>
            </div>
          )}
          {stats.platformEbitda !== null && stats.platformEbitda !== undefined && (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Platform EBITDA</p>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(stats.platformEbitda)}</p>
              {stats.platformValuationLow > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  Valuation: {formatCurrency(stats.platformValuationLow)} ({stats.exitMultipleLow}x)
                  {stats.exitMultipleHigh !== stats.exitMultipleLow && (
                    <> – {formatCurrency(stats.platformValuationHigh)} ({stats.exitMultipleHigh}x)</>
                  )}
                </p>
              )}
            </div>
          )}
          {stats.targetMoic !== null && stats.targetMoic !== undefined && (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Target MOIC ({stats.exitMultipleLow ?? 7}x exit)
                </p>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums">{stats.targetMoic.toFixed(1)}x</p>
            </div>
          )}
        </div>
      )}

      {/* Reset layout button */}
      {isCustomOrder && (
        <div className="flex justify-end">
          <button
            onClick={resetOrder}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset layout
          </button>
        </div>
      )}

      {/* Main content cards — draggable */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => setActiveId(String(event.active.id))}
        onDragEnd={(event) => {
          handleDragEnd(event);
          setActiveId(null);
        }}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={visibleCardIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {visibleCardIds.map((id) => (
              <SortableDashboardCard key={id} id={id}>
                {cardRegistry[id].render()}
              </SortableDashboardCard>
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId && cardRegistry[activeId as DashboardCardId] ? (
            <div className="rounded-xl border bg-card shadow-lg opacity-90 pointer-events-none">
              {cardRegistry[activeId as DashboardCardId].render()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* ─── Card Content Components ─── */

function RecentListingsCard({ stats, isLoading }: DashboardCardProps) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Recent Target Businesses</h2>
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
              className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors"
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
                  <p className="text-sm font-medium tabular-nums">
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
            <p className="text-sm text-muted-foreground">No target businesses yet</p>
            <Link
              href="/listings/add"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Add your first target business
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function UpcomingFollowUpsCard({ stats, isLoading }: DashboardCardProps) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Upcoming Follow-Ups</h2>
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
  );
}

function StaleContactsCard({ stats }: DashboardCardProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Stale Tier 1 Contacts</h2>
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
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
