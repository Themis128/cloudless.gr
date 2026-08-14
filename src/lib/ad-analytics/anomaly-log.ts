/**
 * Append-only anomaly event log for admin history.
 *
 * Dedup remains on `ad_analytics_bookmark` keys. This store records the
 * finding payload (severity + message) so /admin can show what Slack already
 * received — without an alerting-config UI.
 */

import { getAuthDbFromEnv, type AuthDatabase } from "@/lib/auth-d1";
import type { AdMetrics, AdPlatformId } from "./types";
import type { AnomalyFinding, AnomalyRuleId } from "./anomaly";
import { findingDedupKey } from "./anomaly";

export interface AnomalyHistoryRow {
  id: string;
  firedAt: string;
  campaignSlug: string;
  platform: string;
  rule: AnomalyRuleId | string;
  severity: "warning" | "critical" | string;
  message: string;
  detail: AnomalyFinding["detail"] | null;
  source: "log" | "bookmark";
}

export interface RecordAnomalyEventsOpts {
  campaignSlug: string;
  platform: AdPlatformId | string;
  windowEnd: string;
  snapshot: AdMetrics;
  findings: AnomalyFinding[];
}

const RULE_SEVERITY: Record<AnomalyRuleId, "warning" | "critical"> = {
  cpc_spike: "warning",
  cpc_ceiling: "critical",
  ctr_floor: "warning",
  zero_conversions: "critical",
  spend_pace: "warning",
};

interface MemoryRow extends AnomalyHistoryRow {
  createdAt: number;
}

const memory: MemoryRow[] = [];

function parseDetail(raw: string | null): AnomalyFinding["detail"] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnomalyFinding["detail"];
  } catch {
    return null;
  }
}

export async function recordAnomalyEvents(opts: RecordAnomalyEventsOpts): Promise<void> {
  if (opts.findings.length === 0) return;
  const firedAt = new Date().toISOString();
  const createdAt = Math.floor(Date.now() / 1000);
  const db = getAuthDbFromEnv();

  for (const finding of opts.findings) {
    const id = findingDedupKey({
      campaignSlug: opts.campaignSlug,
      platform: opts.platform,
      rule: finding.rule,
      windowEnd: opts.windowEnd,
    });
    const row: AnomalyHistoryRow = {
      id,
      firedAt,
      campaignSlug: opts.campaignSlug,
      platform: opts.platform,
      rule: finding.rule,
      severity: finding.severity,
      message: finding.message,
      detail: finding.detail,
      source: "log",
    };

    if (!db) {
      const idx = memory.findIndex((m) => m.id === id);
      const mem: MemoryRow = { ...row, createdAt };
      if (idx >= 0) memory[idx] = mem;
      else memory.push(mem);
      continue;
    }

    try {
      await db
        .prepare(
          `INSERT OR REPLACE INTO ad_analytics_anomaly_event
             (id, fired_at, campaign_slug, platform, rule, severity, message, detail_json, snapshot_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          firedAt,
          opts.campaignSlug,
          opts.platform,
          finding.rule,
          finding.severity,
          finding.message,
          JSON.stringify(finding.detail),
          JSON.stringify(opts.snapshot),
          createdAt
        )
        .run();
    } catch (err) {
      console.error(
        `[ad-analytics/anomaly-log] D1 insert failed for ${id}:`,
        (err as Error)?.message ?? err
      );
    }
  }
}

async function listFromLog(db: AuthDatabase, limit: number): Promise<AnomalyHistoryRow[]> {
  try {
    const result = await db
      .prepare(
        `SELECT id, fired_at, campaign_slug, platform, rule, severity, message, detail_json
         FROM ad_analytics_anomaly_event
         ORDER BY fired_at DESC
         LIMIT ?`
      )
      .bind(limit)
      .all<{
        id: string;
        fired_at: string;
        campaign_slug: string;
        platform: string;
        rule: string;
        severity: string;
        message: string;
        detail_json: string | null;
      }>();

    return (result.results ?? []).map((r) => ({
      id: r.id,
      firedAt: r.fired_at,
      campaignSlug: r.campaign_slug,
      platform: r.platform,
      rule: r.rule,
      severity: r.severity,
      message: r.message,
      detail: parseDetail(r.detail_json),
      source: "log" as const,
    }));
  } catch (err) {
    console.error("[ad-analytics/anomaly-log] D1 list failed:", (err as Error)?.message ?? err);
    return [];
  }
}

/** Thin history from dedup bookmarks when the event log is empty / unbound. */
async function listFromBookmarks(db: AuthDatabase, limit: number): Promise<AnomalyHistoryRow[]> {
  try {
    const result = await db
      .prepare(
        `SELECT pk, last_posted_at, snapshot_json
         FROM ad_analytics_bookmark
         WHERE pk LIKE 'ad-analytics:anomaly:%'
         ORDER BY last_posted_at DESC
         LIMIT ?`
      )
      .bind(limit)
      .all<{ pk: string; last_posted_at: string | null; snapshot_json: string | null }>();

    const rows: AnomalyHistoryRow[] = [];
    for (const r of result.results ?? []) {
      const parts = r.pk.split(":");
      // ad-analytics:anomaly:{slug}:{platform}:{rule}:{YYYY-MM-DD}
      if (parts.length < 6 || parts[1] !== "anomaly") continue;
      const rule = parts[4] as AnomalyRuleId;
      let snapshot: AdMetrics | null = null;
      if (r.snapshot_json) {
        try {
          snapshot = JSON.parse(r.snapshot_json) as AdMetrics;
        } catch {
          snapshot = null;
        }
      }
      rows.push({
        id: r.pk,
        firedAt: r.last_posted_at ?? `${parts[5]}T00:00:00.000Z`,
        campaignSlug: parts[2],
        platform: parts[3],
        rule,
        severity: RULE_SEVERITY[rule] ?? "warning",
        message: snapshot
          ? `${rule.replace(/_/g, " ")} (bookmark) · spend €${snapshot.spendEur.toFixed(2)} · CTR ${((snapshot.ctr ?? 0) * 100).toFixed(2)}%`
          : `${rule.replace(/_/g, " ")} (bookmark)`,
        detail: null,
        source: "bookmark",
      });
    }
    return rows;
  } catch (err) {
    console.error(
      "[ad-analytics/anomaly-log] bookmark list failed:",
      (err as Error)?.message ?? err
    );
    return [];
  }
}

export async function listAnomalyHistory(limit = 50): Promise<AnomalyHistoryRow[]> {
  const capped = Math.max(1, Math.min(200, Math.trunc(limit)));
  const db = getAuthDbFromEnv();
  if (!db) {
    return [...memory]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, capped)
      .map(({ createdAt: _c, ...row }) => row);
  }

  const fromLog = await listFromLog(db, capped);
  if (fromLog.length > 0) return fromLog;
  return listFromBookmarks(db, capped);
}

/** Test hook. */
export function _resetAnomalyLogMemory(): void {
  memory.length = 0;
}
