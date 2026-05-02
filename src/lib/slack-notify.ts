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

export type BlockKitBlock = // NOSONAR — discriminated union type annotations
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
const BOT_USERNAME = "Cloudless Bot";
const MAX_ERROR_TEXT_LENGTH = 2_000;
const MAX_NOTES_TEXT_LENGTH = 500;
const COMMIT_SHA_SHORT_LENGTH = 7;
const ORDER_SESSION_DISPLAY_LENGTH = 20;

export class SlackClient {
  private defaultChannel: string;

  constructor(opts?: { channel?: string }) {
    this.defaultChannel =
      opts?.channel ?? process.env.SLACK_DEFAULT_CHANNEL ?? "#general";
  }

  /** Send a Block Kit message with retry/backoff. Returns true on success. */
  async post(payload: PostMessagePayload): Promise<boolean> {
    // Resolve config lazily so SSM-backed tokens are available in Lambda
    // where env vars aren't set at module-load time.
    const cfg = await getSlackConfigAsync();
    const token = cfg.SLACK_BOT_TOKEN;
    const webhookUrl = cfg.SLACK_WEBHOOK_URL;

    if (!token && !webhookUrl) {
      // Slack not configured — skip silently (warning logged at config init)
      return false;
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.postOnce(payload, token, webhookUrl); // NOSONAR — sequential retry requires loop
        if (result === true) return true;
        // result === null → terminal API error, don't retry
        if (result === null) return false;
        // result === false → ratelimited or transient failure, fall through to backoff
      } catch (err) {
        const isLastAttempt = attempt === MAX_RETRIES - 1;
        if (isLastAttempt) {
          console.error("[Slack] All retries exhausted:", err);
          return false;
        }
      }

      // Exponential backoff: 500 ms, 1 000 ms, 2 000 ms
      await sleep(RETRY_BASE_MS * 2 ** attempt);
    }

    return false;
  }

  /**
   * Single-attempt send. Prefers the incoming webhook when configured: it posts
   * to the channel chosen at app install without requiring the bot to be a
   * channel member. chat.postMessage is only reachable for channels the bot has
   * joined, which we cannot do programmatically without the channels:join scope.
   */
  private async postOnce(
    payload: PostMessagePayload,
    token: string | undefined,
    webhookUrl: string | undefined,
  ): Promise<boolean | null> {
    if (webhookUrl) return this.postViaWebhook(webhookUrl, payload);
    if (token) {
      return this.postViaApi(token, {
        channel: this.defaultChannel,
        ...payload,
      });
    }
    return null;
  }

  /**
   * Returns:
   *   true  — message sent successfully
   *   false — rate-limited (caller should back off and retry)
   *   null  — terminal API error (wrong token, channel_not_found, etc.) — don't retry
   */
  private async postViaApi(
    token: string,
    payload: PostMessagePayload,
  ): Promise<boolean | null> {
    const res = await fetch(CHAT_POST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as SlackApiResponse;

    if (!data.ok) {
      console.error(`[Slack] chat.postMessage error: ${data.error}`);
      // ratelimited → retryable (return false so caller backs off)
      // any other error is terminal (wrong token, channel_not_found, etc.) → return null
      return data.error === "ratelimited" ? false : null;
    }

    return true;
  }

  private async postViaWebhook(
    webhookUrl: string,
    payload: PostMessagePayload,
  ): Promise<boolean> {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: payload.text, blocks: payload.blocks }),
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

const client = new SlackClient();

/**
 * Notify Slack when a new newsletter subscriber signs up.
 */
export async function slackSubscriberNotify(email: string): Promise<void> {
  const safeEmail = slackEscape(email);
  await client.post({
    text: `New subscriber: ${safeEmail}`,
    blocks: [
      headerBlock("New Newsletter Subscriber"),
      sectionBlock(`*Email:* \`${safeEmail}\``),
      contextBlock(slackTimestamp(), "cloudless.gr subscribe form"),
      divider,
    ],
    icon_emoji: ":envelope:",
    username: BOT_USERNAME,
  });
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

  await client.post({
    text: `Error: ${opts.title}`,
    blocks: [
      headerBlock("Application Error"),
      sectionBlock(`*${opts.title}*\n${opts.message}`),
      ...(opts.route ? [sectionBlock(`*Route:* \`${opts.route}\``)] : []),
      ...(errText
        ? [
            sectionBlock(
              `*Details:*\n\`\`\`${errText.slice(0, MAX_ERROR_TEXT_LENGTH)}\`\`\``,
            ),
          ]
        : []),
      contextBlock(slackTimestamp(), "cloudless.gr"),
      divider,
    ],
    icon_emoji: ":rotating_light:",
    username: BOT_USERNAME,
  });
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

  await client.post({
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
          .join("\n"),
      ),
      contextBlock(slackTimestamp(), "cloudless.gr deploy pipeline"),
      divider,
    ],
    icon_emoji: statusEmoji,
    username: BOT_USERNAME,
  });
}

