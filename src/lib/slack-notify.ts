/**
 * Slack notifications via Block Kit.
 *
 * Uses the bot token (chat.postMessage) when SLACK_BOT_TOKEN is set,
 * otherwise falls back to the incoming webhook URL.
 * All sends are fire-and-forget with automatic retry + exponential backoff.
 */

import { getSlackConfigAsync } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlockKitBlock =
  // NOSONAR — discriminated union type annotations
  | {
      type: "section"; // NOSONAR
      text: { type: "mrkdwn" | "plain_text"; text: string }; // NOSONAR
      accessory?: unknown;
    }
  | { type: "divider" }
  | {
      type: "header";
      text: { type: "plain_text"; text: string; emoji?: boolean }; // NOSONAR
    }
  | {
      type: "context";
      elements: Array<{ type: "mrkdwn" | "plain_text"; text: string }>; // NOSONAR
    }
  | { type: "actions"; elements: Array<Record<string, unknown>> }
  | { type: string; [key: string]: unknown };

interface PostMessagePayload {
  channel?: string;
  text: string; // fallback for notifications
  blocks?: BlockKitBlock[];
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
  /** Reply in thread — pass the parent message's `ts` value. */
  thread_ts?: string;
  /**
   * Suppress Slack's automatic URL unfurling so bot messages stay clean.
   * Default: false (pass true to allow unfurls on specific messages).
   */
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// SlackClient
// ---------------------------------------------------------------------------

const CHAT_POST_URL = "https://slack.com/api/chat.postMessage";
const STATUS_SUCCEEDED = "succeeded";
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;
const BOT_USERNAME = "Cloudless";
const BOT_ICON_URL = "https://cloudless.gr/icons/icon-512.png";
const MAX_ERROR_TEXT_LENGTH = 2_000;
const MAX_NOTES_TEXT_LENGTH = 500;
const COMMIT_SHA_SHORT_LENGTH = 7;
const ORDER_SESSION_DISPLAY_LENGTH = 20;

export class SlackClient {
  /** Explicit per-instance channel override; otherwise resolved from config at post time. */
  private channelOverride?: string;
  private defaultChannel = "#general";

  constructor(opts?: { channel?: string }) {
    this.channelOverride = opts?.channel;
  }

  /** Send a Block Kit message with retry/backoff. Returns true on success. */
  async post(payload: PostMessagePayload): Promise<boolean> {
    // Resolve config lazily so SSM-backed tokens are available in Lambda
    // where env vars aren't set at module-load time.
    const cfg = await getSlackConfigAsync();
    const token = cfg.SLACK_BOT_TOKEN;
    const webhookUrl = cfg.SLACK_WEBHOOK_URL;
    // Channel priority: explicit instance override → env/SSM default → #general.
    this.defaultChannel = this.channelOverride || cfg.SLACK_DEFAULT_CHANNEL || "#general";

    if (!token && !webhookUrl) {
      // Slack not configured — skip silently (warning logged at config init)
      return false;
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.postOnce(payload, token, webhookUrl);
        if (result === true) return true;
        // null → terminal API error, don't retry
        if (result === null) return false;
        // number → rate-limited; respect Retry-After header delay
        await sleep(result);
      } catch (err) {
        if (attempt === MAX_RETRIES - 1) {
          console.error("[Slack] All retries exhausted:", err);
          return false;
        }
        // Exponential backoff for exception path
        await sleep(RETRY_BASE_MS * 2 ** attempt);
      }
    }

    return false;
  }

  /**
   * Single-attempt send.
   *
   * Priority:
   *   1. Bot token (chat.postMessage) → enables per-channel routing once the bot
   *      is a member of the target channel.
   *   2. If bot token returns a terminal error (not_in_channel, channel_not_found,
   *      account_inactive, etc.) → fall back to the incoming webhook so messages
   *      are never silently dropped while channels are being set up.
   *   3. If no bot token → webhook only.
   *
   * Returns:
   *   true    — sent
   *   number  — rate-limited; value is ms to wait before retrying
   *   null    — terminal error, do not retry
   */
  private async postOnce(
    payload: PostMessagePayload,
    token: string | undefined,
    webhookUrl: string | undefined
  ): Promise<true | number | null> {
    if (token) {
      const apiResult = await this.postViaApi(token, {
        channel: this.defaultChannel,
        ...payload,
      });
      if (apiResult === true) return true;
      // number → rate-limited with Retry-After delay — propagate to caller
      if (typeof apiResult === "number") return apiResult;
      // null → terminal (not_in_channel, wrong token, etc.) — fall back to webhook
      if (webhookUrl) return (await this.postViaWebhook(webhookUrl, payload)) ? true : null;
      return null;
    }
    if (webhookUrl) {
      const ok = await this.postViaWebhook(webhookUrl, payload);
      if (ok) return true;
      throw new Error("Slack webhook request failed");
    }
    return null;
  }

