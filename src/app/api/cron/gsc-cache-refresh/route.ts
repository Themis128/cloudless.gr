import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { readThrough } from "@/lib/gsc-cache";
import { getSeoSnapshot, getTopKeywords, getTopPages, getWebAnalytics } from "@/lib/gsc";

/**
 * GSC cache warmer.
 *
 * Pre-populates the AnalyticsCache table for the date ranges users most
 * frequently land on (7d, 28d). The /admin/analytics page caches per
 * range, so without warming, the first visit on a new range can take
 * 2-4 s to render while GSC is queried fresh.
 *
 * Scheduled hourly by EventBridge → invokes this endpoint with
 * `Authorization: Bearer <CRON_SECRET>`.
 */

const PRE_WARMED_RANGES = [7, 28] as const;
const KEYWORDS_LIMIT = 50;
const PAGES_LIMIT = 25;
const TTL_SECONDS = 3600;

export const dynamic = "force-dynamic";

interface WarmResult {
  range: number;
  ok: boolean;
  ms: number;
  errors: string[];
}

async function warmRange(days: number): Promise<WarmResult> {
  const t0 = performance.now();
  const errors: string[] = [];

  // Run each warm in parallel; collect their failures but don't let one
  // route's flake fail the whole hourly job.
  const results = await Promise.allSettled([
    readThrough("seo", { days }, () => getSeoSnapshot(undefined, days), {
      ttlSeconds: TTL_SECONDS,
    }),
    readThrough(
      "keywords",
      { limit: KEYWORDS_LIMIT, days },
      () => getTopKeywords(undefined, KEYWORDS_LIMIT, days),
      { ttlSeconds: TTL_SECONDS }
    ),
    readThrough(
      "pages",
      { limit: PAGES_LIMIT, days },
      () => getTopPages(undefined, PAGES_LIMIT, days),
      { ttlSeconds: TTL_SECONDS }
    ),
    readThrough("web", { days }, () => getWebAnalytics(undefined, days), {
      ttlSeconds: TTL_SECONDS,
    }),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      errors.push(String((r.reason as Error)?.message ?? r.reason));
    }
  }

  return {
    range: days,
    ok: errors.length === 0,
    ms: Math.round(performance.now() - t0),
    errors,
  };
}

export async function GET(request: NextRequest) {
  // Auth: requires CRON_SECRET bearer. The same secret pattern other
  // /api/cron/* routes already use.
  const config = await getConfig();
  const expected = config.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // GSC must actually be configured; otherwise return 503 (caller's cron
  // dashboard surfaces this distinctly from auth failures).
  if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json({ error: "Google Search Console not configured." }, { status: 503 });
  }

  const t0 = performance.now();
  const warmed: WarmResult[] = [];
  for (const days of PRE_WARMED_RANGES) {
    warmed.push(await warmRange(days));
  }

  return NextResponse.json({
    warmed,
    totalMs: Math.round(performance.now() - t0),
    fetchedAt: new Date().toISOString(),
  });
}
