/**
 * Thesis Configuration Loader
 *
 * Server-side function that loads thesis configuration from the AppSetting
 * table, falling back to THESIS_DEFAULTS for any missing keys.
 */

import { prisma } from "@/lib/db";
import {
  type ThesisConfig,
  THESIS_DEFAULTS,
  THESIS_KEYS,
} from "@/lib/thesis-defaults";

/**
 * Load the full thesis configuration from AppSetting rows.
 * Fetches all `thesis.*` keys in one query, parses JSON values,
 * and merges with defaults.
 */
export async function loadThesisConfig(): Promise<ThesisConfig> {
  try {
    const rows = await prisma.appSetting.findMany({
      where: {
        key: { startsWith: "thesis." },
      },
    });

    const dbValues = new Map(rows.map((r) => [r.key, r.value]));

    // Build config by checking each key against DB, falling back to default
    const config: ThesisConfig = { ...THESIS_DEFAULTS };

    for (const [field, dbKey] of Object.entries(THESIS_KEYS)) {
      const raw = dbValues.get(dbKey);
      if (raw === undefined) continue;

      try {
        const parsed = JSON.parse(raw);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (config as any)[field] = parsed;
      } catch {
        // If JSON parsing fails, keep the default
        console.warn(`[ThesisLoader] Failed to parse ${dbKey}: ${raw}`);
      }
    }

    return config;
  } catch (error) {
    console.error("[ThesisLoader] Error loading config, using defaults:", error);
    return { ...THESIS_DEFAULTS };
  }
}
