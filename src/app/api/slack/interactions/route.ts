/**
 * Slack interactions endpoint.
 *
 * Handles interactive components from Block Kit messages:
 *   - block_actions — button clicks, overflow menus
 *   - view_submission — modal form submissions
 *     • create-ticket-modal  → posts ticket to #contacts
 *     • deploy-confirm-modal → triggers GitHub Actions workflow, notifies #deployments
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
import { SlackClient } from "@/lib/slack-notify";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_OWNER = "baltzakis-themis"; // update to your GitHub org/username
const GITHUB_REPO = "cloudless.gr";
const GITHUB_WORKFLOW = "deploy.yml";
const GITHUB_REF = "main";

const BOT_USERNAME = "Cloudless";
const BOT_ICON_URL = "https://cloudless.gr/icons/icon-512.png";

// ---------------------------------------------------------------------------
// Types (subset of Slack interaction payloads)
// ---------------------------------------------------------------------------

interface BlockAction {
  action_id: string;
  block_id?: string;
  value?: string;
  type: string;
}

interface ViewState {
  values: Record<
    string,
    Record<string, { value?: string; selected_option?: { value: string } }>
  >;
}

interface SlackView {
  callback_id: string;
  state: ViewState;
  private_metadata?: string;
}

interface SlackInteractionPayload {
  type: "block_actions" | "view_submission" | string;
  user: { id: string; username: string };
  actions?: BlockAction[];
  response_url?: string;
  trigger_id?: string;
  callback_id?: string;
  view?: SlackView;
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
      console.warn(
        `[Slack Interactions] Unhandled interaction type: ${payload.type}`,
      );
      return new Response(null, { status: 200 });
  }
}

// ---------------------------------------------------------------------------
// block_actions handler
// ---------------------------------------------------------------------------

async function handleBlockActions(
  payload: SlackInteractionPayload,
): Promise<Response> {
  const actions = payload.actions ?? [];

  for (const action of actions) {
    switch (action.action_id) {
      case "open_stripe_dashboard":
      case "open_store":
      case "home_open_stripe":
      case "home_open_site":
      case "home_open_admin":
        // URL buttons — Slack handles the navigation client-side.
        // Acknowledge the action; no server-side work needed.
        break;

      case "refresh_orders": {
        // Post updated order data to the response_url
        if (payload.response_url) {
          refreshOrdersAsync(payload.response_url).catch((err) =>
            console.error("[Slack Interactions] refresh_orders failed:", err),
          );
        }
        break;
      }

      default:
        console.warn(
          `[Slack Interactions] Unhandled action_id: ${action.action_id}`,
        );
    }
  }

  // Slack requires a 200 response within 3 seconds.
  return new Response(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// view_submission handler — modal forms
// ---------------------------------------------------------------------------

async function handleViewSubmission(
  payload: SlackInteractionPayload,
): Promise<Response> {
  const view = payload.view;
  if (!view) {
    console.warn("[Slack Interactions] view_submission without view object");
    return new Response(null, { status: 200 });
  }

  switch (view.callback_id) {
    case "create-ticket-modal":
      // Run async; return 200 immediately so Slack closes the modal
      handleTicketSubmission(payload).catch((err) =>
        console.error("[Slack Interactions] ticket submission failed:", err),
      );
      return new Response(null, { status: 200 });

    case "deploy-confirm-modal":
      // Run async; return 200 immediately so Slack closes the modal
      handleDeploySubmission(payload).catch((err) =>
        console.error("[Slack Interactions] deploy submission failed:", err),
      );
      return new Response(null, { status: 200 });

    default:
      console.warn(
        `[Slack Interactions] Unhandled view callback_id: ${view.callback_id}`,
      );
      return new Response(null, { status: 200 });
  }
}

// ---------------------------------------------------------------------------
// Ticket modal submission
// ---------------------------------------------------------------------------

async function handleTicketSubmission(
  payload: SlackInteractionPayload,
): Promise<void> {
  const view = payload.view!;
  const state = view.state.values;

  // Extract field values — block_ids match those set in commands/route.ts
  const email =
    state["ticket_email"]?.["ticket_email_input"]?.value?.trim() ?? "";
  const issueType =
    state["ticket_issue_type"]?.["ticket_issue_type_select"]?.selected_option
      ?.value ?? "question";
  const priority =
    state["ticket_priority"]?.["ticket_priority_select"]?.selected_option
      ?.value ?? "medium";
  const description =
    state["ticket_description"]?.["ticket_description_input"]?.value?.trim() ??
    "";

  const submitter = payload.user.username;
  const ts = Math.floor(Date.now() / 1_000);
  const dateLabel = `<!date^${ts}^{date_short_pretty} at {time}|${new Date().toISOString()}>`;

  const priorityEmoji =
    priority === "high"
      ? ":red_circle:"
      : priority === "medium"
        ? ":yellow_circle:"
        : ":white_circle:";

  const issueLabel: Record<string, string> = {
    bug: "Bug Report",
    question: "Question",
    billing: "Billing",
    booking: "Booking Issue",
    feature: "Feature Request",
  };

  const contactsClient = new SlackClient({ channel: "#contacts" });
  await contactsClient.post({
    text: `New support ticket: ${issueLabel[issueType] ?? issueType} from ${email}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: ":ticket: New Support Ticket",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Customer Email:*\n${slackEscape(email)}` },
          {
            type: "mrkdwn",
            text: `*Issue Type:*\n${issueLabel[issueType] ?? issueType}`,
          },
          {
            type: "mrkdwn",
            text: `*Priority:*\n${priorityEmoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
          },
          {
            type: "mrkdwn",
            text: `*Submitted by:*\n<@${payload.user.id}>`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Description:*\n${slackEscape(description)}`,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: dateLabel },
          { type: "mrkdwn", text: `Submitted by @${submitter}` },
        ],
      },
      { type: "divider" },
    ],
    username: BOT_USERNAME,
    icon_url: BOT_ICON_URL,
  });

  console.warn(
    `[Slack Interactions] Ticket created: ${issueType} / ${priority} from ${email}`,
  );
}

// ---------------------------------------------------------------------------
// Deploy confirmation modal submission
// ---------------------------------------------------------------------------

async function handleDeploySubmission(
  payload: SlackInteractionPayload,
): Promise<void> {
  const view = payload.view!;
  const state = view.state.values;

  // Release notes are optional
  const releaseNotes =
    state["deploy_notes"]?.["deploy_notes_input"]?.value?.trim() ?? "";

  // Recover who triggered the deploy from private_metadata
  let triggerUserId = payload.user.id;
  let triggerUsername = payload.user.username;
  try {
    if (view.private_metadata) {
      const meta = JSON.parse(view.private_metadata) as {
        user_id?: string;
        user_name?: string;
      };
      triggerUserId = meta.user_id ?? triggerUserId;
      triggerUsername = meta.user_name ?? triggerUsername;
    }
  } catch {
    // Ignore parse errors — fall back to payload user
  }

  const deploymentsClient = new SlackClient({ channel: "#deployments" });

  // Notify that deploy is starting
  const ts = Math.floor(Date.now() / 1_000);
  const dateLabel = `<!date^${ts}^{date_short_pretty} at {time}|${new Date().toISOString()}>`;

  await deploymentsClient.post({
    text: `:rocket: Deploy triggered by <@${triggerUserId}>`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: ":rocket: Deploy Started",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Triggered by:*\n<@${triggerUserId}>` },
          { type: "mrkdwn", text: `*Branch:*\n\`${GITHUB_REF}\`` },
          { type: "mrkdwn", text: `*Target:*\`production\`` },
          { type: "mrkdwn", text: `*Time:*\n${dateLabel}` },
        ],
      },
      ...(releaseNotes
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Release Notes:*\n${slackEscape(releaseNotes)}`,
              },
            } as const,
          ]
        : []),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Dispatching \`${GITHUB_WORKFLOW}\` on \`${GITHUB_REPO}\``,
          },
        ],
      },
      { type: "divider" },
    ],
    username: BOT_USERNAME,
    icon_url: BOT_ICON_URL,
  });

  // Trigger the GitHub Actions workflow
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error(
      "[Slack Interactions] GITHUB_TOKEN not set — skipping workflow dispatch",
    );
    await deploymentsClient.post({
      text: ":x: Deploy failed — GITHUB_TOKEN not configured",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: ":x: *Deploy failed* — `GITHUB_TOKEN` is not configured on the server. Add it to SSM at `/cloudless/prod/GITHUB_TOKEN`.",
          },
        },
      ],
      username: BOT_USERNAME,
      icon_url: BOT_ICON_URL,
    });
    return;
  }

  try {
    const dispatchRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${githubToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: GITHUB_REF,
          inputs: {
            triggered_by: triggerUsername,
            release_notes: releaseNotes || "No release notes provided",
          },
        }),
      },
    );

    if (!dispatchRes.ok) {
      const errorText = await dispatchRes.text();
      console.error(
        `[Slack Interactions] GitHub dispatch failed: ${dispatchRes.status} ${errorText}`,
      );
      await deploymentsClient.post({
        text: ":x: GitHub workflow dispatch failed",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:x: *Deploy dispatch failed* — GitHub returned HTTP ${dispatchRes.status}. Check server logs.`,
            },
          },
        ],
        username: BOT_USERNAME,
        icon_url: BOT_ICON_URL,
      });
    } else {
      console.warn(
        `[Slack Interactions] Workflow dispatched by ${triggerUsername}`,
      );
    }
  } catch (err) {
    console.error("[Slack Interactions] GitHub dispatch error:", err);
  }
}

// ---------------------------------------------------------------------------
// Async responders (posted to response_url after acknowledging)
// ---------------------------------------------------------------------------

async function refreshOrdersAsync(responseUrl: string): Promise<void> {
  try {
    const { orders } = await listRecentCheckoutSessions(5);
    const lines = orders.map((o) => {
      const status =
        o.paymentStatus === "paid" ? ":white_check_mark:" : ":hourglass:";
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
// Utility
// ---------------------------------------------------------------------------

function slackEscape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
