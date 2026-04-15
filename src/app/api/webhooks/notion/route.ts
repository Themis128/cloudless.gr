import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getIntegrations } from "@/lib/integrations";
import { slackContactNotify } from "@/lib/slack-notify";
import { sendEmail } from "@/lib/email";
import { getConfig } from "@/lib/ssm-config";
import { invalidateCache } from "@/lib/notion-cache";
import { escapeHtml } from "@/lib/escape-html";

/**
 * POST /api/webhooks/notion
 *
 * Receives webhook events from Notion (via Make/Zapier/n8n or a Notion
 * automation) and performs the appropriate in-app action.
 *
 * Supported event types:
 *   - page.updated     → Revalidate cached pages (blog, docs)
 *   - page.created      → Revalidate index pages + optional Slack notify
 *   - submission.status  → Email the submitter on status change
 *
 * Security: Requires a shared secret in the `x-webhook-secret` header.
 *
 * Body shape:
 * {
 *   "type": "page.updated" | "page.created" | "submission.status",
 *   "database": "blog" | "docs" | "submissions",
 *   "page_id": "<notion page id>",
 *   "slug"?: "<page slug>",
 *   "data"?: { ...extra payload depending on event type }
 * }
 */

interface WebhookPayload {
  type: "page.updated" | "page.created" | "submission.status" | "project.updated" | "task.updated" | "analytics.event";
  database: "blog" | "docs" | "submissions" | "projects" | "tasks" | "analytics";
  page_id: string;
  slug?: string;
  data?: Record<string, unknown>;
}

function verifySecret(request: NextRequest): boolean {
  const { NOTION_WEBHOOK_SECRET } = getIntegrations();
  if (!NOTION_WEBHOOK_SECRET) return false;
  const provided = request.headers.get("x-webhook-secret");
  return provided === NOTION_WEBHOOK_SECRET;
}

// ───────────────────────────── Handlers ──────────────────────────────

async function handlePageUpdated(payload: WebhookPayload) {
  const { database, slug } = payload;

  invalidateCache(database === "blog" ? "blog" : database === "docs" ? "docs" : undefined);

  if (database === "blog") {
    revalidatePath("/blog");
    if (slug) revalidatePath(`/blog/${slug}`);
    revalidatePath("/api/blog/posts");
    if (slug) revalidatePath(`/api/blog/${slug}`);
  } else if (database === "docs") {
    revalidatePath("/docs");
    if (slug) revalidatePath(`/docs/${slug}`);
    revalidatePath("/api/docs");
    if (slug) revalidatePath(`/api/docs/${slug}`);
  }

  revalidatePath("/sitemap.xml");

  return { revalidated: true, database, slug: slug ?? null };
}

async function handlePageCreated(payload: WebhookPayload) {
  const { database, slug, data } = payload;

  invalidateCache(database === "blog" ? "blog" : database === "docs" ? "docs" : undefined);

  if (database === "blog") {
    revalidatePath("/blog");
    revalidatePath("/api/blog/posts");
    revalidatePath("/sitemap.xml");
  } else if (database === "docs") {
    revalidatePath("/docs");
    revalidatePath("/api/docs");
    revalidatePath("/sitemap.xml");
  }

  if (database === "docs" && data?.title) {
    await slackContactNotify({
      name: "Notion Docs",
      email: "",
      company: "",
      service: "New doc published",
      message: `📄 "${data.title}" is now live at /docs/${slug ?? payload.page_id}`,
    }).catch(() => {});
  }

  return { created: true, database, slug: slug ?? null };
}

async function handleProjectUpdated(payload: WebhookPayload) {
  const { data } = payload;
  const name = data?.name as string | undefined;
  const status = data?.status as string | undefined;

  if (status === "Completed" && name) {
    await slackContactNotify({
      name: "Notion Projects",
      email: "",
      company: "",
      service: "Project completed",
      message: `🎉 Project "${name}" has been marked as Completed!`,
    }).catch(() => {});
  }

  if (status === "Blocked" && name) {
    await slackContactNotify({
      name: "Notion Projects",
      email: "",
      company: "",
      service: "Project blocked",
      message: `🚫 Project "${name}" is now Blocked — needs attention.`,
    }).catch(() => {});
  }

  return { updated: true, database: "projects", project: name ?? payload.page_id };
}

