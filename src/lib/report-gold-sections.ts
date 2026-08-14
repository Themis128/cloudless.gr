/**
 * Flat gold-backed section payloads for client report generation.
 * No live GSC / Stripe API — only datalake-serve helpers.
 */

import {
  getSeoFromLake,
  getStripeSnapshotFromLake,
} from "@/lib/datalake-serve";
import type { ReportSection } from "@/lib/reports";

function daysBetween(dateStart: string, dateEnd: string): number {
  const start = Date.parse(dateStart);
  const end = Date.parse(dateEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 28;
  return Math.max(1, Math.min(180, Math.round((end - start) / 86400000) + 1));
}

/** SEO snapshot + top keywords from gold `top_keywords`. */
export async function buildGoldGscReportSection(
  dateStart: string,
  dateEnd: string
): Promise<ReportSection | null> {
  const days = daysBetween(dateStart, dateEnd);
  const seo = await getSeoFromLake(days);
  if (seo.error && seo.keywords.length === 0 && seo.snapshot.clicks === 0) {
    return null;
  }
  const top = seo.keywords.slice(0, 5);
  return {
    id: "gsc",
    title: "Organic Search (GSC gold)",
    data: {
      source: "datalake_gold",
      days: seo.snapshot.days,
      clicks: seo.snapshot.clicks,
      impressions: seo.snapshot.impressions,
      ctrPercent: Number((seo.snapshot.ctr * 100).toFixed(2)),
      avgPosition: Number(seo.snapshot.position.toFixed(2)),
      keywordCount: seo.keywords.length,
      topKeywords: top.map((k) => `${k.query} (${k.clicks} clicks)`).join("; ") || "—",
      fetchedAt: seo.fetchedAt,
    },
  };
}

/** Stripe totals from gold `stripe_revenue`. */
export async function buildGoldStripeReportSection(
  dateStart: string,
  dateEnd: string
): Promise<ReportSection | null> {
  const days = daysBetween(dateStart, dateEnd);
  const snap = await getStripeSnapshotFromLake(days);
  if (snap.error && snap.totals.events === 0 && snap.totals.revenueMinor === 0) {
    return null;
  }
  return {
    id: "stripe",
    title: "Revenue (Stripe gold)",
    data: {
      source: "datalake_gold",
      windowDays: snap.windowDays,
      events: snap.totals.events,
      revenueEur: Number((snap.totals.revenueMinor / 100).toFixed(2)),
      processed: snap.totals.processed,
      failed: snap.totals.failed,
      dailyPoints: snap.dailyTrend.length,
      generatedAt: snap.generatedAt,
    },
  };
}
