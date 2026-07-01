import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { readPortals, writePortals, tokenMatches, applyClientResponse } from "@/lib/client-portals";
import { recordNotification } from "@/lib/admin-notifications";
import { SlackClient } from "@/lib/slack-notify";
import { sendEmail } from "@/lib/email";
import { getConfig } from "@/lib/ssm-config";
import { escapeHtml } from "@/lib/escape-html";
import { publishPortalNotification } from "@/lib/sns-notify";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Client action on a deliverable — approve or request changes.
 * Token-authenticated (the portal token is the credential).
 *
 * Body: { deliverableId: string, action: "approve" | "request_changes", comment?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = rateLimit(`portal-deliverable:${getClientIp(request)}`, 10, 60_000);
  if (!rl.ok) return rl.response;

  const { token } = await params;
  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { deliverableId?: string; action?: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.deliverableId || (body.action !== "approve" && body.action !== "request_changes")) {
    return NextResponse.json(
      { error: "deliverableId and action (approve | request_changes) are required" },
      { status: 400 }
    );
  }
  if (body.action === "request_changes" && !body.comment?.trim()) {
    return NextResponse.json({ error: "Please describe the changes you'd like." }, { status: 400 });
  }

  const portals = await readPortals();
  const idx = portals.findIndex((p) => tokenMatches(token, p.token));
  if (idx === -1) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const portal = portals[idx];
  const result = applyClientResponse(portal, body.deliverableId, body.action, body.comment);
  if (typeof result === "string") {
    return NextResponse.json({ error: result }, { status: 409 });
  }

  portals[idx] = portal;
  await writePortals(portals);

  // Notify the team — fire-and-forget, never blocks the client's response.
  const approved = body.action === "approve";
  const verb = approved ? "approved ✅" : "requested changes on 🔁";
  const clientLabel = portal.clientName || portal.clientEmail;
  const commentText = result.clientComment ?? "";

  recordNotification({
    category: "portal",
    type: approved ? "success" : "warning",
    title: `${clientLabel} ${approved ? "approved" : "requested changes on"} "${result.title}"`,
    message: `Project: ${portal.label}${commentText ? ` — ${commentText.slice(0, 500)}` : ""}`,
    actor: portal.clientEmail,
    route: "/api/portal/[token]/deliverables",
    metadata: {
      portalLabel: portal.label,
      deliverableTitle: result.title,
      deliverableId: result.id,
      action: body.action,
    },
  });

  new SlackClient()
    .post({
      text: `${clientLabel} ${approved ? "approved" : "requested changes on"} "${result.title}" (${portal.label})`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `*${clientLabel}* ${verb} *${result.title}*\n` +
              `Project: ${portal.label}` +
              (commentText ? `\n>${commentText.slice(0, 500)}` : ""),
          },
        },
      ],
    })
    .catch(() => {});

  (async () => {
    const cfg = await getConfig();
    await sendEmail({
      to: cfg.SES_TO_EMAIL,
      subject: `[Portal] ${clientLabel} ${approved ? "approved" : "requested changes"}: ${result.title}`,
      html:
        `<p><strong>${escapeHtml(clientLabel)}</strong> ${approved ? "approved" : "requested changes on"} ` +
        `<strong>${escapeHtml(result.title)}</strong> (project: ${escapeHtml(portal.label)}).</p>` +
        (commentText ? `<blockquote>${escapeHtml(commentText)}</blockquote>` : ""),
      text:
        `${clientLabel} ${approved ? "approved" : "requested changes on"} "${result.title}" (${portal.label}).` +
        (commentText ? `\n\nComment:\n${commentText}` : ""),
      fromLabel: "Cloudless Portal",
    });
  })().catch((err) => console.error("[Portal] deliverable notification email failed:", err));

  // Publish to the SNS topic for fan-out to email/Slack (fire-and-forget).
  publishPortalNotification({
    eventType: "deliverable_action",
    portalLabel: portal.label,
    clientName: clientLabel,
    clientEmail: portal.clientEmail,
    title: `[Portal] ${clientLabel} ${approved ? "approved" : "requested changes"}: ${result.title}`,
    description: `${clientLabel} ${verb} "${result.title}" (${portal.label}).${commentText ? `\n>${commentText.slice(0, 500)}` : ""}`,
    url: `https://cloudless.gr/portal/${portal.token}`,
    metadata: {
      deliverableId: result.id,
      deliverableTitle: result.title,
      action: body.action,
      portalToken: portal.token,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, deliverable: result });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
