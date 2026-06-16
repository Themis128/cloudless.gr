import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { getCalendarItems, updateCalendarItem } from "@/lib/content-calendar";
import { isPostizConfigured, listPosts, type PostizPost } from "@/lib/postiz";
import { notifyPostErrored, notifyPostPublished } from "@/lib/postiz-slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/postiz-sync — status pull-back loop.
 *
 * Webhooks (POST /api/webhooks/postiz) are the primary source of truth, but
 * we still need a polling safety net for: (a) installations where Postiz
 * webhooks aren't configured, (b) events Postiz dropped on the floor during
 * an outage, (c) re-syncing after the app itself was offline.
 *
 * The cron pulls posts in a [-3d, +30d] window, intersects with calendar
 * items that have `postizPostIds`, and reconciles status. Idempotent: if the
 * calendar item is already in the right state, no write happens.
 *
 * Schedule recommended: every 15 minutes. The Postiz Public API window
 * tolerates this comfortably (1 request per call, well under any rate limit).
 */

const LOOKBACK_DAYS = 3;
const LOOKAHEAD_DAYS = 30;

function postizStateToCalendarStatus(
  state: PostizPost["state"]
): "draft" | "scheduled" | "published" | "cancelled" {
  switch (state) {
    case "PUBLISHED":
      return "published";
    case "ERROR":
      // Demote back to draft so the user sees it in the queue; we explicitly
      // do NOT use "cancelled" — that's user-driven, not failure-driven.
      return "draft";
    case "DRAFT":
      return "draft";
    case "QUEUE":
    default:
      return "scheduled";
  }
}

export async function GET(request: NextRequest) {
  if (!(await isCronAuthorized(request))) return cronUnauthorized();

  if (!(await isPostizConfigured())) {
    return NextResponse.json({ ok: false, reason: "postiz_not_configured" }, { status: 503 });
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const startDate = new Date(now - LOOKBACK_DAYS * dayMs).toISOString();
  const endDate = new Date(now + LOOKAHEAD_DAYS * dayMs).toISOString();

  let upstream: PostizPost[];
  try {
    upstream = await listPosts(startDate, endDate);
  } catch (err) {
    console.error("[postiz-sync] listPosts failed:", err);
    return NextResponse.json({ ok: false, reason: "postiz_upstream_failed" }, { status: 502 });
  }

  const byPostizId = new Map<string, PostizPost>();
  for (const p of upstream) byPostizId.set(p.id, p);

  const sinceDay = new Date(now - LOOKBACK_DAYS * dayMs).toISOString().slice(0, 10);
  const untilDay = new Date(now + LOOKAHEAD_DAYS * dayMs).toISOString().slice(0, 10);
  const items = await getCalendarItems(sinceDay, untilDay);
  const candidates = items.filter((i) => (i.postizPostIds?.length ?? 0) > 0);

  let updated = 0;
  let published = 0;
  let errored = 0;
  let unchanged = 0;
  let missing = 0;

  for (const item of candidates) {
    // Use the first Postiz ID that maps back to an upstream record. For
    // multi-channel items we treat the FIRST channel's state as authoritative
    // (matches calendar UX — one status per item). The webhook receiver and
    // per-channel detail still surface individual results.
    const ids = item.postizPostIds ?? [];
    const upstreamPost = ids.map((id) => byPostizId.get(id)).find(Boolean);
    if (!upstreamPost) {
      missing += 1;
      continue;
    }

    const target = postizStateToCalendarStatus(upstreamPost.state);
    if (item.status === target) {
      unchanged += 1;
      continue;
    }

    await updateCalendarItem(item.id, { status: target });
    updated += 1;

    if (upstreamPost.state === "PUBLISHED") {
      published += 1;
      // Slack is best-effort — see webhook receiver for the same pattern.
      await notifyPostPublished(upstreamPost).catch((e) =>
        console.error("[postiz-sync] slack:", e)
      );
    } else if (upstreamPost.state === "ERROR") {
      errored += 1;
      await notifyPostErrored(upstreamPost, null).catch((e) =>
        console.error("[postiz-sync] slack:", e)
      );
    }
  }

  return NextResponse.json({
    ok: true,
    window: { startDate, endDate },
    upstreamCount: upstream.length,
    candidates: candidates.length,
    updated,
    published,
    errored,
    unchanged,
    missing,
  });
}
