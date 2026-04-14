import { NextResponse } from "next/server";
import { slackNotify } from "@/lib/slack-notify";

/**
 * POST /api/admin/notifications/test — send a test Slack message
 *
 * Returns 503 when SLACK_WEBHOOK_URL is explicitly set to "" (intentionally
 * disabled).  When the variable is simply absent (undefined) we fall through
 * to slackNotify, which will use SLACK_BOT_TOKEN if available.
 */
export async function POST() {
  if (process.env.SLACK_WEBHOOK_URL === "") {
    return NextResponse.json(
      { error: "Slack not configured." },
      { status: 503 },
    );
  }

  const ok = await slackNotify({
    text: "\u2705 Cloudless notification test \u2014 Slack webhook is working!",
  });

  return NextResponse.json({ success: ok });
}