  /**
   * Returns:
   *   true    — message sent successfully
   *   number  — rate-limited; value is ms to delay before retrying (from Retry-After header)
   *   null    — terminal API error (wrong token, channel_not_found, etc.) — don't retry
   */
  private async postViaApi(
    token: string,
    payload: PostMessagePayload
  ): Promise<true | number | null> {
    const body = {
      ...payload,
      // Suppress URL unfurling by default — keeps bot messages clean.
      // Callers can opt in by setting unfurl_links: true on the payload.
      unfurl_links: payload.unfurl_links ?? false,
      unfurl_media: payload.unfurl_media ?? false,
    };
    const res = await fetch(CHAT_POST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });

    const data = (await res.json()) as SlackApiResponse;

    if (!data.ok) {
      console.error(`[Slack] chat.postMessage error: ${data.error}`);
      if (data.error === "ratelimited") {
        // Respect Retry-After header; fall back to 1s if absent
        const retryAfterSec = Number.parseInt(res.headers.get("Retry-After") ?? "1", 10);
        return (Number.isNaN(retryAfterSec) ? 1 : retryAfterSec) * 1_000;
      }
      return null;
    }

    return true;
  }

  private async postViaWebhook(webhookUrl: string, payload: PostMessagePayload): Promise<boolean> {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: payload.text, blocks: payload.blocks }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      console.error(`[Slack] Webhook error: ${res.status} ${res.statusText}`);
      return false;
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// Block Kit helpers
// ---------------------------------------------------------------------------

function headerBlock(text: string): BlockKitBlock {
  return { type: "header", text: { type: "plain_text", text, emoji: true } }; // NOSONAR
}

