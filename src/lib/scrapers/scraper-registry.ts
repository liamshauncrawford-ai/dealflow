import { Platform } from "@prisma/client";
import { BaseScraper } from "./base-scraper";
import { BizBuySellScraper } from "./bizbuysell";
import { BizQuestScraper } from "./bizquest";
import { DealStreamScraper } from "./dealstream";
import { TransworldScraper } from "./transworld";
import { LoopNetScraper } from "./loopnet";
import { BusinessBrokerScraper } from "./businessbroker";

// ─────────────────────────────────────────────
// Scraper registry
// ─────────────────────────────────────────────

/**
 * All platforms that have a scraper implementation.
 * Add new entries here as additional platform scrapers are built.
 */
const SCRAPER_MAP: Partial<Record<Platform, () => BaseScraper>> = {
  BIZBUYSELL: () => new BizBuySellScraper(),
  BIZQUEST: () => new BizQuestScraper(),
  DEALSTREAM: () => new DealStreamScraper(),
  TRANSWORLD: () => new TransworldScraper(),
  LOOPNET: () => new LoopNetScraper(),
  BUSINESSBROKER: () => new BusinessBrokerScraper(),
};

/**
 * Get a scraper instance for a given platform.
 * Throws if the platform has no registered scraper.
 */
export function getScraperForPlatform(platform: Platform): BaseScraper {
  const factory = SCRAPER_MAP[platform];
  if (!factory) {
    throw new Error(
      `No scraper registered for platform: ${platform}. ` +
        `Supported platforms: ${getSupportedPlatforms().join(", ")}`
    );
  }
  return factory();
}

/**
 * Get a fresh instance of every registered scraper.
 */
export function getAllScrapers(): BaseScraper[] {
  return Object.values(SCRAPER_MAP)
    .filter((factory): factory is () => BaseScraper => factory !== undefined)
    .map((factory) => factory());
}

/**
 * List all platforms that currently have a scraper implementation.
 */
export function getSupportedPlatforms(): Platform[] {
  return Object.keys(SCRAPER_MAP) as Platform[];
}
