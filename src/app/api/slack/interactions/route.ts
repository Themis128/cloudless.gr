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

// ---------------------------------------------------------------------------
// Types (subset of Slack interaction payloads)
// ---------------------------------------------------------------------------

interface BlockAction {
  action_id: string;
  block_id?: string;
  value?: string;
  type: string;
}

interface SlackInteractionPayload {
  type: "block_actions" | "shortcut" | string;
  user: { id: string; username: string };
  actions?: BlockAction[];
  response_url?: string;
  trigger_id?: string;
  callback_id?: string;
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

    default:
      console.warn(
        `[Slack Interactions] Unhandled interaction type: ${payload.type}`,
      );
      return new Response(null, { status: 200 });
  }
}

// ---------------------------------------------------------------------------
// Interaction handlers
// ---------------------------------------------------------------------------

async function handleBlockActions(
  payload: SlackInteractionPayload,
): Promise<Response> {
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
