import { NextRequest, NextResponse } from "next/server";
import { createWeeklyRollup, archiveOldEvents } from "@/lib/notion-analytics";
import { SlackClient } from "@/lib/slack-notify";

function cronAuth(req: NextRequest): boolean {
  return (
    req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
  );
}

export async function GET(request: NextRequest) {
  if (!cronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [rollupId, archiveResult] = await Promise.all([
    createWeeklyRollup(),
    archiveOldEvents(30),
  ]);

  const lines = [
    `*Rollup:* ${rollupId ? "created" : "skipped (Notion not configured)"}`,
    `*Archived:* ${archiveResult.archived} event(s)`,
    ...(archiveResult.errors > 0 ? [`*Errors:* ${archiveResult.errors}`] : []),
  ];

  const client = new SlackClient();
  await client.post({
    text: `Weekly analytics rollup complete (archived ${archiveResult.archived} events)`,
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
            text: `Run at ${new Date().toISOString()}`,
          },
        ],
      },
    ],
    icon_emoji: ":bar_chart:",
    username: "Cloudless Bot",
  });

  return NextResponse.json({
    rollupId,
    archived: archiveResult.archived,
    errors: archiveResult.errors,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
