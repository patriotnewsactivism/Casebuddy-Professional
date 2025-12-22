import Parser from "rss-parser";
import { db } from "../db";
import { newsArticles } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "media"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

const RSS_FEED_URL = "https://www.wtpnews.org/feed/";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

interface FeedItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  pubDate?: string;
  enclosure?: { url?: string };
  media?: { $?: { url?: string } };
}

function extractImageUrl(item: FeedItem): string | null {
  if (item.enclosure?.url) return item.enclosure.url;
  if (item.media?.$?.url) return item.media.$.url;
  const imgMatch = (item.content || "").match(/<img[^>]+src="([^"]+)"/);
  if (imgMatch) return imgMatch[1];
  return null;
}

function extractSummary(item: FeedItem): string {
  let summary = item.contentSnippet || item.content || "";
  summary = summary.replace(/<[^>]+>/g, "").trim();
  if (summary.length > 250) {
    summary = summary.substring(0, 247) + "...";
  }
  return summary;
}

export async function fetchAndCacheNews(): Promise<void> {
  try {
    console.log("[NewsAggregator] Fetching RSS feed from wtpnews.org...");
    const feed = await parser.parseURL(RSS_FEED_URL);
    
    if (!feed.items || feed.items.length === 0) {
      console.log("[NewsAggregator] No items found in feed");
      return;
    }

    console.log(`[NewsAggregator] Found ${feed.items.length} articles`);

    for (let i = 0; i < feed.items.length; i++) {
      const item = feed.items[i] as FeedItem;
      if (!item.link || !item.title) continue;

      const isFeatured = i < 2;

      try {
        await db
          .insert(newsArticles)
          .values({
            url: item.link,
            title: item.title,
            summary: extractSummary(item),
            imageUrl: extractImageUrl(item),
            publishedAt: item.pubDate ? new Date(item.pubDate) : null,
            featured: isFeatured,
            source: "wtpnews",
            fetchedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: newsArticles.url,
            set: {
              title: item.title,
              summary: extractSummary(item),
              imageUrl: extractImageUrl(item),
              featured: isFeatured,
              fetchedAt: new Date(),
            },
          });
      } catch (err) {
        console.error(`[NewsAggregator] Error saving article: ${item.title}`, err);
      }
    }

    console.log("[NewsAggregator] News cache updated successfully");
  } catch (error) {
    console.error("[NewsAggregator] Error fetching RSS feed:", error);
  }
}

export async function getLatestNews(limit: number = 3) {
  return db
    .select()
    .from(newsArticles)
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit);
}

export async function getFeaturedNews(limit: number = 2) {
  return db
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.featured, true))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit);
}

export function startNewsRefreshScheduler(): void {
  fetchAndCacheNews();
  setInterval(() => {
    fetchAndCacheNews();
  }, REFRESH_INTERVAL_MS);
  console.log(`[NewsAggregator] Scheduler started (refresh every ${REFRESH_INTERVAL_MS / 60000} minutes)`);
}
