/**
 * Slack channel administration via Web API.
 *
 * Wraps the conversations.* methods so channels can be provisioned
 * programmatically. Requires a bot token with:
 *   channels:manage  channels:read  channels:write.invites
 *   groups:write     groups:read    groups:write.invites
 *
 * Docs: https://docs.slack.dev/reference/methods/conversations.create
 *       https://docs.slack.dev/reference/methods/conversations.list
 *       https://docs.slack.dev/reference/methods/conversations.invite
 *       https://docs.slack.dev/reference/methods/conversations.setTopic
 */

import { getSlackConfigAsync } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Channel registry — single source of truth for all cloudless.gr channels
// ---------------------------------------------------------------------------

export const SLACK_CHANNELS = {
  bookings: {
    name: "bookings",
    topic: "New consultation bookings from cloudless.gr",
  },
  orders: {
    name: "orders",
    topic: "Stripe orders and payments from cloudless.gr",
  },
  errors: {
    name: "errors",
    topic: "Application errors and exceptions from cloudless.gr",
  },
  deployments: {
    name: "deployments",
    topic: "Deploy events from the cloudless.gr CI pipeline",
  },
  contacts: {
    name: "contacts",
    topic: "Contact form submissions and leads from cloudless.gr",
  },
  campaigns: {
    name: "campaigns",
    topic: "Campaign conversions and ad performance from LinkedIn, Meta, Google, TikTok",
  },
  subscribers: {
    name: "subscribers",
    topic: "Newsletter subscriber sign-ups from cloudless.gr",
  },
} as const satisfies Record<string, { name: string; topic: string }>;

export type SlackChannelKey = keyof typeof SLACK_CHANNELS;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  is_archived: boolean;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  channel?: SlackChannel;
  channels?: SlackChannel[];
  response_metadata?: { next_cursor?: string };
}

export interface ChannelResult {
  id: string;
  name: string;
  created: boolean;
  joined: boolean;
}

// ---------------------------------------------------------------------------
// Low-level API wrapper
// ---------------------------------------------------------------------------

const BASE = "https://slack.com/api";

