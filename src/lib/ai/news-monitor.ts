/**
 * News & Market Monitor — fetches RSS feeds and classifies articles via Claude.
 *
 * Uses Google News RSS (free, no API key) to monitor:
 * - Commercial construction activity on Colorado's Front Range
 * - GC project announcements and awards
 * - Acquisition signals (retirement, succession, contractor for sale)
 * - Market trends affecting commercial trade contractors
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
    | "commercial_construction"
    | "gc_award"
    | "legislation"
    | "acquisition_signal"
    | "competitor_move"
    | "market_trend"
    | "trade_category_news"
    | "irrelevant";
  urgency: "immediate" | "this_week" | "monitor" | "background";
  impact_on_thesis: "positive" | "negative" | "neutral";
  summary: string;
  action_items: string[];
  related_gcs: string[];
  related_companies: string[];
  estimated_commercial_opportunity: string | null;
}

// ─────────────────────────────────────────────
// RSS feed configuration
// ─────────────────────────────────────────────

const SEARCH_QUERIES = {
  commercial_market: [
    'commercial construction Colorado "Front Range" OR Denver OR "Colorado Springs"',
    '"commercial contractor" Colorado project OR award OR groundbreaking',
    'Colorado construction permits commercial industrial',
    '"general contractor" Colorado award OR project',
  ],
  gc_projects: [
    '"DPR Construction" Colorado commercial',
    '"Hensel Phelps" Colorado project OR award',
    '"GE Johnson" Colorado OR "Saunders Construction" Colorado',
    '"JHL Constructors" OR "Holder Construction" Colorado',
  ],
  acquisition_signals: [
    '"electrical contractor" Colorado retirement OR succession OR "for sale"',
    '"HVAC contractor" OR "plumbing contractor" Colorado retirement OR "for sale"',
    '"commercial contractor" Colorado acquisition OR merger OR succession',
    '"roofing" OR "framing" OR "painting" contractor Colorado retirement OR "for sale"',
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
    ...SEARCH_QUERIES.commercial_market.map((q) => ({ query: q, source: "google_news_commercial" })),
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

const CLASSIFICATION_SYSTEM = `You are a market intelligence analyst monitoring Colorado's Front Range commercial construction market for a commercial services acquisition platform.

The acquirer (Crawford Holdings) is building a platform of commercial service contractors across Colorado's Front Range. Key context:
- Target geography: Colorado Front Range (Denver metro, Colorado Springs, Northern CO)
- 11 target trade categories: electrical, structured cabling, security/fire alarm, HVAC/mechanical, plumbing, framing/drywall, painting/finishing, concrete/masonry, roofing, site work, and general commercial
- Key GCs: DPR, Holder, Hensel Phelps, Mortenson, GE Johnson, Saunders, JHL Constructors
- Focus: commercial construction projects (data centers, healthcare, multifamily, industrial, municipal)
- Acquisition signals: owner retirement, succession planning, contractors for sale

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
  "category": "commercial_construction" | "gc_award" | "legislation" | "acquisition_signal" | "competitor_move" | "market_trend" | "trade_category_news" | "irrelevant",
  "urgency": "immediate" | "this_week" | "monitor" | "background",
  "impact_on_thesis": "positive" | "negative" | "neutral",
  "summary": "1-2 sentence summary in your own words",
  "action_items": ["specific thing the user should do"],
  "related_gcs": ["GC names mentioned"],
  "related_companies": ["potential target company names"],
  "estimated_commercial_opportunity": "$X million" or null
}

Mark as "irrelevant" if the article has no connection to Colorado commercial construction, trade contractors, or the acquisition strategy.

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
