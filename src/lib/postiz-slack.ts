import { getConfig } from "@/lib/ssm-config";
import { SlackClient } from "@/lib/slack-notify";
import type { PostizIntegration, PostizPost } from "@/lib/postiz";

/**
 * Slack notifications for Postiz lifecycle events.
 *
 * Each function is a no-op when Slack isn't configured (SlackClient.post
 * returns false silently) — never blocks a webhook or cron handler. Channel
 * routing: `POSTIZ_SLACK_CHANNEL` (SSM) overrides the default; otherwise
 * SlackClient falls through to `SLACK_DEFAULT_CHANNEL` and finally `#general`.
 */

async function getClient(): Promise<SlackClient> {
  const cfg = await getConfig();
  const channel = cfg.POSTIZ_SLACK_CHANNEL || undefined;
  return new SlackClient(channel ? { channel } : undefined);
}

function shorten(s: string, max = 280): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Successful publish — fires on Postiz `post.published` webhook events. */
export async function notifyPostPublished(post: PostizPost): Promise<void> {
  const client = await getClient();
  const releaseLink = post.releaseURL
    ? ` <${post.releaseURL}|view on ${post.integration.identifier}>`
    : "";
  await client.post({
    text: `Postiz: ${post.integration.name} published`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `:white_check_mark: *Postiz published* on *${post.integration.name}* ` +
            `(${post.integration.identifier})${releaseLink}\n` +
            `> ${shorten(post.content)}`,
        },
      },
    ],
    icon_emoji: ":satellite_antenna:",
    username: "Postiz",
  });
}

/** Errored publish — `post.errored` webhook events or sync-cron detection. */
export async function notifyPostErrored(
  post: Pick<PostizPost, "id" | "content" | "integration" | "state">,
  reason: string | null
): Promise<void> {
  const client = await getClient();
  const detail = reason ? `\n> Reason: \`${shorten(reason, 200)}\`` : "";
  await client.post({
    text: `Postiz: ${post.integration.name} failed to publish`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `:rotating_light: *Postiz publish failed* on *${post.integration.name}* ` +
            `(${post.integration.identifier})\n` +
            `> ${shorten(post.content)}${detail}\n` +
            `Post ID: \`${post.id}\``,
        },
      },
    ],
    icon_emoji: ":rotating_light:",
    username: "Postiz",
  });
}

/** OAuth token expired/revoked on a channel — fired by the oauth-check cron. */
export async function notifyOauthExpiry(integration: PostizIntegration): Promise<void> {
  const client = await getClient();
  await client.post({
    text: `Postiz: ${integration.name} OAuth disconnected`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `:warning: *Postiz channel disconnected* — *${integration.name}* ` +
            `(${integration.identifier}) is disabled. Re-authorize at ` +
            `<https://postiz.cloudless.gr/launches|postiz.cloudless.gr/launches> ` +
            `before the next scheduled post.`,
        },
      },
    ],
    icon_emoji: ":warning:",
    username: "Postiz",
  });
}
