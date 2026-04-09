/**
 * Slack slash commands endpoint.
 *
 * Handles:
 *   /cloudless-status  — app health + version
 *   /cloudless-orders  — recent store activity summary
 *
 * Slack delivers slash command payloads as application/x-www-form-urlencoded.
 * Slack app setup:
 *   Slash Commands → create each command with Request URL:
 *   https://cloudless.gr/api/slack/commands
 */

import { verifySlackRequest, unauthorizedSlack } from "@/lib/slack-verify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlashCommandPayload {
  command: string;
  text: string;
  user_id: string;
  user_name: string;
  channel_id: string;
  response_url: string;
  trigger_id: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const verified = await verifySlackRequest(request);
  if (!verified.ok) return unauthorizedSlack(verified.reason);

  const params = new URLSearchParams(verified.body);
  const payload: SlashCommandPayload = {
    command: params.get("command") ?? "",
    text: params.get("text") ?? "",
    user_id: params.get("user_id") ?? "",
    user_name: params.get("user_name") ?? "",
    channel_id: params.get("channel_id") ?? "",
    response_url: params.get("response_url") ?? "",
    trigger_id: params.get("trigger_id") ?? "",
  };

  switch (payload.command) {
    case "/cloudless-status":
      return handleStatus(payload);

    case "/cloudless-orders":
      return handleOrders(payload);

    default:
      return slackResponse({
        response_type: "ephemeral",
        text: `Unknown command: \`${payload.command}\``,
      });
  }
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

function handleStatus(_payload: SlashCommandPayload): Response {
  const version = process.env.APP_VERSION ?? "dev";
  const uptime = Math.floor(process.uptime());
  const uptimeLabel =
    uptime < 60
      ? `${uptime}s`
      : uptime < 3600
        ? `${Math.floor(uptime / 60)}m`
        : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  return slackResponse({
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":white_check_mark: cloudless.gr Status", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Version*\n\`${version}\`` },
          { type: "mrkdwn", text: `*Uptime*\n${uptimeLabel}` },
          { type: "mrkdwn", text: "*API*\n:large_green_circle: Online" },
          { type: "mrkdwn", text: "*Store*\n:large_green_circle: Online" },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<!date^${Math.floor(Date.now() / 1000)}^Checked {date_short_pretty} at {time}|${new Date().toISOString()}>`,
          },
        ],
      },
    ],
  });
}

function handleOrders(payload: SlashCommandPayload): Response {
  // In a production implementation, query Stripe or your order database here.
  // This returns a placeholder Block Kit message with an action button.
  return slackResponse({
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":receipt: Recent Orders", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "Live order data requires connecting to Stripe. " +
            "Click the button below to open the Stripe Dashboard.",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open Stripe Dashboard", emoji: true },
            url: "https://dashboard.stripe.com/payments",
            action_id: "open_stripe_dashboard",
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "View Store", emoji: true },
            url: "https://cloudless.gr/store",
            action_id: "open_store",
          },
        ],
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `Requested by <@${payload.user_id}>` },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SlackCommandResponse {
  response_type: "ephemeral" | "in_channel";
  text?: string;
  blocks?: unknown[];
}

function slackResponse(body: SlackCommandResponse): Response {
  return Response.json(body, {
    headers: { "Content-Type": "application/json" },
  });
}
