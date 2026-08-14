/**
 * Scheduled ad-analytics poll endpoint.
 *
 * Trigger: `.github/workflows/linkedin-poll.yml` every 15 minutes.
 *   GET  https://cloudless.gr/api/cron/ad-analytics-poll
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Behaviour: iterate every live campaign × every `adPlatforms[]` entry, pull
 * a rolling 1-hour window of metrics + demographic pivots (industry,
 * seniority, job title, company size), diff against the D1
 * `ad_analytics_bookmark` row (in-memory store when AUTH_DB is unbound),
 * and post a Block Kit digest to every `notifyChannels[].level === "digest"`
 * target. Implemented adapter/channel: LinkedIn + Slack only. Bookmarks
 * advance only when at least one channel accepts the post so an outage
 * doesn't silently drop a window.
 *
 * Security: rejects requests without a matching `CRON_SECRET` using the
 * existing `isCronAuthorized()` (timing-safe). Reuses the same shape as
 * `/api/cron/slack-digest` and `/api/cron/owner-digest` so operators only
 * have to remember one auth scheme.
 *
 * Failure semantics: a single broken adapter or channel does NOT 5xx the
 * whole route — the runtime collects per-campaign outcomes and we return
 * 200 with the full report so the GitHub Actions step log shows which
 * platforms / channels succeeded.
 */

import { NextRequest } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { runScheduledPoll } from "@/lib/ad-analytics/runtime";

export async function GET(request: NextRequest): Promise<Response> {
  if (!(await isCronAuthorized(request))) {
    return cronUnauthorized();
  }

  try {
    const outcome = await runScheduledPoll();
    return Response.json({ ok: true, ...outcome });
  } catch (err) {
    console.error("[ad-analytics/cron] unhandled error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
