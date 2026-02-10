import { Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
}

export interface CookieStatus {
  platform: string;
  isValid: boolean;
  capturedAt: Date | null;
  lastUsedAt: Date | null;
}

/**
 * Encrypt and save cookies to the database for a given platform.
 * Creates or updates (upserts) the PlatformCookie record.
 */
export async function saveCookies(
  platform: Platform,
  cookies: CookieData[]
): Promise<void> {
  const serialized = JSON.stringify(cookies);
  const encrypted = encrypt(serialized);

  // Determine the earliest expiry among all cookies that have one
  const expiryTimestamps = cookies
    .filter((c) => c.expires !== undefined && c.expires > 0)
    .map((c) => c.expires as number);

  const earliestExpiry =
    expiryTimestamps.length > 0
      ? new Date(Math.min(...expiryTimestamps) * 1000) // expires is in seconds
      : null;

  await prisma.platformCookie.upsert({
    where: { platform },
    create: {
      platform,
      cookieData: encrypted,
      capturedAt: new Date(),
      expiresAt: earliestExpiry,
      isValid: true,
      lastUsedAt: null,
    },
    update: {
      cookieData: encrypted,
      capturedAt: new Date(),
      expiresAt: earliestExpiry,
      isValid: true,
    },
  });
}

/**
 * Load and decrypt cookies for a given platform from the database.
 * Returns null if no cookies exist, or if they are expired or marked invalid.
 */
export async function loadCookies(
  platform: Platform
): Promise<CookieData[] | null> {
  const record = await prisma.platformCookie.findUnique({
    where: { platform },
  });

  if (!record) return null;

  // Check validity flag
  if (!record.isValid) return null;

  // Check expiry
  if (record.expiresAt && record.expiresAt < new Date()) {
    // Automatically invalidate stale cookies
    await prisma.platformCookie.update({
      where: { platform },
      data: { isValid: false },
    });
    return null;
  }

  try {
    const decrypted = decrypt(record.cookieData);
    const cookies: CookieData[] = JSON.parse(decrypted);

    // Update lastUsedAt timestamp
    await prisma.platformCookie.update({
      where: { platform },
      data: { lastUsedAt: new Date() },
    });

    return cookies;
  } catch {
    // Decryption or parsing failure -- mark invalid
    await prisma.platformCookie.update({
      where: { platform },
      data: { isValid: false },
    });
    return null;
  }
}

/**
 * Check if cookies for a platform exist and are currently marked as valid.
 */
export async function validateCookies(platform: Platform): Promise<boolean> {
  const record = await prisma.platformCookie.findUnique({
    where: { platform },
  });

  if (!record) return false;
  if (!record.isValid) return false;

  // Also check the expiry timestamp
  if (record.expiresAt && record.expiresAt < new Date()) {
    await prisma.platformCookie.update({
      where: { platform },
      data: { isValid: false },
    });
    return false;
  }

  return true;
}

/**
 * Mark cookies for a platform as invalid. Does not delete the record so that
 * capturedAt / lastUsedAt metadata is preserved for diagnostics.
 */
export async function invalidateCookies(platform: Platform): Promise<void> {
  await prisma.platformCookie.updateMany({
    where: { platform },
    data: { isValid: false },
  });
}

/**
 * Get the cookie status for every scrapable platform.
 */
export async function getCookieStatus(): Promise<CookieStatus[]> {
  const scrapePlatforms: Platform[] = [
    "BIZBUYSELL",
    "BIZQUEST",
    "DEALSTREAM",
    "TRANSWORLD",
    "LOOPNET",
    "BUSINESSBROKER",
  ];

  const records = await prisma.platformCookie.findMany({
    where: { platform: { in: scrapePlatforms } },
  });

  const recordMap = new Map(records.map((r) => [r.platform, r]));

  return scrapePlatforms.map((platform) => {
    const record = recordMap.get(platform);
    if (!record) {
      return {
        platform,
        isValid: false,
        capturedAt: null,
        lastUsedAt: null,
      };
    }

    const isExpired = record.expiresAt ? record.expiresAt < new Date() : false;

    return {
      platform,
      isValid: record.isValid && !isExpired,
      capturedAt: record.capturedAt,
      lastUsedAt: record.lastUsedAt,
    };
  });
}
