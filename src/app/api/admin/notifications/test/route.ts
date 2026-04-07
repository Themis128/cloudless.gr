import { NextResponse } from "next/server";
import { slackNotify } from "@/lib/slack-notify";
import { isConfigured } from "@/lib/integrations";

/** POST /api/admin/notifications/test — send a test Slack message */
export async function POST() {
  if (!isConfigured("SLACK_WEBHOOK_URL")) {
    return NextResponse.json({ error: "Slack not configured." }, { status: 503 });
  }

  const ok = await slackNotify({
    text: "\u2705 Cloudless notification test \u2014 Slack webhook is working!",
  });

  return NextResponse.json({ success: ok });
}