// ---------------------------------------------------------------------------
// Legacy API — kept for backward compatibility with existing routes
// ---------------------------------------------------------------------------

interface SlackMessage {
  text: string;
  blocks?: Record<string, unknown>[];
}

/**
 * Send a raw message to Slack webhook.
 * @deprecated Use SlackClient.post() for new code.
 */
export async function slackNotify(message: SlackMessage): Promise<boolean> {
  return client.post({
    text: message.text,
    blocks: message.blocks as BlockKitBlock[],
  });
}

/** Pre-formatted notification for new contact form submissions */
export async function slackContactNotify(data: {
  name: string;
  email: string;
  company?: string;
  service?: string;
  message: string;
}): Promise<boolean> {
  const safeName = slackEscape(data.name);
  const safeEmail = slackEscape(data.email);
  const safeCompany = data.company ? slackEscape(data.company) : "\u2014";
  const safeService = data.service ? slackEscape(data.service) : "\u2014";
  const safeMessage = slackEscape(data.message).slice(0, 2000);
  return client.post({
    text: `New contact from ${safeName} (${safeEmail})`,
    blocks: [
      headerBlock("\ud83d\udce8 New Contact Form Submission"),
      sectionBlock(
        [
          `*Name:* ${safeName}`,
          `*Email:* ${safeEmail}`,
          `*Company:* ${safeCompany}`,
          `*Service:* ${safeService}`,
        ].join("\n"),
      ),
      divider,
      sectionBlock(`*Message:*\n${safeMessage}`),
      contextBlock(slackTimestamp(), "cloudless.gr contact form"),
    ],
    icon_emoji: ":incoming_envelope:",
    username: BOT_USERNAME,
  });
}

/** Pre-formatted notification for a new consultation booking */
export async function slackBookingNotify(data: {
  name: string;
  email: string;
  start: string;
  notes?: string;
}): Promise<void> {
  const safeName = slackEscape(data.name);
  const safeEmail = slackEscape(data.email);
  const dateStr = slackEscape(
    new Date(data.start).toLocaleString("en-IE", {
      timeZone: "Europe/Athens",
      dateStyle: "full",
      timeStyle: "short",
    }),
  );
  await client.post({
    text: `📅 New consultation booked: ${safeName} (${safeEmail})`,
    blocks: [
      headerBlock("📅 New Consultation Booked"),
      sectionBlock(
        [
          `*Name:* ${safeName}`,
          `*Email:* ${safeEmail}`,
          `*Time:* ${dateStr} (Athens)`,
        ].join("\n"),
      ),
      ...(data.notes
        ? [
            sectionBlock(
              `*Notes:*\n${slackEscape(data.notes).slice(0, MAX_NOTES_TEXT_LENGTH)}`,
            ),
          ]
        : []),
      contextBlock(slackTimestamp(), "cloudless.gr calendar booking"),
    ],
    icon_emoji: ":calendar:",
    username: BOT_USERNAME,
  });
}

/** Pre-formatted notification for new orders */
export async function slackOrderNotify(data: {
  email: string;
  amount: string;
  sessionId: string;
}): Promise<boolean> {
  const safeEmail = slackEscape(data.email);
  return client.post({
    text: `New order: ${data.amount} from ${safeEmail}`,
    blocks: [
      headerBlock("\ud83d\udcb0 New Order"),
      sectionBlock(
        [
          `*Customer:* ${safeEmail}`,
          `*Amount:* ${data.amount}`,
          `*Session:* \`${data.sessionId.slice(0, ORDER_SESSION_DISPLAY_LENGTH)}...\``,
        ].join("\n"),
      ),
      contextBlock(slackTimestamp(), "cloudless.gr stripe checkout"),
    ],
    icon_emoji: ":moneybag:",
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
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