function sectionBlock(text: string): BlockKitBlock {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function contextBlock(...items: string[]): BlockKitBlock {
  return {
    type: "context",
    elements: items.map((t) => ({ type: "mrkdwn", text: t })),
  };
}

const divider: BlockKitBlock = { type: "divider" };

function slackTimestamp(): string {
  return `<!date^${Math.floor(Date.now() / 1_000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`;
}

// ---------------------------------------------------------------------------
// High-level notifiers
// ---------------------------------------------------------------------------

/**
 * Per-channel clients — each maps to a dedicated Slack channel.
 * Run `/slack-channels-setup` to provision missing channels automatically.
 * Falls back gracefully (channel_not_found → null) if a channel doesn't exist.
 */
const bookingsClient = new SlackClient({ channel: "#bookings" });
const ordersClient = new SlackClient({ channel: "#orders" });
const errorsClient = new SlackClient({ channel: "#errors" });
const deploymentsClient = new SlackClient({ channel: "#deployments" });
const contactsClient = new SlackClient({ channel: "#contacts" });
const campaignsClient = new SlackClient({ channel: "#campaigns" });
const subscribersClient = new SlackClient({ channel: "#subscribers" });

/**
 * Notify Slack when a new newsletter subscriber signs up.
 */
export async function slackSubscriberNotify(email: string): Promise<void> {
  const safeEmail = slackEscape(email);
  await subscribersClient.post({
    text: `New subscriber: ${safeEmail}`,
    blocks: [
      headerBlock("New Newsletter Subscriber"),
      sectionBlock(`*Email:* \`${safeEmail}\``),
      contextBlock(slackTimestamp(), "cloudless.gr subscribe form"),
      divider,
    ],
    icon_url: BOT_ICON_URL,
    username: BOT_USERNAME,
  });
}

// ---------------------------------------------------------------------------
// Error deduplication
//
// Prevents alert fatigue when the same error fires repeatedly. Identical
// errors (same title + first 120 chars of error text) are suppressed for
// ERROR_DEDUP_TTL_MS after the first occurrence. Map is lazily pruned.
// ---------------------------------------------------------------------------

const ERROR_DEDUP_TTL_MS = 10 * 60 * 1_000; // 10 minutes
const errorFingerprints = new Map<string, number>();

function errorFingerprint(title: string, errorText: string): string {
  return `${title}::${errorText.slice(0, 120)}`;
}

function isDuplicateError(title: string, errorText: string): boolean {
  const now = Date.now();
  // Lazy-prune stale entries
  for (const [key, ts] of errorFingerprints) {
    if (now - ts > ERROR_DEDUP_TTL_MS) errorFingerprints.delete(key);
  }
  const fp = errorFingerprint(title, errorText);
  if (errorFingerprints.has(fp)) return true;
  errorFingerprints.set(fp, now);
  return false;
}

/**
 * Notify Slack of an application error / exception.
 */
export async function slackErrorNotify(opts: {
  title: string;
  message: string;
  route?: string;
  error?: unknown;
}): Promise<void> {
  const errText =
    opts.error instanceof Error
      ? `${opts.error.name}: ${opts.error.message}`
      : String(opts.error ?? "");

  // Suppress repeated identical errors within the dedup window.
  if (isDuplicateError(opts.title, errText)) return;

  await errorsClient.post({
    text: `Error: ${opts.title}`,
    blocks: [
      headerBlock("Application Error"),
      sectionBlock(`*${opts.title}*\n${opts.message}`),
      ...(opts.route ? [sectionBlock(`*Route:* \`${opts.route}\``)] : []),
      ...(errText
        ? [sectionBlock(`*Details:*\n\`\`\`${errText.slice(0, MAX_ERROR_TEXT_LENGTH)}\`\`\``)]
        : []),
      contextBlock(slackTimestamp(), "cloudless.gr"),
      divider,
    ],
    icon_url: BOT_ICON_URL,
    username: BOT_USERNAME,
  });

  // Mirror to the admin notifications audit log. Lazy import so the
  // Slack lib has no static dependency on Dynamo — keeps the bundle
  // lighter for the many call sites that don't transitively need Dynamo.
  try {
    const { recordNotification } = await import("@/lib/admin-notifications");
    await recordNotification({
      category: "error",
      type: "error",
      title: opts.title,
      message: opts.message,
      route: opts.route,
      metadata: errText ? { error: errText.slice(0, MAX_ERROR_TEXT_LENGTH) } : undefined,
    });
  } catch (e) {
    console.warn("[slackErrorNotify] admin-notifications mirror failed:", e);
  }
}

/**
 * Notify Slack of a deployment event.
 */
export async function slackDeployNotify(opts: {
  version: string;
  stage: string;
  actor?: string;
  commitSha?: string;
  status: "started" | "succeeded" | "failed"; // NOSONAR — type annotation
}): Promise<void> {
  const statusEmoji =
    opts.status === STATUS_SUCCEEDED
      ? ":white_check_mark:"
      : opts.status === "failed"
        ? ":x:"
        : ":rocket:";

  const statusLabel =
    opts.status === STATUS_SUCCEEDED
      ? "Deploy succeeded"
      : opts.status === "failed"
        ? "Deploy failed"
        : "Deploy started";

  await deploymentsClient.post({
    text: `${statusLabel} — v${opts.version} (${opts.stage})`,
    blocks: [
      headerBlock(`${statusEmoji} ${statusLabel}`),
      sectionBlock(
        [
          `*Version:* \`${opts.version}\``,
          `*Stage:* \`${opts.stage}\``,
          opts.actor ? `*Actor:* ${opts.actor}` : null,
          opts.commitSha
            ? `*Commit:* \`${opts.commitSha.slice(0, COMMIT_SHA_SHORT_LENGTH)}\``
            : null,
        ]
          .filter((s): s is string => Boolean(s))
          .join("\n")
      ),
      contextBlock(slackTimestamp(), "cloudless.gr deploy pipeline"),
      divider,
    ],
    icon_url: BOT_ICON_URL,
    username: BOT_USERNAME,
  });
}

/** UTM sources that indicate a paid social/search campaign origin. */
const CAMPAIGN_UTM_SOURCES = new Set([
  "linkedin",
  "linkedin_ads",
  "linkedin-ads",
  "meta",
  "facebook",
  "instagram",
  "google",
  "google-ads",
  "google_ads",
  "tiktok",
  "tiktok-ads",
  "twitter",
  "x-ads",
]);

/** Pre-formatted notification for new contact form submissions */
export async function slackContactNotify(data: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  service?: string;
  message: string;
  /** Lead score 0\u2013100 (lead engine). */
  leadScore?: number;
  /** Score band label, e.g. "hot" / "warm" / "cold". */
  leadBand?: string;
  /** One-line attribution summary (UTM/referrer/landing page). */
  attributionSummary?: string;
  /** EspoCRM Contact ID \u2014 used to build a deep-link button. */
  espoContactId?: string | null;
  /** UTM source \u2014 when it's a paid social/search origin, also posts to #campaigns. */
  utmSource?: string | null;
}): Promise<boolean> {
  const safeName = slackEscape(data.name);
  const safeEmail = slackEscape(data.email);
  const safeCompany = data.company ? slackEscape(data.company) : "\u2014";
  const safeService = data.service ? slackEscape(data.service) : "\u2014";
  const safeMessage = slackEscape(data.message).slice(0, 2000);
  const detailLines = [
    `*Name:* ${safeName}`,
    `*Email:* ${safeEmail}`,
    ...(data.phone ? [`*Phone:* ${slackEscape(data.phone)}`] : []),
    `*Company:* ${safeCompany}`,
    `*Service:* ${safeService}`,
  ];
  if (typeof data.leadScore === "number") {
    const band = data.leadBand ? ` (${slackEscape(data.leadBand)})` : "";
    detailLines.push(`*Lead score:* ${data.leadScore}/100${band}`);
  }
  if (data.attributionSummary) {
    detailLines.push(`*Attribution:* ${slackEscape(data.attributionSummary).slice(0, 500)}`);
  }

  const blocks: BlockKitBlock[] = [
    headerBlock("\ud83d\udce8 New Contact Form Submission"),
    sectionBlock(detailLines.join("\n")),
    divider,
    sectionBlock(`*Message:*\n${safeMessage}`),
  ];

  if (data.espoContactId) {
    const espoUrl = `https://espocrm.cloudless.gr/#Contact/view/${data.espoContactId}`;
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open in EspoCRM", emoji: true },
          url: espoUrl,
          style: "primary",
        },
      ],
    });
  }

  blocks.push(contextBlock(slackTimestamp(), "cloudless.gr contact form"));

  const payload = {
    text: `New contact from ${safeName} (${safeEmail})`,
    blocks,
    icon_url: BOT_ICON_URL,
    username: BOT_USERNAME,
  };

  const isCampaignLead = data.utmSource && CAMPAIGN_UTM_SOURCES.has(data.utmSource.toLowerCase());

  const sends: Promise<boolean>[] = [contactsClient.post(payload)];
  if (isCampaignLead) {
    sends.push(campaignsClient.post(payload));
  }

  const results = await Promise.all(sends);
  return results[0];
}

