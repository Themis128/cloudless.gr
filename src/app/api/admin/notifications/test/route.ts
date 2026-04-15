import { NextRequest, NextResponse } from "next/server";
import { slackNotify } from "@/lib/slack-notify";
import { requireAdmin } from "@/lib/api-auth";

/**
 * POST /api/admin/notifications/test — send a test Slack message
 *
 * Returns 503 when SLACK_WEBHOOK_URL is explicitly set to "" (intentionally
 * disabled). Requires admin authentication.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (process.env.SLACK_WEBHOOK_URL === "") {
    return NextResponse.json(
      { error: "Slack not configured." },
      { status: 503 },
    );
  }

  const ok = await slackNotify({
    text: "✅ Cloudless notification test — Slack webhook is working!",
  });

  return NextResponse.json({ success: ok });
}
