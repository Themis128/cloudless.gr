/**
 * Slack interactions endpoint.
 *
 * Handles interactive components from Block Kit messages:
 *   - button clicks
 *   - overflow menus
 *   - modal submissions (view_submission)
 *
 * Slack delivers payloads as application/x-www-form-urlencoded with a
 * JSON-encoded `payload` field.
 *
 * Slack app setup:
 *   Interactivity & Shortcuts → Request URL:
 *   https://cloudless.gr/api/slack/interactions
 */

import { verifySlackRequest, unauthorizedSlack } from "@/lib/slack-verify";

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
  type: "block_actions" | "view_submission" | "view_closed" | "shortcut" | string;
  user: { id: string; username: string };
  actions?: BlockAction[];
  view?: {
    id: string;
    callback_id: string;
    state?: { values: Record<string, Record<string, { value?: string; selected_option?: { value: string } }>> };
  };
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
        console.warn(`[Slack] Button clicked: ${action.action_id} by ${payload.user.username}`);
        break;

      default:
        console.warn(`[Slack Interactions] Unhandled action_id: ${action.action_id}`);
    }
  }

  // Slack requires a 200 response within 3 seconds.
  // For more complex actions, respond here and post to response_url asynchronously.
  return new Response(null, { status: 200 });
}

function handleViewSubmission(payload: SlackInteractionPayload): Response {
  const callbackId = payload.view?.callback_id ?? "";

  switch (callbackId) {
    // Add modal submission handlers here as you create modals.
    // Example:
    // case "contact_form_modal":
    //   await processContactFormModal(payload);
    //   return Response.json({ response_action: "clear" });

    default:
      console.warn(`[Slack Interactions] Unhandled view callback_id: ${callbackId}`);
      return new Response(null, { status: 200 });
  }
}
