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
import { dispatchWorkflow } from "@/lib/github-dispatch";

/**
 * Comma-separated list of Slack user IDs allowed to trigger workflow
 * dispatch from interaction buttons. Empty/unset = anyone in the workspace
 * who can see the button. Set to a single user ID (e.g. "U01ABCDEF") to
 * lock workflow re-runs down to one operator.
 */
const SLACK_OPS_USERS: string[] = (process.env.SLACK_OPS_USERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Action IDs registered in this route that map to a workflow_dispatch
 * filename. Keep this object tight — every entry here is one click away
 * from running a real GitHub Actions job.
 */
const RERUN_ACTIONS: Record<string, string> = {
  rerun_weekly_draft: "weekly-article-draft.yml",
};

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
  if (!verified.ok) return unauthorizedSlack(verified.reason, request);

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
        if (action.action_id in RERUN_ACTIONS) {
          const workflowFile = RERUN_ACTIONS[action.action_id];
          if (payload.response_url) {
            rerunWorkflowAsync(
              workflowFile,
              payload.response_url,
              payload.user.id,
              action.action_id
            ).catch((err) =>
              console.error(`[Slack Interactions] ${action.action_id} failed:`, err)
            );
          }
        } else {
          console.warn(`[Slack Interactions] Unhandled action_id: ${action.action_id}`);
        }
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

// ---------------------------------------------------------------------------
// Workflow re-run responder
//
// Triggered by buttons whose action_id is registered in RERUN_ACTIONS above
// (currently just "rerun_weekly_draft"). Posts a follow-up to the original
// channel via response_url; never edits the original failure card so the
// audit trail stays intact.
// ---------------------------------------------------------------------------

async function rerunWorkflowAsync(
  workflowFile: string,
  responseUrl: string,
  userId: string,
  actionId: string
): Promise<void> {
  // Optional allowlist — when set, only listed Slack user IDs can dispatch.
  if (SLACK_OPS_USERS.length > 0 && !SLACK_OPS_USERS.includes(userId)) {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "ephemeral",
        replace_original: false,
        text:
          ":no_entry: You're not on the ops allowlist for workflow dispatch. " +
          "Ask <@" +
          (SLACK_OPS_USERS[0] ?? "the admin") +
          "> to add your Slack user ID to `SLACK_OPS_USERS`.",
      }),
      signal: AbortSignal.timeout(5_000),
    }).catch((err) => console.error("[Slack Interactions] denial post failed:", err));
    return;
  }

  const result = await dispatchWorkflow(workflowFile, "main");

  const message = result.ok
    ? `:rocket: <@${userId}> re-triggered *${workflowFile}*. Check the Actions tab in ~5 seconds — it'll show up under "Weekly Article Draft".`
    : `:warning: Re-run of *${workflowFile}* failed (HTTP ${result.status}): \`${result.error}\``;

  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      response_type: "in_channel",
      replace_original: false,
      text: message,
    }),
    signal: AbortSignal.timeout(5_000),
  }).catch((err) =>
    console.error(`[Slack Interactions] follow-up post failed for ${actionId}:`, err)
  );
}
