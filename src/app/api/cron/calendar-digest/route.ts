import { NextRequest, NextResponse } from "next/server";
import { getCalendarItems, PLATFORM_LABELS } from "@/lib/content-calendar";
import { SlackClient } from "@/lib/slack-notify";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";

const STATUS_EMOJI: Record<string, string> = {
  draft: ":pencil:",
  scheduled: ":clock3:",
  published: ":white_check_mark:",
  cancelled: ":x:",
};

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorized();
  }

  const today = new Date().toISOString().slice(0, 10);
  const items = await getCalendarItems(today, today);

  if (items.length === 0) {
    return NextResponse.json({
      message: "No items scheduled today",
      count: 0,
      date: today,
    });
  }

  const lines = items.map((item) => {
    const platform = PLATFORM_LABELS[item.platform] ?? item.platform;
    const emoji = STATUS_EMOJI[item.status] ?? "";
    const link = item.url ? ` <${item.url}|view>` : "";
    return `${emoji} *${item.title}* | ${platform} | \`${item.status}\`${link}`;
  });

  const client = new SlackClient();
  await client.post({
    text: `Content calendar for ${today}: ${items.length} item(s)`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `Content Calendar for ${today}`,
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
            text: `${items.length} item(s) scheduled today`,
          },
        ],
      },
    ],
    icon_emoji: ":calendar:",
    username: "Cloudless Bot",
  });

  return NextResponse.json({
    message: "Digest sent",
    count: items.length,
    date: today,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
