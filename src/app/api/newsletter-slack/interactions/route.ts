/**
 * Interactions endpoint for the DEDICATED Newsletter Slack app.
 *
 * Handles Block Kit button payloads posted in App Home and in pings
 * the bot publishes elsewhere. The action_ids correspond to buttons
 * the events route renders into the App Home view.
 *
 *   home_send             — confirm modal already accepted → flip status + dispatch publisher
 *   home_unpublish        — confirm modal already accepted → flip status to Archived
 *   home_rerun_draft      — re-trigger weekly-article-draft.yml
 *   home_open_*           — link-only buttons, no server side effect (Slack opens URL)
 *
 * All destructive actions check SLACK_OPS_USERS like the slash commands do.
 */

import {
  verifyNewsletterSlackRequest,
  unauthorizedNewsletterSlack,
} from "@/lib/newsletter-slack-verify";
import { checkSlackRateLimit } from "@/lib/slack-rate-limit";
import { findEditorialPost, setEditorialStatus } from "@/lib/notion-blog-admin";
import { dispatchWorkflow } from "@/lib/github-dispatch";

interface ButtonAction {
  action_id: string;
  value?: string;
  type?: string;
}

interface BlockActionsPayload {
  type: "block_actions";
  user: { id: string; username?: string };
  actions: ButtonAction[];
  response_url?: string;
}

const SLACK_OPS_USERS = (process.env.SLACK_OPS_USERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function POST(request: Request): Promise<Response> {
  const verified = await verifyNewsletterSlackRequest(request);
  if (!verified.ok) return unauthorizedNewsletterSlack(verified.reason);

  const rateLimitKey = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkSlackRateLimit(rateLimitKey)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const params = new URLSearchParams(verified.body);
  const raw = params.get("payload");
  if (!raw) return Response.json({ error: "Missing payload" }, { status: 400 });

  let payload: BlockActionsPayload;
  try {
    payload = JSON.parse(raw) as BlockActionsPayload;
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (payload.type !== "block_actions") {
    return Response.json({ ok: true });
  }

  const action = payload.actions?.[0];
  if (!action) return Response.json({ ok: true });

  const userId = payload.user?.id ?? "";
  const responseUrl = payload.response_url ?? "";

  // Link-only buttons — Slack already opens the URL client-side.
  if (action.action_id.startsWith("home_open_")) {
    return Response.json({ ok: true });
  }

  // Destructive actions defer to background; respond 200 immediately so
  // Slack does not retry. The response_url posts the result asynchronously.
  switch (action.action_id) {
    case "home_send":
      handleSend(userId, action.value ?? "", responseUrl).catch((err) =>
        console.error("[NewsletterSlack interactions] home_send error:", err)
      );
      return Response.json({ ok: true });
    case "home_unpublish":
      handleUnpublish(userId, action.value ?? "", responseUrl).catch((err) =>
        console.error("[NewsletterSlack interactions] home_unpublish error:", err)
      );
      return Response.json({ ok: true });
    case "home_rerun_draft":
      handleRerunDraft(userId, responseUrl).catch((err) =>
        console.error("[NewsletterSlack interactions] home_rerun_draft error:", err)
      );
      return Response.json({ ok: true });
    default:
      console.warn(`[NewsletterSlack interactions] Unknown action: ${action.action_id}`);
      return Response.json({ ok: true });
  }
}

// ---------------------------------------------------------------------------
// Handlers (run in background; reply via response_url)
// ---------------------------------------------------------------------------

function isAllowed(userId: string): boolean {
  return SLACK_OPS_USERS.length === 0 || SLACK_OPS_USERS.includes(userId);
}

async function replyEphemeral(responseUrl: string, text: string): Promise<void> {
  if (!responseUrl) return;
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", text }),
  }).catch((err) => console.warn("[NewsletterSlack] response_url POST failed:", err));
}

async function handleSend(userId: string, target: string, responseUrl: string): Promise<void> {
  if (!isAllowed(userId)) {
    await replyEphemeral(responseUrl, ":no_entry: You are not on the ops allowlist.");
    return;
  }
  if (!target) {
    await replyEphemeral(responseUrl, ":warning: No target slug.");
    return;
  }

  const post = await findEditorialPost(target);
  if (!post) {
    await replyEphemeral(responseUrl, `:warning: No Notion draft matching \`${target}\`.`);
    return;
  }
  if (post.status === "Published") {
    await replyEphemeral(responseUrl, `:information_source: *${post.title}* is already Published.`);
    return;
  }
  const flipped = await setEditorialStatus(post.id, "In Review");
  if (!flipped) {
    await replyEphemeral(responseUrl, ":warning: Failed to update Notion status.");
    return;
  }
  const result = await dispatchWorkflow("weekly-newsletter.yml", "main");
  if (!result.ok) {
    await replyEphemeral(
      responseUrl,
      `:warning: Notion updated but workflow dispatch failed (HTTP ${result.status}).`
    );
    return;
  }
  await replyEphemeral(
    responseUrl,
    `:rocket: <@${userId}> queued *${post.title}* for send. Publisher will render + email subscribers.`
  );
}

async function handleUnpublish(userId: string, target: string, responseUrl: string): Promise<void> {
  if (!isAllowed(userId)) {
    await replyEphemeral(responseUrl, ":no_entry: You are not on the ops allowlist.");
    return;
  }
  if (!target) {
    await replyEphemeral(responseUrl, ":warning: No target slug.");
    return;
  }
  const post = await findEditorialPost(target);
  if (!post) {
    await replyEphemeral(responseUrl, `:warning: No Notion post matching \`${target}\`.`);
    return;
  }
  const flipped = await setEditorialStatus(post.id, "Archived");
  if (!flipped) {
    await replyEphemeral(responseUrl, ":warning: Failed to update Notion status.");
    return;
  }
  await replyEphemeral(
    responseUrl,
    `:wastebasket: <@${userId}> archived *${post.title}*. /blog/${post.slug} will 404 within the next ISR cycle.`
  );
}

async function handleRerunDraft(userId: string, responseUrl: string): Promise<void> {
  if (!isAllowed(userId)) {
    await replyEphemeral(responseUrl, ":no_entry: You are not on the ops allowlist.");
    return;
  }
  const result = await dispatchWorkflow("weekly-article-draft.yml", "main");
  if (!result.ok) {
    await replyEphemeral(
      responseUrl,
      `:warning: Re-run failed (HTTP ${result.status}): \`${result.error.slice(0, 200)}\``
    );
    return;
  }
  await replyEphemeral(
    responseUrl,
    ":arrows_counterclockwise: Re-triggered `weekly-article-draft.yml`. New draft in Notion within ~2 minutes."
  );
}
