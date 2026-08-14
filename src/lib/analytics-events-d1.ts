/**
 * D1 analytics_events weekly rollup for the cron Slack digest.
 * Replaces the retired Notion createWeeklyRollup / archiveOldEvents path.
 */

import { getAuthDbFromEnv } from "@/lib/auth-d1";

export interface WeeklyAnalyticsRollup {
  bound: boolean;
  eventCount: number;
  byType: Record<string, number>;
}

export async function getWeeklyAnalyticsRollup(days = 7): Promise<WeeklyAnalyticsRollup> {
  const db = getAuthDbFromEnv();
  if (!db) return { bound: false, eventCount: 0, byType: {} };

  const since = Math.floor(Date.now() / 1000) - Math.max(1, days) * 86400;
  try {
    const total = await db
      .prepare(`SELECT COUNT(*) AS n FROM analytics_events WHERE created_at >= ?`)
      .bind(since)
      .first<{ n: number }>();
    const types = await db
      .prepare(
        `SELECT event AS k, COUNT(*) AS n
         FROM analytics_events WHERE created_at >= ?
         GROUP BY event`
      )
      .bind(since)
      .all<{ k: string; n: number }>();

    const byType: Record<string, number> = {};
    for (const row of types.results ?? []) {
      if (row.k) byType[row.k] = Number(row.n ?? 0);
    }
    return { bound: true, eventCount: Number(total?.n ?? 0), byType };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[analytics-events-d1] weekly rollup failed:", msg);
    return { bound: true, eventCount: 0, byType: {} };
  }
}
