import { NextRequest, NextResponse, after } from "next/server";
import { requireVerifiedAuth } from "@/lib/api-auth";
import { upsertPendingClient } from "@/lib/pending-clients";
import { isValidPlan, PLAN_LABELS } from "@/lib/plans";
import { sendEmail } from "@/lib/email";
import { SlackClient } from "@/lib/slack-notify";
import { escapeHtml } from "@/lib/escape-html";
import { slackEscape } from "@/lib/slack-escape";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Admin notification destination — sent direct to Themis, not the generic team alias.
const ADMIN_NOTIFY_EMAIL = "tbaltzakis@cloudless.gr";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cloudless.gr";

// Server-side body validation. Names and free-form notes are surfaced into
// admin email + Slack, so we clamp length, reject control / tag-metachars,
// and bound the SSM payload size (PutParameter caps at 4 KB per parameter).
const MAX_NAME_LEN = 80;
const MAX_NOTES_LEN = 1000;
const FORBIDDEN_NAME = /[<>@&\u0000-\u001f\u007f]/;
function sanitizeName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed || FORBIDDEN_NAME.test(trimmed)) return undefined;
  return trimmed.slice(0, MAX_NAME_LEN);
}
function sanitizeNotes(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Strip ASCII control codepoints (keeping newlines + tab) and clamp.
  return trimmed.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").slice(0, MAX_NOTES_LEN);
}

/**
 * POST /api/portal/enroll
 * Auth required + Cognito email_verified=true.
 * Body: { plan: <one of plans/PLAN_LABELS keys>, name?: string, notes?: string }
 *
 * Adds the authenticated user to the pending-clients waiting list and
 * notifies the admin via email + Slack with all relevant info.
 */
export async function POST(request: NextRequest) {
  // Enrollment fans out to SES + Slack + SSM, so cap aggressively. Key on
  // BOTH IP and (once we have it) email so a single corporate-NAT'd team
  // doesn't burn each other's quota while a Tor-rotating attacker can't
  // weaponize "10 per IP" into thousands of admin pings.
  const ipRl = rateLimit(`portal-enroll:ip:${getClientIp(request)}`, 10, 60_000);
  if (!ipRl.ok) return ipRl.response;

  const auth = await requireVerifiedAuth(request);
  if (!auth.ok) return auth.response;

  const email = auth.user.email?.toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Authenticated user has no email" },
      { status: 400 },
    );
  }

  // Hard per-email cap: max 3 enrollments per hour. Prevents an authenticated
  // user from grinding the admin inbox even from a single IP.
  const emailRl = rateLimit(`portal-enroll:email:${email}`, 3, 3_600_000);
  if (!emailRl.ok) return emailRl.response;

  const body = (await request.json().catch(() => ({}))) as {
    plan?: unknown;
    notes?: unknown;
    name?: unknown;
  };

  if (!isValidPlan(body.plan)) {
    return NextResponse.json(
      {
        error: `Invalid or missing plan. Must be one of: ${[...Object.keys(PLAN_LABELS)].join(", ")}`,
      },
      { status: 400 },
    );
  }

  const plan = body.plan;
  const planLabel = PLAN_LABELS[plan];

  let pending;
  try {
    pending = await upsertPendingClient({
      email,
      plan,
      planLabel,
      name: sanitizeName(body.name),
      notes: sanitizeNotes(body.notes),
    });
  } catch (err) {
    // Pending clients persistence is backed by SSM. In local/dev E2E
    // environments missing AWS credentials should degrade as 503 rather
    // than bubbling a 500.
    console.error("[portal/enroll] pending client store error:", err);
    return NextResponse.json(
      { error: "Pending clients store unavailable" },
      { status: 503 },
    );
  }

  // Fire-and-forget admin notifications. Use Next.js `after()` when available
  // (Lambda/Edge — defers work until after response is flushed) and fall back
  // to a plain Promise for test environments where `after` is not injected.
  const notify = async () => {
    try {
      await notifyAdminOfPendingClient(pending);
    } catch (err) {
      console.error("[portal/enroll] admin notification failed:", err);
    }
  };
  try {
    after(notify);
  } catch {
    notify().catch(() => {});
  }

  return NextResponse.json(
    { pending },
    {
      status: 201,
      // Never edge-cache personal data, even though dynamic=force-dynamic
      // already disables Next caching — CDNs may treat the route as
      // cacheable without an explicit header.
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

async function notifyAdminOfPendingClient(pending: {
  email: string;
  name?: string;
  plan: string;
  planLabel?: string;
  submittedAt: string;
  notes?: string;
}) {
  const submittedDate = new Date(pending.submittedAt).toLocaleString("en-IE", { day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit", timeZone: "Europe/Athens" });
  const adminUrl = `${BASE_URL}/admin/client-portals`;

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
          <a href="${escapeHtml(adminUrl)}" style="display: inline-block; background: #06b6d4; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Review in Admin</a>
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
      `Review: ${adminUrl}`,
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

  // Slack — all interpolated fields run through slackEscape() to defang
  // mrkdwn injection (links, channel mentions, bidi overrides).
  try {
    const slack = new SlackClient();
    const eName = slackEscape(pending.name ?? "—");
    const eEmail = slackEscape(pending.email);
    const ePlan = slackEscape(pending.planLabel ?? pending.plan);
    const eSubmitted = slackEscape(submittedDate);
    await slack.post({
      text: `New client waiting for portal: ${eEmail} (${ePlan})`,
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
            text: `*Name:* ${eName}\n*Email:* \`${eEmail}\`\n*Plan:* ${ePlan}`,
          },
        },
        ...(pending.notes
          ? [
              {
                type: "section" as const,
                text: {
                  type: "mrkdwn" as const,
                  // Wrap user notes in a code block; this neutralizes mrkdwn
                  // markup AND visually separates client text from our own.
                  text: `*Notes:*\n\`\`\`${slackEscape(pending.notes, MAX_NOTES_LEN)}\`\`\``,
                },
              },
            ]
          : []),
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Submitted ${eSubmitted} • <${adminUrl}|Review in admin>`,
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