async function slackPost(
  method: string,
  body: Record<string, unknown>,
  token: string
): Promise<SlackApiResponse> {
  const res = await fetch(`${BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`[SlackAdmin] HTTP ${res.status} on ${method}`);
  return res.json() as Promise<SlackApiResponse>;
}

async function slackGet(
  method: string,
  params: Record<string, string>,
  token: string
): Promise<SlackApiResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/${method}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`[SlackAdmin] HTTP ${res.status} on ${method}`);
  return res.json() as Promise<SlackApiResponse>;
}

// ---------------------------------------------------------------------------
// Public channel management functions
// ---------------------------------------------------------------------------

/**
 * List all (non-archived) public and private channels the token can see.
 * Handles cursor pagination automatically.
 */
export async function listChannels(token: string): Promise<SlackChannel[]> {
  const all: SlackChannel[] = [];
  let cursor = "";

  do {
    const res = await slackGet(
      "conversations.list",
      {
        types: "public_channel,private_channel",
        limit: "200",
        exclude_archived: "true",
        ...(cursor ? { cursor } : {}),
      },
      token
    );
    if (!res.ok) throw new Error(`[SlackAdmin] conversations.list: ${res.error}`);
    all.push(...(res.channels ?? []));
    cursor = res.response_metadata?.next_cursor ?? "";
  } while (cursor);

  return all;
}

/**
 * Create a new public channel. The bot token is automatically added as a
 * member when it creates the channel.
 * Docs: https://docs.slack.dev/reference/methods/conversations.create
 */
export async function createChannel(name: string, token: string): Promise<SlackChannel> {
  const res = await slackPost("conversations.create", { name }, token);
  if (!res.ok) throw new Error(`[SlackAdmin] conversations.create "${name}": ${res.error}`);
  return res.channel!;
}

/**
 * Set the topic of a channel.
 * Docs: https://docs.slack.dev/reference/methods/conversations.setTopic
 */
export async function setChannelTopic(
  channelId: string,
  topic: string,
  token: string
): Promise<void> {
  const res = await slackPost("conversations.setTopic", { channel: channelId, topic }, token);
  if (!res.ok) throw new Error(`[SlackAdmin] conversations.setTopic: ${res.error}`);
}

/**
 * Join a public channel (used when the channel already exists but the bot
 * isn't a member yet).
 * Docs: https://docs.slack.dev/reference/methods/conversations.join
 */
export async function joinChannel(channelId: string, token: string): Promise<void> {
  const res = await slackPost("conversations.join", { channel: channelId }, token);
  if (!res.ok && res.error !== "already_in_channel") {
    throw new Error(`[SlackAdmin] conversations.join: ${res.error}`);
  }
}

/**
 * Fetch metadata for a single channel by ID.
 * Docs: https://api.slack.com/methods/conversations.info
 */
export async function getChannelInfo(channelId: string, token: string): Promise<SlackChannel> {
  const res = await slackGet("conversations.info", { channel: channelId }, token);
  if (!res.ok || !res.channel) throw new Error(`[SlackAdmin] conversations.info: ${res.error}`);
  return res.channel;
}

/**
 * Set the purpose (description) of a channel.
 * Docs: https://api.slack.com/methods/conversations.setPurpose
 */
export async function setChannelPurpose(
  channelId: string,
  purpose: string,
  token: string
): Promise<void> {
  const res = await slackPost("conversations.setPurpose", { channel: channelId, purpose }, token);
  if (!res.ok) throw new Error(`[SlackAdmin] conversations.setPurpose: ${res.error}`);
}

/**
 * Rename a channel.
 * Docs: https://api.slack.com/methods/conversations.rename
 */
export async function renameChannel(
  channelId: string,
  name: string,
  token: string
): Promise<SlackChannel> {
  const res = await slackPost("conversations.rename", { channel: channelId, name }, token);
  if (!res.ok || !res.channel) throw new Error(`[SlackAdmin] conversations.rename: ${res.error}`);
  return res.channel;
}

/**
 * Archive a channel (bot must be a member or have channels:manage scope).
 * Docs: https://api.slack.com/methods/conversations.archive
 */
export async function archiveChannel(channelId: string, token: string): Promise<void> {
  const res = await slackPost("conversations.archive", { channel: channelId }, token);
  if (!res.ok && res.error !== "already_archived")
    throw new Error(`[SlackAdmin] conversations.archive: ${res.error}`);
}

/**
 * Invite one or more users (by Slack user ID) to a channel.
 * Docs: https://docs.slack.dev/reference/methods/conversations.invite
 */
export async function inviteToChannel(
  channelId: string,
  userIds: string[],
  token: string
): Promise<void> {
  const res = await slackPost(
    "conversations.invite",
    {
      channel: channelId,
      users: userIds.join(","),
    },
    token
  );
  if (!res.ok) throw new Error(`[SlackAdmin] conversations.invite: ${res.error}`);
}

/**
 * Ensure a single channel exists: creates it if missing, joins it if the bot
 * isn't a member, and sets the topic on creation.
 */
export async function ensureChannel(
  name: string,
  topic: string,
  token: string,
  existing: SlackChannel[]
): Promise<ChannelResult> {
  const found = existing.find((c) => c.name === name);

  if (found) {
    let joined = false;
    if (!found.is_member) {
      await joinChannel(found.id, token);
      joined = true;
    }
    return { id: found.id, name: found.name, created: false, joined };
  }

  const channel = await createChannel(name, token);
  await setChannelTopic(channel.id, topic, token);
  return { id: channel.id, name: channel.name, created: true, joined: true };
}

/**
 * Ensure all channels in SLACK_CHANNELS exist and the bot is a member.
 * Safe to call repeatedly — idempotent.
 */
export async function ensureAllChannels(): Promise<Record<SlackChannelKey, ChannelResult>> {
  const cfg = await getSlackConfigAsync();
  const token = cfg.SLACK_BOT_TOKEN;
  if (!token) throw new Error("[SlackAdmin] SLACK_BOT_TOKEN is not configured");

  const existing = await listChannels(token);
  const results = {} as Record<SlackChannelKey, ChannelResult>;

  for (const [key, { name, topic }] of Object.entries(SLACK_CHANNELS) as [
    SlackChannelKey,
    { name: string; topic: string },
  ][]) {
    results[key] = await ensureChannel(name, topic, token, existing);
  }

  return results;
}
