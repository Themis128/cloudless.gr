/**
 * Slack interactions endpoint.
 *
 * Handles interactive components from Block Kit messages:
 *   - button clicks (URL buttons, action buttons)
 *   - overflow menus
 *
 * Slack delivers payloads as application/x-www-form-urlencoded with a
 * JSON-encoded `payload` field.
 *
 * Slack app setup:
 *   Interactivity & Shortcuts → Request URL:
 *   https://cloudless.gr/api/slack/interactions
 */

import { verifySlackRequest, unauthorizedSlack } from "@/lib/slack-verify";
import { checkSlackRateLimit } from "@/lib/slack-rate-limit";
import { listRecentCheckoutSessions, formatPrice } from "@/lib/stripe";
import { getSlackConfigAsync } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Types (subset of Slack interaction payloads)
// ---------------------------------------------------------------------------

interface BlockAction {
  action_id: string;
  block_id?: string;
  value?: string;
  type: string;
}

interface ViewStateValue {
  value?: string | null;
  selected_option?: { value: string } | null;
}

interface SlackInteractionPayload {
  type: "block_actions" | "view_submission" | "shortcut" | string;
  user: { id: string; username: string };
  actions?: BlockAction[];
  response_url?: string;
  trigger_id?: string;
  callback_id?: string;
  view?: {
    callback_id: string;
    private_metadata: string;
    state: {
      values: Record<string, Record<string, ViewStateValue>>;
    };
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const verified = await verifySlackRequest(request);
  if (!verified.ok) return unauthorizedSlack(verified.reason);

  const rateLimitKey = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkSlackRateLimit(rateLimitKey)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  // Slack sends the payload as a form field named "payload"
  const params = new URLSearchParams(verified.body);
  const rawPayload = params.get("payload");
  if (!rawPayload) {
    return Response.json({ error: "Missing payload field" }, { status: 400 });
  }

  let payload: SlackInteractionPayload;
  try {
    payload = JSON.parse(rawPayload) as SlackInteractionPayload;
  } catch {
    return Response.json({ error: "Invalid payload JSON" }, { status: 400 });
  }

  switch (payload.type) {
    case "block_actions":
      return handleBlockActions(payload);

    case "view_submission":
      return handleViewSubmission(payload);

    default:
      console.warn(`[Slack Interactions] Unhandled interaction type: ${payload.type}`);
      return new Response(null, { status: 200 });
  }
}

// ---------------------------------------------------------------------------
// Interaction handlers
// ---------------------------------------------------------------------------

async function handleBlockActions(payload: SlackInteractionPayload): Promise<Response> {
  const actions = payload.actions ?? [];

  for (const action of actions) {
    switch (action.action_id) {
      case "open_stripe_dashboard":
      case "open_store":
        // URL buttons — Slack handles the navigation client-side.
        // Acknowledge the action; no server-side work needed.
        break;

      case "refresh_orders": {
        // Post updated order data to the response_url
        if (payload.response_url) {
          refreshOrdersAsync(payload.response_url).catch((err) =>
            console.error("[Slack Interactions] refresh_orders failed:", err)
          );
        }
        break;
      }

      default:
        console.warn(`[Slack Interactions] Unhandled action_id: ${action.action_id}`);
    }
  }

  // Slack requires a 200 response within 3 seconds.
  return new Response(null, { status: 200 });
}

function handleViewSubmission(payload: SlackInteractionPayload): Response {
  const callbackId = payload.view?.callback_id;

  switch (callbackId) {
    case "create-ticket-modal":
      postTicketAsync(payload).catch((err) =>
        console.error("[Slack Interactions] create-ticket-modal error:", err)
      );
      break;

    case "deploy-confirm-modal":
      postDeployAsync(payload).catch((err) =>
        console.error("[Slack Interactions] deploy-confirm-modal error:", err)
      );
      break;

    default:
      console.warn(`[Slack Interactions] Unknown view callback_id: ${callbackId}`);
  }

  return new Response(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// Async responders (posted to response_url after acknowledging)
// ---------------------------------------------------------------------------

function slackEscape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function priorityEmoji(priority: string): string {
  switch (priority) {
    case "high":
      return ":red_circle:";
    case "medium":
      return ":yellow_circle:";
    default:
      return ":white_circle:";
  }
}

async function postTicketAsync(payload: SlackInteractionPayload): Promise<void> {
  const { SLACK_BOT_TOKEN: token } = await getSlackConfigAsync();
  if (!token) return;

  const values = payload.view?.state.values ?? {};
  const email = slackEscape(values.ticket_email?.ticket_email_input?.value ?? "");
  const issueType =
    values.ticket_issue_type?.ticket_issue_type_select?.selected_option?.value ?? "unknown";
  const priority =
    values.ticket_priority?.ticket_priority_select?.selected_option?.value ?? "medium";
  const description = slackEscape(values.ticket_description?.ticket_description_input?.value ?? "");
  const emoji = priorityEmoji(priority);
  const userId = payload.user.id;

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel: "#contacts",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${emoji} New Support Ticket`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Email*\n${email}` },
            { type: "mrkdwn", text: `*Issue Type*\n${issueType}` },
            { type: "mrkdwn", text: `*Priority*\n${emoji} ${priority}` },
            { type: "mrkdwn", text: `*Submitted by*\n<@${userId}>` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Description*\n${description}` },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Ticket submitted by <@${userId}> via Slack`,
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(5_000),
  });
}

async function postDeployAsync(payload: SlackInteractionPayload): Promise<void> {
  const { SLACK_BOT_TOKEN: token } = await getSlackConfigAsync();
  if (!token) return;

  const values = payload.view?.state.values ?? {};
  const releaseNotes = values.deploy_notes?.deploy_notes_input?.value ?? null;

  let meta: { user_id?: string; user_name?: string } = {};
  try {
    meta = JSON.parse(payload.view?.private_metadata ?? "{}") as {
      user_id?: string;
      user_name?: string;
    };
  } catch {
    // fall back to payload.user
  }
  const userId = meta.user_id ?? payload.user.id;

  // 1. Post "Deploy Started" to #deployments
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel: "#deployments",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: ":rocket: Deploy Started",
            emoji: true,
          },
        },
        ...(releaseNotes
          ? [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Release Notes*\n${slackEscape(releaseNotes)}`,
                },
              },
            ]
          : []),
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Triggered by <@${userId}>`,
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(5_000),
  });

  // 2. Trigger GitHub Actions workflow dispatch
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel: "#deployments",
        text: ":warning: GITHUB_TOKEN is not configured — workflow dispatch skipped.",
      }),
      signal: AbortSignal.timeout(5_000),
    });
    return;
  }

  const dispatchRes = await fetch(
    "https://api.github.com/repos/Themis128/cloudless.gr/actions/workflows/build-pi-image.yml/dispatches",
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!dispatchRes.ok) {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel: "#deployments",
        text: `:x: Deploy workflow dispatch failed (${dispatchRes.status}). Check GitHub Actions.`,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  }
}

async function refreshOrdersAsync(responseUrl: string): Promise<void> {
  // `responseUrl` comes from the (signature-verified) Slack payload, but we
  // still pin it to Slack's response-URL host so a forged-but-signed payload
  // can't turn this into an SSRF primitive against an internal target.
  if (!responseUrl.startsWith("https://hooks.slack.com/")) return;
  try {
    const { orders } = await listRecentCheckoutSessions(5);
    const lines = orders.map((o) => {
      const status = o.paymentStatus === "paid" ? ":white_check_mark:" : ":hourglass:";
      const amount = formatPrice(o.amount, o.currency);
      return `${status} *${amount}* — ${o.email ?? "N/A"}`;
    });

    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replace_original: true,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: ":receipt: Recent Orders (Refreshed)",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: lines.length > 0 ? lines.join("\n") : "No orders found.",
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Updated <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|now>`,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    console.error("[Slack Interactions] refreshOrdersAsync error:", err);
  }
}
