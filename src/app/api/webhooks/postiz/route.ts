import { NextRequest, NextResponse } from "next/server";
import { verifyPostizWebhookSignature } from "@/lib/postiz-webhook";
import type { PostizPost } from "@/lib/postiz";
import { getCalendarItems, updateCalendarItem } from "@/lib/content-calendar";
import { notifyPostErrored, notifyPostPublished } from "@/lib/postiz-slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/webhooks/postiz — inbound Postiz event receiver.
 *
 * Events handled:
 *   - `post.published` → mark matching calendar item `published`, Slack +OK.
 *   - `post.errored`   → mark matching calendar item `draft` (so the user
 *                        sees it back in the queue), Slack +alarm.
 *   - anything else    → 202 Accepted, ignored. Postiz may emit additional
 *                        event types over time; ignoring them keeps the
 *                        receiver forward-compatible.
 *
 * Authentication: see `verifyPostizWebhookSignature` — accepts either an
 * `X-Postiz-Signature` HMAC over the raw body OR a `?secret=<hex>` query
 * param matching `POSTIZ_WEBHOOK_SECRET`. Postiz v2's webhook UI has no
 * signing-secret field, so the URL-secret path is the primary one in
 * production. Verification is constant-time and happens on the raw body
 * BEFORE JSON.parse — never reorder these steps; the bytes used for HMAC
 * and JSON.parse must match exactly.
 */

/**
 * Postiz upstream issue #1191 proposed `{event, timestamp, data}`. The shipped
 * v2 webhook payload isn't authoritatively documented yet, so we tolerate both
 * `payload.post` (older) and `payload.data` (proposal shape) — whichever side
 * provides post fields wins. Also accepts `post.published` and the synonym
 * `post.publish` we see in some forks.
 *
 * `verification: true` is an extension WE added (not part of the Postiz spec).
 * When present at any level of the payload, the receiver proves the wire
 * format and auth path work end-to-end (200 ACK with `verification:true`)
 * but skips BOTH the Slack notifier and the calendar mutation. Use it when
 * smoke-testing the endpoint so you don't pollute Slack and don't fake-flip
 * a calendar item by accident. */
interface PostizWebhookPayload {
  event?: string;
  post?: Partial<PostizPost> & { verification?: boolean };
  data?: Partial<PostizPost> & { error?: string; verification?: boolean };
  error?: string;
  timestamp?: string;
  verification?: boolean;
}

async function markByPostizId(postId: string, status: "published" | "draft"): Promise<boolean> {
  // Calendar items don't have a Postiz-ID secondary index — but the universe
  // of social_post items is small (tens to hundreds), so a full scan over the
  // last 90 days is cheap and avoids a schema migration. If this hot-spots,
  // add an index in `notion-calendar.ts`.
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - ninetyDaysMs).toISOString().slice(0, 10);
  const until = new Date(Date.now() + ninetyDaysMs).toISOString().slice(0, 10);
  const items = await getCalendarItems(since, until);
  const match = items.find((i) => (i.postizPostIds ?? []).includes(postId));
  if (!match) return false;
  await updateCalendarItem(match.id, { status });
  return true;
}

export async function POST(req: NextRequest) {
  // Raw body FIRST so we can HMAC the exact bytes Postiz signed.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-postiz-signature");
  const urlSecret = new URL(req.url).searchParams.get("secret");

  const valid = await verifyPostizWebhookSignature(rawBody, signatureHeader, urlSecret);
  if (!valid) {
    // 401 vs 400: a missing-secret deployment looks identical to an attacker;
    // returning 401 for any unverifiable request keeps both cases consistent.
    // Label is `unauthorized` (not `invalid_signature`) because the URL-secret
    // arm is the primary path in Postiz v2 — calling it a signature failure
    // would mislead anyone reading logs.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: PostizWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PostizWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = payload.event ?? "";
  const post = payload.post ?? payload.data;
  if (!post?.id || !post.integration) {
    return NextResponse.json({ accepted: false, reason: "missing_post_fields" }, { status: 202 });
  }

  // Verification mode — payload marked as a probe. Auth passed and shape
  // parsed cleanly, but we skip ALL side effects so smoke-testing the
  // endpoint doesn't fire Slack or mutate calendar items. Marker is
  // recognised at any level (top-level, payload.post, payload.data) so the
  // sender can put it wherever is convenient.
  const isVerification =
    payload.verification === true ||
    payload.post?.verification === true ||
    payload.data?.verification === true;

  // Build a full-ish PostizPost for the Slack helper (it tolerates loose shape).
  const full: PostizPost = {
    id: post.id,
    content: post.content ?? "",
    publishDate: post.publishDate ?? new Date().toISOString(),
    state: (post.state ??
      (event === "post.published" || event === "post.publish"
        ? "PUBLISHED"
        : "QUEUE")) as PostizPost["state"],
    integration: post.integration as PostizPost["integration"],
    releaseURL: post.releaseURL ?? null,
    releaseId: post.releaseId ?? null,
  };

  if (event === "post.published" || event === "post.publish") {
    if (isVerification) {
      return NextResponse.json({ accepted: true, event, postId: post.id, verification: true });
    }
    await markByPostizId(post.id, "published");
    // Slack failures must not break the webhook ACK back to Postiz; if the
    // receiver 5xxs Postiz will retry, and we'd double-update the calendar.
    await notifyPostPublished(full).catch((e) => console.error("[postiz-webhook] slack:", e));
    return NextResponse.json({ accepted: true, event, postId: post.id });
  }

  if (event === "post.errored" || event === "post.failed") {
    if (isVerification) {
      return NextResponse.json({ accepted: true, event, postId: post.id, verification: true });
    }
    await markByPostizId(post.id, "draft");
    const reason = payload.error ?? payload.data?.error ?? null;
    await notifyPostErrored(full, reason).catch((e) => console.error("[postiz-webhook] slack:", e));
    return NextResponse.json({ accepted: true, event, postId: post.id });
  }

  return NextResponse.json({ accepted: false, event, reason: "unhandled_event" }, { status: 202 });
}
