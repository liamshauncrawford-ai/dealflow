/**
 * News & Market Monitor — fetches RSS feeds and classifies articles via Claude.
 *
 * Uses Google News RSS (free, no API key) to monitor:
 * - Data center construction on Colorado's Front Range
 * - GC project announcements (DPR, Holder, Hensel Phelps, Mortenson)
 * - Acquisition signals (retirement, succession, contractor for sale)
 * - Legislation and utility updates affecting DC market
 */

import { callClaude, safeJsonParse } from "./claude-client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RawNewsArticle {
  url: string;
  headline: string;
  source: string;
  publishedAt: Date | null;
}

export interface NewsClassification {
  headline: string;
  url: string;
  category:
    | "dc_construction"
    | "gc_award"
    | "legislation"
    | "power_utility"
    | "acquisition_signal"
    | "competitor_move"
    | "market_trend"
    | "irrelevant";
  urgency: "immediate" | "this_week" | "monitor" | "background";
  impact_on_thesis: "positive" | "negative" | "neutral";
  summary: string;
  action_items: string[];
  related_operators: string[];
  related_gcs: string[];
  related_companies: string[];
  estimated_cabling_opportunity: string | null;
}

// ─────────────────────────────────────────────
// RSS feed configuration
// ─────────────────────────────────────────────

const SEARCH_QUERIES = {
  dc_market: [
    '"data center" Colorado construction OR expansion OR groundbreaking',
    'CoreSite Denver OR "QTS Aurora" OR "Flexential Parker"',
    '"Xcel Energy" data center tariff OR rate',
    '"data center" Colorado legislature OR incentive',
  ],
  gc_projects: [
    '"DPR Construction" Colorado data center',
    '"Holder Construction" Colorado OR Aurora',
    '"Hensel Phelps" data center',
    '"Mortenson" data center Denver',
  ],
  acquisition_signals: [
    '"electrical contractor" Colorado retirement OR succession OR "for sale"',
    '"structured cabling" Colorado acquisition OR merger',
    '"low voltage" contractor Denver closing OR retirement',
  ],
};

/**
 * Build Google News RSS URL for a search query.
 */
function buildGoogleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

/**
 * Parse a simple RSS/XML feed into articles.
 * Simple regex extraction is sufficient for Google News RSS
 * which has a predictable XML format.
 */
function parseRssItems(xml: string): Array<{ title: string; link: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; pubDate: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
    const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "";
    const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";

    if (title && link) {
      items.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, ""),
        link,
        pubDate,
      });
    }
  }

  return items;
}

/**
 * Fetch all news articles from configured RSS feeds.
 * Returns deduplicated articles (by URL).
 */
export async function fetchNewsArticles(): Promise<RawNewsArticle[]> {
  const allArticles = new Map<string, RawNewsArticle>();

  const allQueries = [
    ...SEARCH_QUERIES.dc_market.map((q) => ({ query: q, source: "google_news_dc" })),
    ...SEARCH_QUERIES.gc_projects.map((q) => ({ query: q, source: "google_news_gc" })),
    ...SEARCH_QUERIES.acquisition_signals.map((q) => ({ query: q, source: "google_news_acq" })),
  ];

  // Fetch all feeds concurrently (with timeout)
  const results = await Promise.allSettled(
    allQueries.map(async ({ query, source }) => {
      const url = buildGoogleNewsRssUrl(query);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRssItems(xml).map((item) => ({
          url: item.link,
          headline: item.title,
          source,
          publishedAt: item.pubDate ? new Date(item.pubDate) : null,
        }));
      } catch {
        console.warn(`[NewsMonitor] Failed to fetch RSS for: ${query.slice(0, 50)}...`);
        return [];
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const article of result.value) {
        if (!allArticles.has(article.url)) {
          allArticles.set(article.url, article);
        }
      }
    }
  }

  return Array.from(allArticles.values());
}

// ─────────────────────────────────────────────
// AI Classification
// ─────────────────────────────────────────────

const CLASSIFICATION_SYSTEM = `You are a market intelligence analyst monitoring the Colorado data center construction market for a structured cabling company acquirer.

The acquirer is building a roll-up platform of electrical/low-voltage contractors to serve the Front Range data center boom. Key context:
- Target geography: Colorado Front Range (Denver metro, Colorado Springs, Northern CO)
- Key DC operators: CoreSite, QTS, Flexential, Stack, EdgeConneX, CyrusOne, NTT
- Key GCs: DPR Construction, Holder Construction, Hensel Phelps, Mortenson
- Target trades: Structured cabling, low-voltage, electrical, fire alarm, security, BAS
- Legislative focus: Data center incentive bills (HB26-1030, SB26-102)
- Power: Xcel Energy capacity and tariff decisions

Classify each news article and extract actionable intelligence. Be concise in summaries.`;

/**
 * Send a batch of articles to Claude for classification.
 */
export async function classifyArticles(
  articles: Array<{ headline: string; url: string }>,
): Promise<{
  classifications: NewsClassification[];
  inputTokens: number;
  outputTokens: number;
}> {
  const userPrompt = `Classify these ${articles.length} news articles. Return a JSON array with one object per article.

Each object must have:
{
  "headline": "original headline",
  "url": "original url",
  "category": "dc_construction" | "gc_award" | "legislation" | "power_utility" | "acquisition_signal" | "competitor_move" | "market_trend" | "irrelevant",
  "urgency": "immediate" | "this_week" | "monitor" | "background",
  "impact_on_thesis": "positive" | "negative" | "neutral",
  "summary": "1-2 sentence summary in your own words",
  "action_items": ["specific thing the user should do"],
  "related_operators": ["DC operator names mentioned"],
  "related_gcs": ["GC names mentioned"],
  "related_companies": ["potential target company names"],
  "estimated_cabling_opportunity": "$X million" or null
}

Mark as "irrelevant" if the article has no connection to Colorado data centers, electrical/cabling contractors, or the acquisition strategy.

Articles to classify:
${JSON.stringify(articles.map((a) => ({ headline: a.headline, url: a.url })), null, 2)}`;

  const response = await callClaude({
    model: "sonnet4",
    system: CLASSIFICATION_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 4000,
  });

  const classifications = safeJsonParse<NewsClassification[]>(response.text);

  return {
    classifications: Array.isArray(classifications) ? classifications : [],
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}