/** Pre-formatted notification for a new consultation booking */
export async function slackBookingNotify(data: {
  name: string;
  email: string;
  start: string;
  notes?: string;
  meetLink?: string;
}): Promise<void> {
  const safeName = slackEscape(data.name);
  const safeEmail = slackEscape(data.email);
  const dateStr = slackEscape(
    new Date(data.start).toLocaleString("en-IE", {
      timeZone: "Europe/Athens",
      dateStyle: "full",
      timeStyle: "short",
    })
  );
  await bookingsClient.post({
    text: `📅 New consultation booked: ${safeName} (${safeEmail})`,
    blocks: [
      headerBlock("📅 New Consultation Booked"),
      sectionBlock(
        [
          `*Name:* ${safeName}`,
          `*Email:* ${safeEmail}`,
          `*Time:* ${dateStr} (Athens)`,
          ...(data.meetLink ? [`*Meet:* <${data.meetLink}|Join Google Meet>`] : []),
        ].join("\n")
      ),
      ...(data.notes
        ? [sectionBlock(`*Notes:*\n${slackEscape(data.notes).slice(0, MAX_NOTES_TEXT_LENGTH)}`)]
        : []),
      contextBlock(slackTimestamp(), "cloudless.gr calendar booking"),
    ],
    icon_url: BOT_ICON_URL,
    username: BOT_USERNAME,
  });
}

