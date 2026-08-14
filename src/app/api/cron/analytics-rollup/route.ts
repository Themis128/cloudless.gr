import { NextRequest, NextResponse } from "next/server";

import { SlackClient } from "@/lib/slack-notify";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { getWeeklyAnalyticsRollup } from "@/lib/analytics-events-d1";

export async function GET(request: NextRequest) {
  if (!(await isCronAuthorized(request))) {
    return cronUnauthorized();
  }

  const summary = await getWeeklyAnalyticsRollup(7);
  const typeLines = Object.entries(summary.byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([event, n]) => `• ${event}: ${n}`);

  const lines = [
    summary.bound
      ? `*D1 events (7d):* ${summary.eventCount}`
      : "*D1:* AUTH_DB unbound — rollup skipped",
    ...(typeLines.length > 0 ? typeLines : []),
  ];

  const client = new SlackClient();
  await client.post({
    text: `Weekly analytics rollup: ${summary.eventCount} D1 events`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Weekly Analytics Rollup",
          emoji: true,
        },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: lines.join("\n") },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Run at ${new Date().toISOString()} · gold GSC archive is ETL, not this cron`,
          },
        ],
      },
    ],
    icon_emoji: ":bar_chart:",
    username: "Cloudless Bot",
  });

  return NextResponse.json({
    bound: summary.bound,
    eventCount: summary.eventCount,
    byType: summary.byType,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
