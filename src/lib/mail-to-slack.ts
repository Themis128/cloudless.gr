/**
 * Mail → Slack sorting rules.
 *
 * Deterministic scored classification used by /api/slack/inbound-email:
 * each signal contributes a score; the highest bucket wins.
 *
 *   alert — monitoring/security/billing senders or alert subjects → #ops-alerts
 *   human — direct correspondence                                → #inbox
 *   bulk  — newsletters/marketing/auto-mail                      → suppressed
 *           (still delivered to the mailbox; Slack stays clean)
 */

export type MailClass = "alert" | "human" | "bulk";

export interface ClassifiedMail {
  cls: MailClass;
  score: number;
  reasons: string[];
  channel: string;
}

// ---------------------------------------------------------------------------
// Mail sorting — scored rules, highest bucket wins
// ---------------------------------------------------------------------------
/** Senders whose mail is operational by definition — matched on the From
 *  domain (substring). Extend here, not in scattered conditionals. */
const ALERT_SENDER_DOMAINS = [
  "github.com",
  "sentry.io",
  "stripe.com",
  "paddle.com",
  "dodopayments.com",
  "cloudflare.com",
  "resend.com",
  "uptimekuma",
  "kuma",
  "linkedin.com", // security + developer-program mail
  "developers.facebook.com",
  "tiktok.com",
  "slack.com",
];

/** Subject terms that escalate any sender to alert. */
const ALERT_SUBJECT =
  /(down|offline|incident|outage|failed|failure|error|alert|security|suspicious|verify your|action required|payment (failed|declined)|invoice|receipt|dispute|chargeback|quota|rate.?limit)/i;

/** Headers that mark bulk/auto mail outright. */
function isBulkMail(body: Record<string, unknown>): boolean {
  if (body.list_id) return true;
  const precedence = String(body.precedence ?? "").toLowerCase();
  if (precedence === "bulk" || precedence === "list" || precedence === "junk") return true;
  const autoSubmitted = String(body.auto_submitted ?? "").toLowerCase();
  // RFC 3834 — anything but "no" means machine-generated
  if (autoSubmitted && autoSubmitted !== "no") return true;
  const text = String(body.text ?? "");
  return /unsubscribe/i.test(text.slice(0, 4000));
}

export function classifyEmail(body: Record<string, unknown>): ClassifiedMail {
  const from = String(body.from ?? "").toLowerCase();
  const subject = String(body.subject ?? "");
  const spamScore = Number(body.spam_score ?? 0);
  const reasons: string[] = [];
  let score = 0;

  const fromDomain = from.match(/@([a-z0-9.\-]+\.[a-z]{2,})/)?.[1] ?? "";
  if (ALERT_SENDER_DOMAINS.some((d) => fromDomain.endsWith(d))) {
    score += 4;
    reasons.push(`alert_sender:${fromDomain}`);
  }
  if (ALERT_SUBJECT.test(subject)) {
    score += 4;
    reasons.push("alert_subject");
  }
  if (spamScore >= 4) {
    score -= 2;
    reasons.push("spam_penalty");
  }
  if (isBulkMail(body)) {
    score -= 3;
    reasons.push("bulk_markers");
  }

  const cls: MailClass = score >= 4 ? "alert" : score < 0 ? "bulk" : "human";
  const channel =
    cls === "alert"
      ? process.env.SLACK_OPS_CHANNEL || "#ops-alerts"
      : cls === "human"
        ? process.env.SLACK_INBOX_CHANNEL || "#inbox"
        : "";
  return { cls, score, reasons, channel };
}

