/**
 * NotificationChannel — the per-channel contract for outbound notifications.
 *
 * Adding a new channel (Discord, Teams, email, etc.) = implementing this
 * interface and registering it in `runtime.ts`. The orchestrator never
 * imports a concrete channel directly.
 *
 * The first concrete implementation is `./slack.ts` which wraps the
 * existing `src/lib/slack-notify.ts` `SlackClient`.
 */

import type { NotificationChannelId } from "../types";

/** Subset of Slack Block Kit / generic block descriptor used by the digest
 *  + event renderers. Channels translate this into their wire format. The
 *  shape mirrors Slack's Block Kit because that's the richest target — the
 *  email channel will fall back to a markdown rendering, Discord to embeds. */
export interface NotificationBlock {
  type: "section" | "context" | "header" | "divider" | "actions";
  text?: string;
  fields?: Array<{ title: string; value: string }>;
  /** Slack Block Kit raw JSON, when a section requires capabilities the
   *  abstraction doesn't cover yet. Channels that can't render this fall
   *  back to `text`. */
  slackRaw?: unknown;
}

export interface NotificationChannel {
  readonly id: NotificationChannelId;

  /** Returns true when the channel is configured (SLACK_BOT_TOKEN present,
   *  for instance). */
  isConfigured(): Promise<boolean>;

  /**
   * Post a top-level notification. `target` is channel-specific (Slack
   * channel name / DM user id / email address / Discord webhook URL).
   * Returns a stable handle that can be used by `reply()` to thread.
   */
  sendBlock(opts: { target: string; blocks: NotificationBlock[] }): Promise<{ messageId: string }>;

  /** Reply in-thread to a previously sent message. No-op for channels
   *  (email, basic webhooks) that have no concept of threads. */
  reply(opts: { threadKey: string; blocks: NotificationBlock[] }): Promise<void>;
}
