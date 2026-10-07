/**
 * Cloudflare Email Worker (FREE): inbound @cloudless.gr → HTTPS ingest on omv-ha.
 *
 * Email Routing binds this Worker; we POST raw RFC822 to MAIL_INGEST_URL with a
 * shared secret. Optional FALLBACK_FORWARD (verified destination) keeps Gmail
 * as a safety net while soak-testing.
 *
 * Spam layer (replaces rspamd — too heavy for the 1 GB Pi):
 *   score < SPAM_TAG_AT     → deliver untouched
 *   score >= SPAM_TAG_AT    → deliver with X-Spam-Flag: YES (Sieve files to Junk)
 *   score >= SPAM_REJECT_AT → SMTP-time reject (setReject), never ingested
 *
 * Secrets (wrangler secret put):
 *   MAIL_INGEST_SECRET
 * Vars:
 *   MAIL_INGEST_URL=https://webmail.cloudless.gr/ingest
 *   FALLBACK_FORWARD=themis.baltzakis@gmail.com  (optional)
 *   SPAM_TAG_AT="4" SPAM_REJECT_AT="9" SPAM_BLOCK_SENDERS="bad.com,scammer"
 */
import PostalMime from "postal-mime";

export interface Env {
  MAIL_INGEST_URL: string;
  MAIL_INGEST_SECRET: string;
  /** Verified Email Routing destination — optional Gmail safety net. */
  FALLBACK_FORWARD?: string;
  SPAM_TAG_AT?: string;
  SPAM_REJECT_AT?: string;
  /** Comma-separated From/envelope substrings that instantly reject. */
  SPAM_BLOCK_SENDERS?: string;
  /** Mail→Slack bridge: cloudless.gr endpoint + shared secret. */
  SLACK_INGEST_URL?: string;
  SLACK_INGEST_SECRET?: string;
  /** Comma-separated local-parts routed to Slack (default "slack@"). */
  SLACK_ROUTE_PREFIXES?: string;
}

export interface SpamVerdict {
  score: number;
  reasons: string[];
}

const SPAM_SUBJECT =
  /(seed phrase|wallet (verify|unlock|recovery)|you have won|lottery|inheritance fund|urgent (invoice|payment|verification)|account (suspended|locked|verify)|crypto giveaway|free bitcoin)/i;

/** Public IPv4 from the SPF comment or the Received chain. */
export function senderIpFromHeaders(headers: Headers): string | null {
  const spf = headers.get("received-spf") ?? "";
  const spfMatch = spf.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
  if (spfMatch && isPublicIp(spfMatch[1])) return spfMatch[1];

  const getAll = (
    headers as Headers & { getAll?: (name: string) => string[] }
  ).getAll;
  const receivedHeaders = [
    ...(getAll?.call(headers, "received") ?? []),
    headers.get("received") ?? "",
  ];
  for (const received of receivedHeaders) {
    const ips = received.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? [];
    for (const ip of ips) {
      if (isPublicIp(ip)) return ip;
    }
  }
  return null;
}

