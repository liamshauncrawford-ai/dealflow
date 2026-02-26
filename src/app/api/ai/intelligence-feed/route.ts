import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/ai/intelligence-feed
 * Returns a unified feed of recent AI-relevant events:
 * - High-priority notifications (HIGH_SCORE_DISCOVERY, DC_PROJECT_NEWS, etc.)
 * - Recent AI analyses (deep dives, enrichments)
 * - Recent agent runs
 * - Recent news items (when populated)
 *
 * Query params:
 *   limit — max items (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "20", 10),
      50
    );

    // Fetch from multiple sources in parallel
    const [notifications, analyses, agentRuns, newsItems] = await Promise.all([
      // Recent high-value notifications
      prisma.notification.findMany({
        where: {
          type: {
            in: [
              "HIGH_SCORE_DISCOVERY",
              "DC_PROJECT_NEWS",
              "SCORE_CHANGE",
              "ENRICHMENT_COMPLETE",
              "WEEKLY_BRIEF",
              "LEGISLATION_UPDATE",
              "NEW_LISTING",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { listing: { select: { id: true, title: true, businessName: true, compositeScore: true } } },
      }),

      // Recent AI analyses
      prisma.aIAnalysisResult.findMany({
        where: { analysisType: { in: ["DEEP_DIVE", "ENRICHMENT"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          listing: { select: { id: true, title: true, businessName: true, compositeScore: true } },
        },
      }),

      // Recent agent runs
      prisma.aIAgentRun.findMany({
        where: { status: { in: ["success", "partial"] } },
        orderBy: { startedAt: "desc" },
        take: 10,
      }),

      // Recent news items (empty until News Monitor agent is built in Phase 4)
      prisma.newsItem.findMany({
        orderBy: { fetchedAt: "desc" },
        take: 10,
      }),
    ]);

    // Transform into unified feed items
    type FeedItem = {
      id: string;
      type: string;
      priority: "high" | "normal" | "low";
      icon: string;
      title: string;
      description: string;
      timestamp: string;
      entityType?: string;
      entityId?: string;
      actionUrl?: string;
      metadata?: Record<string, unknown>;
    };

    const feedItems: FeedItem[] = [];

    // Notifications → feed items
    for (const n of notifications) {
      feedItems.push({
        id: `notif-${n.id}`,
        type: n.type,
        priority: (n.priority as "high" | "normal" | "low") ?? "normal",
        icon: getNotificationIcon(n.type),
        title: n.title ?? n.type,
        description: n.message ?? "",
        timestamp: n.createdAt.toISOString(),
        entityType: n.entityType ?? undefined,
        entityId: n.entityId ?? undefined,
        actionUrl: n.actionUrl ?? (n.listingId ? `/listings/${n.listingId}` : undefined),
        metadata: n.listing
          ? { listingName: n.listing.businessName || n.listing.title, score: n.listing.compositeScore }
          : undefined,
      });
    }

    // AI analyses → feed items
    for (const a of analyses) {
      const listingName = a.listing?.businessName || a.listing?.title || "Unknown";
      feedItems.push({
        id: `analysis-${a.id}`,
        type: a.analysisType === "DEEP_DIVE" ? "DEEP_DIVE_COMPLETE" : "ENRICHMENT_COMPLETE",
        priority: "normal",
        icon: a.analysisType === "DEEP_DIVE" ? "🤖" : "🔍",
        title:
          a.analysisType === "DEEP_DIVE"
            ? `AI Deep Dive: ${listingName}`
            : `Enrichment Complete: ${listingName}`,
        description:
          a.analysisType === "DEEP_DIVE"
            ? `Investment memo generated — Score: ${a.listing?.compositeScore ?? "N/A"}`
            : `Research complete for ${listingName}`,
        timestamp: a.createdAt.toISOString(),
        entityType: "listing",
        entityId: a.listingId ?? undefined,
        actionUrl: a.listingId ? `/listings/${a.listingId}` : undefined,
        metadata: { analysisId: a.id, score: a.listing?.compositeScore },
      });
    }

    // Agent runs → feed items (only interesting ones)
    for (const r of agentRuns) {
      if (r.itemsCreated === 0 && r.itemsUpdated === 0) continue;
      feedItems.push({
        id: `agent-${r.id}`,
        type: "AGENT_RUN",
        priority: "low",
        icon: "⚡",
        title: `${formatAgentName(r.agentName)} completed`,
        description: `Processed ${r.itemsProcessed} items, ${r.itemsCreated} new, ${r.itemsUpdated} updated`,
        timestamp: (r.completedAt ?? r.startedAt).toISOString(),
      });
    }

    // News items → feed items
    for (const n of newsItems) {
      feedItems.push({
        id: `news-${n.id}`,
        type: "NEWS",
        priority: n.urgency === "immediate" ? "high" : "normal",
        icon: n.category === "commercial_construction" ? "🏗️" : "📰",
        title: n.headline ?? "News Update",
        description: n.aiSummary?.slice(0, 200) ?? "",
        timestamp: (n.publishedAt ?? n.fetchedAt).toISOString(),
        actionUrl: n.url,
        metadata: {
          category: n.category,
          urgency: n.urgency,
          impactOnThesis: n.impactOnThesis,
        },
      });
    }

    // Sort by timestamp descending and limit
    feedItems.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      items: feedItems.slice(0, limit),
      total: feedItems.length,
    });
  } catch (error) {
    console.error("Intelligence feed error:", error);
    return NextResponse.json(
      { error: "Failed to fetch intelligence feed" },
      { status: 500 }
    );
  }
}

function getNotificationIcon(type: string): string {
  const icons: Record<string, string> = {
    HIGH_SCORE_DISCOVERY: "🎯",
    DC_PROJECT_NEWS: "🏗️",
    SCORE_CHANGE: "📊",
    ENRICHMENT_COMPLETE: "🔍",
    WEEKLY_BRIEF: "📋",
    LEGISLATION_UPDATE: "⚡",
    NEW_LISTING: "📋",
    AGENT_ERROR: "⚠️",
  };
  return icons[type] ?? "📌";
}

function formatAgentName(name: string): string {
  const names: Record<string, string> = {
    daily_scan: "Daily Scan",
    news_monitor: "News Monitor",
    market_pulse: "Market Pulse",
    enrichment: "Enrichment",
    deep_dive: "Deep Dive",
    outreach_draft: "Outreach Draft",
  };
  return names[name] ?? name;
}