async function handleTaskUpdated(payload: WebhookPayload) {
  const { data } = payload;
  const task = data?.task as string | undefined;
  const status = data?.status as string | undefined;
  const assignee = data?.assignee as string | undefined;

  if (status === "Blocked" && task) {
    await slackContactNotify({
      name: "Notion Tasks",
      email: "",
      company: "",
      service: "Task blocked",
      message: `🚫 Task "${task}"${assignee ? ` (assigned to ${assignee})` : ""} is Blocked.`,
    }).catch(() => {});
  }

  return { updated: true, database: "tasks", task: task ?? payload.page_id, status };
}

async function handleAnalyticsEvent(payload: WebhookPayload) {
  const { data } = payload;
  const type = data?.type as string | undefined;
  const count = data?.count as number | undefined;

  if (type === "error" && count && count >= 10) {
    await slackContactNotify({
      name: "Notion Analytics",
      email: "",
      company: "",
      service: "Error spike detected",
      message: `⚠️ ${count} errors recorded — check the analytics dashboard.`,
    }).catch(() => {});
  }

  return { tracked: true, database: "analytics", type };
}

async function handleSubmissionStatus(payload: WebhookPayload) {
  const { data } = payload;

  const email = data?.email as string | undefined;
  const name = data?.name as string | undefined;
  const status = data?.status as string | undefined;

  if (!email || !status) {
    return { emailed: false, reason: "Missing email or status in data" };
  }

  if (status !== "Done") {
    return { emailed: false, reason: `Status "${status}" does not trigger email` };
  }

  try {
    const config = await getConfig();
    await sendEmail({
      to: email,
      subject: `Your inquiry has been reviewed — Cloudless`,
      html: `
        <p>Hi ${escapeHtml(name ?? "there")},</p>
        <p>We've reviewed your inquiry and will follow up shortly with more details.</p>
        <p>If you have any additional questions, feel free to reply to this email.</p>
        <br/>
        <p>— The Cloudless Team</p>
      `,
      text: `Hi ${name ?? "there"},\n\nWe've reviewed your inquiry and will follow up shortly.\n\nReply to this email if you have questions.\n\n— The Cloudless Team`,
      replyTo: [config.SES_TO_EMAIL],
      fromLabel: "Cloudless",
    });
    return { emailed: true, to: email };
  } catch (err) {
    console.error("[Webhook] Failed to send status email:", err);
    return { emailed: false, reason: "Email send failed" };
  }
}

// ───────────────────────────── Main ──────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json(
      { error: "Invalid or missing x-webhook-secret" },
      { status: 401 },
    );
  }

  let body: WebhookPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.type || !body.database || !body.page_id) {
    return NextResponse.json(
      { error: "type, database, and page_id are required" },
      { status: 400 },
    );
  }

  try {
    let result: Record<string, unknown>;

    switch (body.type) {
      case "page.updated":
        result = await handlePageUpdated(body);
        break;
      case "page.created":
        result = await handlePageCreated(body);
        break;
      case "submission.status":
        result = await handleSubmissionStatus(body);
        break;
      case "project.updated":
        result = await handleProjectUpdated(body);
        break;
      case "task.updated":
        result = await handleTaskUpdated(body);
        break;
      case "analytics.event":
        result = await handleAnalyticsEvent(body);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown event type: ${body.type}` },
          { status: 400 },
        );
    }

    return NextResponse.json({ ok: true, type: body.type, ...result });
  } catch (err) {
    console.error("[Webhook] Error processing event:", err);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import("@sentry/nextjs")
        .then(({ captureException, withScope }) =>
          withScope((scope) => {
            scope.setTag("route", "notion.webhook");
            scope.setTag("notion.event", body.type);
            captureException(err);
          }),
        )
        .catch(() => {});
    }
    return NextResponse.json(
      { error: "Internal error processing webhook" },
      { status: 500 },
    );
  }
}
