/**
 * Mail → Slack bridge with rule-based sorting.
 *
 * Cloudflare Email Routing delivers `slack@cloudless.gr` to the mail-ingest
 * Worker, which parses the RFC822 and POSTs a normalized JSON body here:
 *
 *   { to, from, subject, text, spam_score, spam_reasons, message_id,
 *     list_id, precedence, auto_submitted }
 *
 * `classifyEmail` sorts each message into a channel + priority before it
 * posts — deterministic scoring, no ML dependency:
 *
 *   alert   — monitoring/security/billing/deploy senders → #ops-alerts
 *   human   — direct correspondence                     → #inbox
 *   bulk    — newsletters/marketing/auto-mail           → suppressed
 *             (still delivered to the mailbox; Slack stays clean)
 *
 * The full message always lands in the mailbox — Slack is the notification
 * surface, not the mail store.
 *
 * Auth: shared secret in `x-mail-to-slack-secret` —
 * `SLACK_EMAIL_INGEST_SECRET` (falls back to `ADMIN_ALERT_SECRET`).
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getConfig } from "@/lib/ssm-config";
import { SlackClient } from "@/lib/slack-notify";
import { checkSlackRateLimit } from "@/lib/slack-rate-limit";
import { classifyEmail } from "@/lib/mail-to-slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WEBMAIL_URL = "https://webmail.cloudless.gr/";
const MAX_EXCERPT_CHARS = 900;
const MAX_SUBJECT_CHARS = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function mrkdwnEscape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Strip quoted reply chains / signatures so the card stays readable. */
function excerptBody(text: string): string {
  const cleaned = text
    .split(/\r?\n>/)[0]
    .split(/\r?\n-- ?\r?\n/)[0]
    .replaceAll(/\r\n/g, "\n")
    .trim();
  const excerpt = cleaned.slice(0, MAX_EXCERPT_CHARS);
  return excerpt + (cleaned.length > MAX_EXCERPT_CHARS ? "…" : "");
}

// ---------------------------------------------------------------------------
// Message-ID dedup (in-process; single-replica deploy)
// ---------------------------------------------------------------------------

const SEEN_TTL_MS = 6 * 60 * 60 * 1000; // 6h — covers CF email retries
const seenIds = new Map<string, number>();

function rememberId(id: string): void {
  const now = Date.now();
  for (const [k, ts] of seenIds) {
    if (now - ts > SEEN_TTL_MS) seenIds.delete(k);
  }
  seenIds.set(id.slice(0, 300), now);
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const ipKey = `ip:${request.headers.get("x-forwarded-for") ?? "unknown"}`;
  if (!checkSlackRateLimit(ipKey)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const cfg = await getConfig();
  const expected = cfg.SLACK_EMAIL_INGEST_SECRET || cfg.ADMIN_ALERT_SECRET || "";
  if (!expected) {
    return NextResponse.json({ error: "Ingest secret not configured" }, { status: 503 });
  }
  const provided = (request.headers.get("x-mail-to-slack-secret") || "").trim();
  if (!provided || !safeEq(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Dedup on Message-ID — Workers can retry delivery.
  const messageId = String(body.message_id ?? "");
  if (messageId && seenIds.has(messageId)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (messageId) rememberId(messageId);

  const classified = classifyEmail(body);
  if (classified.cls === "bulk") {
    // Sorted out of Slack — the mail is still in the mailbox.
    return NextResponse.json({ ok: true, suppressed: true, cls: "bulk" });
  }

  const from = mrkdwnEscape(String(body.from ?? "unknown")).slice(0, 300);
  const to = mrkdwnEscape(String(body.to ?? "")).slice(0, 200);
  const subject = mrkdwnEscape(String(body.subject ?? "(no subject)")).slice(
    0,
    MAX_SUBJECT_CHARS
  );
  const excerpt = mrkdwnEscape(excerptBody(String(body.text ?? "")));
  const spamScore = Number(body.spam_score ?? 0);
  const isAlert = classified.cls === "alert";

  const slack = new SlackClient({ channel: classified.channel });
  const posted = await slack.post({
    text: `Mail: ${subject} — from ${from}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: isAlert ? ":rotating_light: Mail alert" : ":incoming_envelope: Inbound mail",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*From*\n${from}` },
          { type: "mrkdwn", text: `*Subject*\n${subject}` },
        ],
      },
      ...(excerpt
        ? [{ type: "section", text: { type: "mrkdwn", text: excerpt } }]
        : []),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open in webmail", emoji: true },
            url: WEBMAIL_URL,
            action_id: "open_webmail",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Acknowledge", emoji: true },
            action_id: "slack_ack",
            value: (messageId || subject).slice(0, 150),
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text:
              `to ${to} · class=${classified.cls} (score ${classified.score}` +
              `${classified.reasons.length ? `, ${classified.reasons.join(", ")}` : ""})` +
              `${spamScore ? ` · spam ${spamScore}` : ""}`,
          },
        ],
      },
    ],
  });

  if (!posted) {
    return NextResponse.json({ error: "Slack post failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, cls: classified.cls });
}