function isPublicIp(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return !(
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

/** Header-only spam score — pure, unit-testable. */
export function scoreHeaders(headers: Headers, envelopeFrom = ""): SpamVerdict {
  let score = 0;
  const reasons: string[] = [];

  // Cloudflare Email Routing stamps Received-SPF before invoking the Worker.
  const spf = (headers.get("received-spf") ?? "").toLowerCase();
  if (spf.startsWith("fail")) {
    score += 5;
    reasons.push("spf_fail");
  } else if (spf.startsWith("softfail")) {
    score += 3;
    reasons.push("spf_softfail");
  } else if (spf.startsWith("neutral") || spf.startsWith("none")) {
    score += 1;
    reasons.push("spf_" + (spf.startsWith("neutral") ? "neutral" : "none"));
  }

  const auth = (headers.get("authentication-results") ?? "").toLowerCase();
  if (/dkim\s*=\s*fail/.test(auth)) {
    score += 2;
    reasons.push("dkim_fail");
  }
  if (/dmarc\s*=\s*fail/.test(auth)) {
    score += 3;
    reasons.push("dmarc_fail");
  }

  const from = headers.get("from") ?? "";
  const fromDomain = from.match(/@([a-z0-9.\-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();
  if (!from.trim()) {
    score += 2;
    reasons.push("missing_from");
  } else if (!fromDomain) {
    score += 2;
    reasons.push("malformed_from");
  }

  const replyTo = headers.get("reply-to") ?? "";
  const replyDomain = replyTo.match(/@([a-z0-9.\-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();
  if (fromDomain && replyDomain && replyDomain !== fromDomain) {
    score += 1;
    reasons.push("replyto_domain_mismatch");
  }

  if (!headers.get("message-id")) {
    score += 1;
    reasons.push("no_message_id");
  }

  const subject = headers.get("subject") ?? "";
  if (SPAM_SUBJECT.test(subject)) {
    score += 2;
    reasons.push("subject_spam_terms");
  }

  return { score, reasons };
}

/** DNS-over-HTTPS lookup; returns answer addresses or [] on any failure. */
async function doh(name: string, type: "A" | "MX"): Promise<string[]> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(2500),
      }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { Answer?: { data: string }[] };
    return (json.Answer ?? []).map((a) => a.data);
  } catch {
    return [];
  }
}

/**
 * Network signals: DNSBL on the sending IP (SpamCop + DroneBL — Spamhaus zen
 * refuses public-resolver queries) + From-domain MX/A existence.
 * Every failure path is non-fatal (score contribution 0).
 */
export async function scoreDns(
  headers: Headers,
  senderIp: string | null
): Promise<SpamVerdict> {
  let score = 0;
  const reasons: string[] = [];

  if (senderIp) {
    const rev = senderIp.split(".").reverse().join(".");
    const lists = ["bl.spamcop.net", "dnsbl.dronebl.org"];
    const hits = await Promise.all(
      lists.map(async (zone) => ((await doh(`${rev}.${zone}`, "A")).length ? zone : null))
    );
    const listed = hits.filter(Boolean);
    if (listed.length) {
      score += 4;
      reasons.push(`dnsbl:${listed.join(",")}`);
    }
  }

  const from = headers.get("from") ?? "";
  const fromDomain = from.match(/@([a-z0-9.\-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();
  if (fromDomain) {
    const [mx, a] = await Promise.all([doh(fromDomain, "MX"), doh(fromDomain, "A")]);
    if (!mx.length && !a.length) {
      score += 2;
      reasons.push("from_domain_no_mx");
    }
  }

  return { score, reasons };
}

/** Prepend X-Spam-* headers to raw RFC822 before LDA delivery. */
function tagRaw(raw: ArrayBuffer, verdict: SpamVerdict): ArrayBuffer {
  const reasons = verdict.reasons.join(",").replace(/[\r\n]+/g, " ").slice(0, 400);
  const prepend = new TextEncoder().encode(
    `X-Spam-Flag: YES\r\nX-Spam-Score: ${verdict.score}\r\nX-Spam-Reasons: ${reasons}\r\n`
  );
  const out = new Uint8Array(prepend.length + raw.byteLength);
  out.set(prepend, 0);
  out.set(new Uint8Array(raw), prepend.length);
  return out.buffer;
}

/** True when the envelope recipient is a Slack-routed alias (default: slack@). */
function isSlackRouted(to: string, env: Env): boolean {
  const local = (to.split("@")[0] ?? "").toLowerCase();
  const prefixes = (env.SLACK_ROUTE_PREFIXES ?? "slack")
    .split(",")
    .map((s) => s.trim().replace(/@$/, "").toLowerCase())
    .filter(Boolean);
  return prefixes.includes(local);
}

/**
 * Parse the RFC822 and POST a normalized summary to the app's
 * /api/slack/inbound-email endpoint. Only headers + a truncated text excerpt
 * leave the Worker — HTML bodies and attachments never do.
 */
async function postToSlackIngest(
  raw: ArrayBuffer,
  message: ForwardableEmailMessage,
  verdict: SpamVerdict,
  env: Env
): Promise<void> {
  let text = "";
  let subject = message.headers.get("subject") ?? "";
  let from = message.headers.get("from") ?? "";
  let messageId = message.headers.get("message-id") ?? "";
  let listId = message.headers.get("list-id") ?? "";
  let precedence = message.headers.get("precedence") ?? "";
  let autoSubmitted = message.headers.get("auto-submitted") ?? "";

  try {
    const parsed = await PostalMime.parse(raw);
    text = parsed.text ?? "";
    subject = parsed.subject ?? subject;
    from = parsed.from?.address
      ? `${parsed.from.name ? `${parsed.from.name} ` : ""}<${parsed.from.address}>`
      : from;
    messageId = parsed.messageId ?? messageId;
  } catch (err) {
    console.error("postal-mime parse failed; posting headers only", err);
  }

  const res = await fetch(env.SLACK_INGEST_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mail-to-slack-secret": env.SLACK_INGEST_SECRET!,
    },
    body: JSON.stringify({
      to: message.to,
      from,
      subject,
      text: text.slice(0, 6000), // the app truncates further for the card
      message_id: messageId,
      list_id: listId,
      precedence,
      auto_submitted: autoSubmitted,
      spam_score: verdict.score,
      spam_reasons: verdict.reasons,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error(`slack-ingest ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

export default {
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const subject = message.headers.get("subject") ?? "";
    const tagAt = parseInt(env.SPAM_TAG_AT ?? "4", 10);
    const rejectAt = parseInt(env.SPAM_REJECT_AT ?? "9", 10);

    const verdict = scoreHeaders(message.headers, message.from);
    const dns = await scoreDns(message.headers, senderIpFromHeaders(message.headers));
    verdict.score += dns.score;
    verdict.reasons.push(...dns.reasons);

    const blocked = (env.SPAM_BLOCK_SENDERS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const haystack = `${message.from} ${message.headers.get("from") ?? ""}`.toLowerCase();
    if (blocked.some((b) => haystack.includes(b))) {
      verdict.score += 10;
      verdict.reasons.push("blocklisted_sender");
    }

    console.log(
      JSON.stringify({
        event: "inbound",
        from: message.from,
        to: message.to,
        subject,
        bytes: message.rawSize,
        spamScore: verdict.score,
        spamReasons: verdict.reasons,
      })
    );

    if (verdict.score >= rejectAt) {
      console.log(`rejecting spam score=${verdict.score} reasons=${verdict.reasons}`);
      message.setReject("Message rejected: spam policy");
      return;
    }

    if (!env.MAIL_INGEST_URL || !env.MAIL_INGEST_SECRET) {
      console.error("MAIL_INGEST_URL or MAIL_INGEST_SECRET unset");
      if (env.FALLBACK_FORWARD) {
        await message.forward(env.FALLBACK_FORWARD);
        return;
      }
      message.setReject("Mailbox ingest not configured");
      return;
    }

    try {
      let raw = await new Response(message.raw).arrayBuffer();
      if (verdict.score >= tagAt) {
        raw = tagRaw(raw, verdict);
      }

      // Mail→Slack bridge: addresses like slack@cloudless.gr are mirrored to
      // the admin Slack workspace (sorted by /api/slack/inbound-email) AND
      // still delivered to the mailbox below — Slack is the notification
      // surface, not the mail store. Best-effort: a Slack failure must never
      // lose the email.
      if (isSlackRouted(message.to, env) && env.SLACK_INGEST_URL && env.SLACK_INGEST_SECRET) {
        try {
          await postToSlackIngest(raw, message, verdict, env);
        } catch (err) {
          console.error("slack-ingest threw (mail still delivered)", err);
        }
      }

      const res = await fetch(env.MAIL_INGEST_URL, {
        method: "POST",
        headers: {
          "content-type": "message/rfc822",
          "x-mail-ingest-secret": env.MAIL_INGEST_SECRET,
          "x-mail-to": message.to,
          "x-mail-from": message.from,
          "x-mail-spam-score": String(verdict.score),
        },
        body: raw,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`ingest ${res.status}: ${detail.slice(0, 200)}`);
        if (env.FALLBACK_FORWARD) {
          await message.forward(env.FALLBACK_FORWARD);
          return;
        }
        message.setReject(`Ingest failed (${res.status})`);
        return;
      }

      // Optional mirror to Gmail during cutover (set FALLBACK_FORWARD + MIRROR=1 via var)
      // Default: deliver only to dovecot once ingest succeeds.
    } catch (err) {
      console.error("ingest threw", err);
      if (env.FALLBACK_FORWARD) {
        await message.forward(env.FALLBACK_FORWARD);
        return;
      }
      message.setReject("Ingest unavailable");
    }
  },
};
