import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  fetchNewsArticles,
  classifyArticles,
  type NewsClassification,
} from "@/lib/ai/news-monitor";
import { processDCConstructionArticle } from "@/lib/market-intel/dc-project-automation";
import { requireCronOrAuth } from "@/lib/auth-helpers";

const CLASSIFICATION_BATCH_SIZE = 10;

/**
 * POST /api/cron/news-monitor
 * Fetches RSS feeds, deduplicates against existing NewsItems,
 * classifies new articles via Claude, and creates notifications.
 * Auth: CRON_SECRET (external scheduler) or session cookie (dashboard).
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCronOrAuth(request);
    if (!authResult.authorized) return authResult.error;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 503 },
      );
    }

    // Create agent run record
    const agentRun = await prisma.aIAgentRun.create({
      data: { agentName: "news_monitor", status: "running" },
    });

    // Step 1: Fetch articles from RSS feeds
    const rawArticles = await fetchNewsArticles();

    if (rawArticles.length === 0) {
      await prisma.aIAgentRun.update({
        where: { id: agentRun.id },
        data: {
          status: "success",
          summary: "No articles fetched from RSS feeds",
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ message: "No articles found", processed: 0 });
    }

    // Step 2: Deduplicate — only process articles we haven't seen
    const existingUrls = await prisma.newsItem.findMany({
      where: { url: { in: rawArticles.map((a) => a.url) } },
      select: { url: true },
    });
    const existingUrlSet = new Set(existingUrls.map((e) => e.url));
    const newArticles = rawArticles.filter((a) => !existingUrlSet.has(a.url));

    if (newArticles.length === 0) {
      await prisma.aIAgentRun.update({
        where: { id: agentRun.id },
        data: {
          status: "success",
          summary: `Fetched ${rawArticles.length} articles, all already seen`,
          completedAt: new Date(),
        },
      });
      return NextResponse.json({
        message: "All articles already processed",
        fetched: rawArticles.length,
        new: 0,
      });
    }

    // Step 3: Store raw articles (before classification, so we don't re-fetch)
    for (const article of newArticles) {
      await prisma.newsItem.create({
        data: {
          source: article.source,
          url: article.url,
          headline: article.headline,
          publishedAt: article.publishedAt,
        },
      });
    }

    // Step 4: Classify in batches via Claude
    let totalTokens = 0;
    let totalCost = 0;
    let apiCalls = 0;
    let classified = 0;
    let notifications = 0;

    for (let i = 0; i < newArticles.length; i += CLASSIFICATION_BATCH_SIZE) {
      const batch = newArticles.slice(i, i + CLASSIFICATION_BATCH_SIZE);

      const { classifications, inputTokens, outputTokens } =
        await classifyArticles(batch.map((a) => ({ headline: a.headline, url: a.url })));

      apiCalls++;
      totalTokens += inputTokens + outputTokens;
      totalCost += (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;

      // Step 5: Update each NewsItem with classification
      for (const c of classifications) {
        await prisma.newsItem.update({
          where: { url: c.url },
          data: {
            category: c.category,
            urgency: c.urgency,
            impactOnThesis: c.impact_on_thesis,
            aiSummary: c.summary,
            actionItems: c.action_items,
            classifiedAt: new Date(),
            estimatedCablingValue: c.estimated_cabling_opportunity
              ? parseDollarAmount(c.estimated_cabling_opportunity)
              : null,
          },
        });

        classified++;

        // Step 6: Create notifications for important articles
        if (c.category !== "irrelevant") {
          const notif = buildNotification(c);
          if (notif) {
            await prisma.notification.create({ data: notif });
            notifications++;
          }
        }
      }
    }

    // Step 7: Run DC project automation on dc_construction / gc_award articles
    let automationRuns = 0;
    const dcArticles = await prisma.newsItem.findMany({
      where: {
        category: { in: ["dc_construction", "gc_award"] },
        automationRanAt: null,
        classifiedAt: { not: null },
      },
      select: {
        id: true,
        headline: true,
        relatedOperatorIds: true,
        relatedGcIds: true,
        estimatedCablingValue: true,
      },
      take: 10,
    });

    for (const article of dcArticles) {
      try {
        const result = await processDCConstructionArticle({
          newsItemId: article.id,
          headline: article.headline ?? "",
          operatorNames: (article.relatedOperatorIds as string[]) ?? [],
          gcNames: (article.relatedGcIds as string[]) ?? [],
          estimatedCablingValue: article.estimatedCablingValue
            ? Number(article.estimatedCablingValue)
            : null,
        });

        await prisma.newsItem.update({
          where: { id: article.id },
          data: {
            automationRanAt: new Date(),
            surfacedTargetIds: result.surfacedTargetIds,
          },
        });

        if (result.opportunityId) {
          await prisma.notification.create({
            data: {
              type: NotificationType.DC_PROJECT_NEWS,
              title: `Auto-surfaced: ${(article.headline ?? "").slice(0, 80)}`,
              message: `Created opportunity from news. ${result.surfacedTargetIds.length} targets nearby.`,
              priority: "normal",
              entityType: "cabling_opportunity",
              entityId: result.opportunityId,
              actionUrl: `/market-intel/opportunities`,
            },
          });
        }

        automationRuns++;
      } catch (err) {
        console.error(`DC automation error for ${article.id}:`, err);
      }
    }

    // Finalize agent run
    const summary = `Fetched ${rawArticles.length} articles, ${newArticles.length} new, ${classified} classified, ${notifications} notifications, ${automationRuns} automated`;
    await prisma.aIAgentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "success",
        itemsProcessed: newArticles.length,
        itemsCreated: classified,
        apiCallsMade: apiCalls,
        totalTokens,
        totalCost,
        summary,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "News monitor complete",
      fetched: rawArticles.length,
      new: newArticles.length,
      classified,
      notifications,
      cost: `$${totalCost.toFixed(3)}`,
    });
  } catch (error) {
    console.error("News monitor error:", error);

    try {
      const latestRun = await prisma.aIAgentRun.findFirst({
        where: { agentName: "news_monitor", status: "running" },
        orderBy: { startedAt: "desc" },
      });
      if (latestRun) {
        await prisma.aIAgentRun.update({
          where: { id: latestRun.id },
          data: {
            status: "error",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          },
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      { error: "News monitor failed", detail: error instanceof Error ? error.message : undefined },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function parseDollarAmount(str: string): number | null {
  const match = str.match(/\$?([\d,.]+)\s*(million|billion|M|B)?/i);
  if (!match) return null;
  let value = parseFloat(match[1].replace(/,/g, ""));
  const unit = match[2]?.toLowerCase();
  if (unit === "million" || unit === "m") value *= 1_000_000;
  if (unit === "billion" || unit === "b") value *= 1_000_000_000;
  return value;
}

type NotificationCategory = NewsClassification["category"];
type NotificationUrgency = NewsClassification["urgency"];

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  dc_construction: "DC Construction",
  gc_award: "GC Project Award",
  legislation: "Legislative Update",
  power_utility: "Power/Utility Update",
  acquisition_signal: "Acquisition Signal",
  competitor_move: "Competitor Activity",
  market_trend: "Market Trend",
  irrelevant: "",
};

function buildNotification(c: NewsClassification): {
  type: NotificationType;
  title: string;
  message: string;
  priority: string;
  entityType: string;
  actionUrl: string;
} | null {
  // Only create notifications for urgent or impactful items
  if (c.urgency === "background" && c.impact_on_thesis === "neutral") return null;

  const priority = getPriority(c.urgency, c.impact_on_thesis);
  const label = CATEGORY_LABELS[c.category] || c.category;

  const type: NotificationType =
    c.category === "legislation"
      ? NotificationType.LEGISLATION_UPDATE
      : c.category === "dc_construction" || c.category === "gc_award"
        ? NotificationType.DC_PROJECT_NEWS
        : c.category === "acquisition_signal"
          ? NotificationType.HIGH_SCORE_DISCOVERY
          : NotificationType.DC_PROJECT_NEWS;

  return {
    type,
    title: `${label}: ${c.headline.slice(0, 100)}`,
    message: c.summary,
    priority,
    entityType: "news",
    actionUrl: c.url,
  };
}

function getPriority(urgency: NotificationUrgency, impact: string): string {
  if (urgency === "immediate") return "high";
  if (impact === "negative" && urgency !== "background") return "high";
  if (urgency === "this_week") return "normal";
  return "low";
}
