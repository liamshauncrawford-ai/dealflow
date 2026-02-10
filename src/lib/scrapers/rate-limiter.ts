import { Platform } from "@prisma/client";

interface RateLimitConfig {
  minDelayMs: number;
  maxDelayMs: number;
  maxRequestsPerHour: number;
}

const RATE_LIMIT_CONFIGS: Record<Exclude<Platform, "MANUAL">, RateLimitConfig> = {
  BIZBUYSELL: { minDelayMs: 3000, maxDelayMs: 7000, maxRequestsPerHour: 120 },
  BIZQUEST: { minDelayMs: 3000, maxDelayMs: 7000, maxRequestsPerHour: 120 },
  DEALSTREAM: { minDelayMs: 4000, maxDelayMs: 8000, maxRequestsPerHour: 80 },
  TRANSWORLD: { minDelayMs: 3000, maxDelayMs: 6000, maxRequestsPerHour: 100 },
  LOOPNET: { minDelayMs: 5000, maxDelayMs: 10000, maxRequestsPerHour: 60 },
  BUSINESSBROKER: { minDelayMs: 3000, maxDelayMs: 7000, maxRequestsPerHour: 100 },
};

class PlatformRateLimiter {
  private config: RateLimitConfig;
  private requestTimestamps: number[] = [];
  private lastRequestTime: number = 0;
  private pendingQueue: Array<() => void> = [];
  private processing: boolean = false;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Returns a promise that resolves when it is safe to make the next request.
   * Enforces both the randomized inter-request delay and the sliding-window
   * per-hour request cap.
   */
  async waitForSlot(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.pendingQueue.push(resolve);
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.pendingQueue.length > 0) {
      // Prune timestamps older than 1 hour from the sliding window
      const oneHourAgo = Date.now() - 3600_000;
      this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > oneHourAgo);

      // If we have hit the hourly cap, wait until the oldest request in the
      // window expires (falls outside the 1-hour window).
      if (this.requestTimestamps.length >= this.config.maxRequestsPerHour) {
        const oldestInWindow = this.requestTimestamps[0];
        const waitUntilSlotOpens = oldestInWindow + 3600_000 - Date.now() + 100; // +100ms buffer
        if (waitUntilSlotOpens > 0) {
          await this.sleep(waitUntilSlotOpens);
        }
        // Re-prune after waiting
        const refreshedCutoff = Date.now() - 3600_000;
        this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > refreshedCutoff);
      }

      // Enforce randomized delay between consecutive requests
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      const requiredDelay = this.getRandomDelay();

      if (timeSinceLast < requiredDelay) {
        await this.sleep(requiredDelay - timeSinceLast);
      }

      // Record this request and release the next caller
      const timestamp = Date.now();
      this.requestTimestamps.push(timestamp);
      this.lastRequestTime = timestamp;

      const resolve = this.pendingQueue.shift();
      if (resolve) {
        resolve();
      }
    }

    this.processing = false;
  }

  private getRandomDelay(): number {
    const { minDelayMs, maxDelayMs } = this.config;
    return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Returns the number of requests made in the current sliding window.
   */
  getRequestCount(): number {
    const oneHourAgo = Date.now() - 3600_000;
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > oneHourAgo);
    return this.requestTimestamps.length;
  }

  /**
   * Returns the remaining capacity in the current sliding window.
   */
  getRemainingCapacity(): number {
    return this.config.maxRequestsPerHour - this.getRequestCount();
  }
}

/**
 * Per-platform rate limiter instances. Singletons keyed by Platform enum value.
 */
const limiters = new Map<Platform, PlatformRateLimiter>();

export function getRateLimiter(platform: Platform): PlatformRateLimiter {
  if (platform === "MANUAL") {
    throw new Error("Rate limiting is not applicable for MANUAL platform");
  }

  let limiter = limiters.get(platform);
  if (!limiter) {
    const config = RATE_LIMIT_CONFIGS[platform as Exclude<Platform, "MANUAL">];
    limiter = new PlatformRateLimiter(config);
    limiters.set(platform, limiter);
  }
  return limiter;
}

export function getRateLimitConfig(
  platform: Exclude<Platform, "MANUAL">
): RateLimitConfig {
  return RATE_LIMIT_CONFIGS[platform];
}

export { PlatformRateLimiter, RATE_LIMIT_CONFIGS };
export type { RateLimitConfig };
