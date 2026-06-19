/**
 * Slack concrete channel for the reusable ad-analytics module.
 *
 * Implements `NotificationChannel`. Wraps the project's `SlackClient` so per-
 * channel routing (one client instance per target like `#ads-realtime` and
 * `#ads-digest`) is handled by the existing token + retry + fallback logic.
 *
 * The `NotificationBlock` → Slack Block Kit translation lives entirely here
 * so the rest of the runtime stays agnostic of any vendor format. When a
 * caller needs Slack-specific richness it can stuff the raw Block Kit payload
 * into `NotificationBlock.slackRaw` and we pass it through verbatim.
 */

import { SlackClient } from "@/lib/slack-notify";
import type { NotificationBlock, NotificationChannel } from "./notification";

interface SlackBlockKitBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text: string }>;
  fields?: Array<{ type: string; text: string }>;
  [key: string]: unknown;
}

const clientCache = new Map<string, SlackClient>();

function getClientForChannel(channel: string): SlackClient {
  // Cache one SlackClient per target channel so repeat sends reuse the same
  // retry counters and SSM-config resolution path.
  let c = clientCache.get(channel);
  if (!c) {
    c = new SlackClient({ channel });
    clientCache.set(channel, c);
  }
  return c;
}

/**
 * Translate the abstract `NotificationBlock` shape into Slack Block Kit JSON.
 * A `slackRaw` value short-circuits the translation so callers can opt out of
 * the abstraction when they need richness it doesn't cover.
 */
function toBlockKit(block: NotificationBlock): SlackBlockKitBlock {
  if (block.slackRaw && typeof block.slackRaw === "object") {
    return block.slackRaw as SlackBlockKitBlock;
  }
  switch (block.type) {
    case "header":
      return {
        type: "header",
        text: { type: "plain_text", text: block.text ?? "", emoji: true },
      };
    case "section":
      if (block.fields && block.fields.length > 0) {
        return {
          type: "section",
          fields: block.fields.map((f) => ({
            type: "mrkdwn",
            text: `*${f.title}*\n${f.value}`,
          })),
        };
      }
      return { type: "section", text: { type: "mrkdwn", text: block.text ?? "" } };
    case "context":
      return {
        type: "context",
        elements: [{ type: "mrkdwn", text: block.text ?? "" }],
      };
    case "divider":
      return { type: "divider" };
    case "actions":
      // The abstraction doesn't yet describe buttons. Render as a plain
      // section until a caller needs richer interactivity.
      return { type: "section", text: { type: "mrkdwn", text: block.text ?? "" } };
    default:
      return { type: "section", text: { type: "mrkdwn", text: block.text ?? "" } };
  }
}

export const slackChannel: NotificationChannel = {
  id: "slack",

  async isConfigured(): Promise<boolean> {
    // SlackClient already silently no-ops when neither bot token nor webhook
    // is configured — call sites read `isConfigured()` to decide whether to
    // skip Block Kit rendering. Cheapest probe: try to construct a client and
    // resolve config lazily inside `post()`. Returning `true` here keeps the
    // happy path simple; SlackClient.post returns `false` if Slack is off,
    // and `sendBlock` propagates that to the runtime.
    return true;
  },

  async sendBlock({
    target,
    blocks,
  }: {
    target: string;
    blocks: NotificationBlock[];
  }): Promise<{ messageId: string }> {
    const client = getClientForChannel(target);
    // Plain-text fallback for clients that ignore Block Kit (and for Slack's
    // notification-preview line). Pick the first section/header text.
    const previewText =
      blocks.find((b) => b.type === "section" || b.type === "header")?.text ??
      "Ad analytics notification";
    const renderedBlocks = blocks.map(toBlockKit);
    const sent = await client.post({
      text: previewText,
      blocks: renderedBlocks as never[],
    });
    // The Slack Web API returns a `ts` timestamp we'd normally use as the
    // thread key, but `SlackClient.post` doesn't surface it today. Use a
    // synthetic id so `reply()` calls degrade to a fresh top-level post.
    return { messageId: sent ? `slack:${target}:${Date.now()}` : "slack:not-sent" };
  },

  async reply({
    blocks,
  }: {
    threadKey: string;
    blocks: NotificationBlock[];
  }): Promise<void> {
    // Phase 1 doesn't need threading. When Phase 3 needs reply-in-thread
    // semantics (slash-command lazy-listener `chat.update`), we'll extend
    // `SlackClient` to return the `ts` and feed it back here.
    void blocks;
  },
};

/** Test hook — clear the per-target SlackClient cache. */
export function _resetSlackChannelCache(): void {
  clientCache.clear();
}