/** Pre-formatted notification for new orders */
export async function slackOrderNotify(data: {
  email: string;
  amount: string;
  sessionId: string;
  name?: string;
  phone?: string;
  campaign?: string;
  tier?: string;
  /** Optional attribution summary (UTM source/medium/campaign/content/term plus
   *  campaign_slug and tier) extracted from the Stripe Session metadata. When
   *  present, surfaced as an extra line so the operator can see immediately
   *  which ad creative drove the conversion. */
  attribution?: string;
}): Promise<boolean> {
  const safeEmail = slackEscape(data.email);
  const lines = [
    `*Customer:* ${data.name ? `${slackEscape(data.name)} · ` : ""}${safeEmail}${data.phone ? ` · ${slackEscape(data.phone)}` : ""}`,
    `*Amount:* ${data.amount}`,
    `*Session:* \`${data.sessionId.slice(0, ORDER_SESSION_DISPLAY_LENGTH)}...\``,
  ];
  if (data.campaign || data.tier) {
    const parts = [data.campaign, data.tier].filter(Boolean).map((s) => slackEscape(s!));
    lines.push(`*Campaign:* ${parts.join(" · ")}`);
  }
  if (data.attribution) {
    lines.push(`*Attribution:* ${slackEscape(data.attribution)}`);
  }
  return ordersClient.post({
    text: `New order: ${data.amount} from ${safeEmail}`,
    blocks: [
      headerBlock("\ud83d\udcb0 New Order"),
      sectionBlock(lines.join("\n")),
      contextBlock(slackTimestamp(), "cloudless.gr stripe checkout"),
    ],
    icon_url: BOT_ICON_URL,
    username: BOT_USERNAME,
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Escape Slack mrkdwn special characters in user-supplied strings.
 * Prevents link injection (<url|text>) and @mention injection (<@here>).
 */
function slackEscape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// ---------------------------------------------------------------------------
// Customer Interaction Notifications (Phase: full coverage)
// ---------------------------------------------------------------------------

const interactionsClient = new SlackClient({ channel: "#notifications" });

/** Notify when a user starts a chat conversation with the AI assistant. */
export async function slackChatNotify(data: { message: string; ip?: string }): Promise<boolean> {
  const preview = data.message.length > 100 ? data.message.slice(0, 100) + "…" : data.message;
  return interactionsClient.post({
    text: `New chat: "${preview}"`,
    blocks: [
      headerBlock("💬 Chat Started"),
      sectionBlock(`*Message:* ${slackEscape(preview)}${data.ip ? `\n*IP:* ${data.ip}` : ""}`),
      contextBlock(slackTimestamp(), "cloudless.gr chat"),
    ],
    icon_url: BOT_ICON_URL,
    username: BOT_USERNAME,
  });
}

/** Notify when a support ticket is created via EspoCRM. */
export async function slackTicketNotify(data: {
  subject: string;
  email?: string;
  priority: string;
}): Promise<boolean> {
  const lines = [`*Subject:* ${slackEscape(data.subject)}`, `*Priority:* ${data.priority}`];
  if (data.email) lines.push(`*Email:* ${slackEscape(data.email)}`);
  return interactionsClient.post({
    text: `New ticket: ${data.subject}`,
    blocks: [
      headerBlock("🎫 Support Ticket"),
      sectionBlock(lines.join("\n")),
      contextBlock(slackTimestamp(), "cloudless.gr espocrm"),
    ],
    icon_url: BOT_ICON_URL,
    username: BOT_USERNAME,
  });
}

/** Notify when a new user registers. */
export async function slackRegistrationNotify(email: string): Promise<boolean> {
  return interactionsClient.post({
    text: `New registration: ${email}`,
    blocks: [
      headerBlock("👤 New Registration"),
      sectionBlock(`*Email:* ${slackEscape(email)}`),
      contextBlock(slackTimestamp(), "cloudless.gr auth"),
    ],
    icon_url: BOT_ICON_URL,
    username: BOT_USERNAME,
  });
}
