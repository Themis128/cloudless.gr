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
  | {
      type: "section";
      text: { type: "mrkdwn" | "plain_text"; text: string };
      accessory?: unknown;
    }
  | { type: "divider" }
  | {
      type: "header";
      text: { type: "plain_text"; text: string; emoji?: boolean };
    }
  | {
      type: "context";
      elements: Array<{ type: "mrkdwn" | "plain_text"; text: string }>;
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
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

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

    // Prefer the incoming webhook when configured: it posts to the channel
    // chosen at app install without requiring the bot to be a channel member.
    // chat.postMessage is only reachable for channels the bot has joined,
    // which we cannot do programmatically without channels:join scope.
    const useWebhookFirst = !!webhookUrl;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // postViaApi returns: true = success, false = ratelimited (retry), null = terminal error
        let result: boolean | null;
        if (useWebhookFirst) {
          result = await this.postViaWebhook(webhookUrl, payload);
        } else if (token) {
          result = await this.postViaApi(token, {
            channel: this.defaultChannel,
            ...payload,
          });
        } else {
          return false;
        }

        if (result === true) return true;
        if (result === null) {
          // Terminal API error (not_in_channel, channel_not_found, invalid_auth, …).
          // Only reachable via the API path; webhook returns boolean.
          return false;
        }
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
  return { type: "header", text: { type: "plain_text", text, emoji: true } };
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
      contextBlock(
        `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
        "cloudless.gr subscribe form",
      ),
      divider,
    ],
    icon_emoji: ":envelope:",
    username: "Cloudless Bot",
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
        ? [sectionBlock(`*Details:*\n\`\`\`${errText.slice(0, 2000)}\`\`\``)]
        : []),
      contextBlock(
        `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
        "cloudless.gr",
      ),
      divider,
    ],
    icon_emoji: ":rotating_light:",
    username: "Cloudless Bot",
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
  status: "started" | "succeeded" | "failed";
}): Promise<void> {
  const statusEmoji =
    opts.status === "succeeded"
      ? ":white_check_mark:"
      : opts.status === "failed"
        ? ":x:"
        : ":rocket:";

  const statusLabel =
    opts.status === "succeeded"
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
          opts.commitSha ? `*Commit:* \`${opts.commitSha.slice(0, 7)}\`` : null,
        ]
          .filter((s): s is string => Boolean(s))
          .join("\n"),
      ),
      contextBlock(
        `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
        "cloudless.gr deploy pipeline",
      ),
      divider,
    ],
    icon_emoji: statusEmoji,
    username: "Cloudless Bot",
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
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*Name:* ${safeName}`,
            `*Email:* ${safeEmail}`,
            `*Company:* ${safeCompany}`,
            `*Service:* ${safeService}`,
          ].join("\n"),
        },
      },
      divider,
      sectionBlock(`*Message:*\n${safeMessage}`),
      contextBlock(
        `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
        "cloudless.gr contact form",
      ),
    ],
    icon_emoji: ":incoming_envelope:",
    username: "Cloudless Bot",
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
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*Name:* ${safeName}`,
            `*Email:* ${safeEmail}`,
            `*Time:* ${dateStr} (Athens)`,
          ].join("\n"),
        },
      },
      ...(data.notes
        ? [sectionBlock(`*Notes:*\n${slackEscape(data.notes).slice(0, 500)}`)]
        : []),
      contextBlock(
        `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
        "cloudless.gr calendar booking",
      ),
    ],
    icon_emoji: ":calendar:",
    username: "Cloudless Bot",
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
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*Customer:* ${safeEmail}`,
            `*Amount:* ${data.amount}`,
            `*Session:* \`${data.sessionId.slice(0, 20)}...\``,
          ].join("\n"),
        },
      },
      contextBlock(
        `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
        "cloudless.gr stripe checkout",
      ),
    ],
    icon_emoji: ":moneybag:",
    username: "Cloudless Bot",
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
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
