import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { upsertPendingClient, PLAN_LABELS } from "@/lib/pending-clients";
import { sendEmail } from "@/lib/email";
import { SlackClient } from "@/lib/slack-notify";
import { escapeHtml } from "@/lib/escape-html";

const ALLOWED_PLANS = new Set(Object.keys(PLAN_LABELS));

// Admin notification destination — sent direct to Themis, not the generic team alias.
const ADMIN_NOTIFY_EMAIL = "tbaltzakis@cloudless.gr";

/**
 * POST /api/portal/enroll
 * Auth required (Cognito Bearer token).
 * Body: { plan: "cloud"|"serverless"|"analytics"|"marketing"|"bundle", notes?: string }
 *
 * Adds the authenticated user to the pending-clients waiting list and
 * notifies the admin via email + Slack with all relevant info.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const email = auth.user.email;
  if (!email) {
    return NextResponse.json(
      { error: "Authenticated user has no email" },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    plan?: string;
    notes?: string;
    name?: string;
  };

  if (!body.plan || !ALLOWED_PLANS.has(body.plan)) {
    return NextResponse.json(
      {
        error: `Invalid or missing plan. Must be one of: ${[...ALLOWED_PLANS].join(", ")}`,
      },
      { status: 400 },
    );
  }

  const planLabel = PLAN_LABELS[body.plan];

  const pending = await upsertPendingClient({
    email,
    plan: body.plan,
    planLabel,
    name: body.name,
    notes: body.notes,
  });

  // Fire-and-forget admin notifications. Don't block client on these.
  notifyAdminOfPendingClient(pending).catch((err) => {
    console.error("[portal/enroll] admin notification failed:", err);
  });

  return NextResponse.json({ pending }, { status: 201 });
}

async function notifyAdminOfPendingClient(pending: {
  email: string;
  name?: string;
  plan: string;
  planLabel?: string;
  submittedAt: string;
  notes?: string;
}) {
  const submittedDate = new Date(pending.submittedAt).toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Email — sent from noreply@cloudless.gr (per SES_FROM_EMAIL config) to admin
  {
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #0f172a; font-size: 20px;">New client waiting for portal access</h2>
        <p style="color: #475569; font-size: 14px;">A new client has signed up and is in the waiting room. Review and approve their portal in the admin panel.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 120px;">Name</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${escapeHtml(pending.name ?? "—")}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Email</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${escapeHtml(pending.email)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Plan</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${escapeHtml(pending.planLabel ?? pending.plan)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Submitted</td>
            <td style="padding: 8px 0; color: #0f172a;">${escapeHtml(submittedDate)}</td>
          </tr>
          ${pending.notes ? `<tr><td style="padding: 8px 0; color: #64748b;">Notes</td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(pending.notes)}</td></tr>` : ""}
        </table>
        <p style="margin-top: 24px;">
          <a href="https://cloudless.gr/admin/client-portals" style="display: inline-block; background: #06b6d4; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Review in Admin</a>
        </p>
      </div>
    `;
    const text = [
      "New client waiting for portal access",
      "",
      `Name: ${pending.name ?? "—"}`,
      `Email: ${pending.email}`,
      `Plan: ${pending.planLabel ?? pending.plan}`,
      `Submitted: ${submittedDate}`,
      pending.notes ? `Notes: ${pending.notes}` : null,
      "",
      "Review: https://cloudless.gr/admin/client-portals",
    ]
      .filter(Boolean)
      .join("\n");

    await sendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      subject: `[Cloudless] New client waiting: ${pending.name ?? pending.email}`,
      html,
      text,
      fromLabel: "Cloudless Portal",
    });
  }

  // Slack — using the existing SlackClient
  try {
    const slack = new SlackClient();
    await slack.post({
      text: `New client waiting for portal: ${pending.email} (${pending.planLabel ?? pending.plan})`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "New client in waiting room",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Name:* ${pending.name ?? "—"}\n*Email:* \`${pending.email}\`\n*Plan:* ${pending.planLabel ?? pending.plan}`,
          },
        },
        ...(pending.notes
          ? [
              {
                type: "section" as const,
                text: {
                  type: "mrkdwn" as const,
                  text: `*Notes:*\n>${pending.notes.split("\n").join("\n>")}`,
                },
              },
            ]
          : []),
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Submitted ${submittedDate} • <https://cloudless.gr/admin/client-portals|Review in admin>`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("[portal/enroll] slack notification failed:", err);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
