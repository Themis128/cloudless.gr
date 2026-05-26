import { NextRequest, NextResponse } from "next/server";
import { slackErrorNotify } from "@/lib/slack-notify";
import { requireAdmin } from "@/lib/api-auth";
import { getSlackConfigAsync } from "@/lib/integrations";

/**
 * POST /api/admin/notifications/test — send a test Slack message to #errors.
 * Requires admin authentication.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const cfg = await getSlackConfigAsync();
  if (!cfg.SLACK_BOT_TOKEN && !cfg.SLACK_WEBHOOK_URL) {
    return NextResponse.json(
      {
        error: "Slack not configured — set SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL.",
      },
      { status: 503 }
    );
  }

  await slackErrorNotify({
    title: "Notification test",
    message: "Slack notifications are working correctly.",
    route: "/api/admin/notifications/test",
  });

  return NextResponse.json({ success: true });
}
