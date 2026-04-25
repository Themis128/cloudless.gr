import { NextRequest, NextResponse } from "next/server";
import { listReports, updateReport } from "@/lib/reports";
import { SlackClient } from "@/lib/slack-notify";

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

function cronAuth(req: NextRequest): boolean {
  return (
    req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
  );
}

export async function GET(request: NextRequest) {
  if (!cronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reports = await listReports();
  const now = Date.now();

  const stale = reports.filter(
    (r) =>
      r.status === "generating" &&
      now - new Date(r.createdAt).getTime() > STALE_THRESHOLD_MS,
  );

  const results = await Promise.all(
    stale.map((r) => updateReport(r.id, { status: "error" })),
  );
  const cleaned = results.filter(Boolean).length;

  if (cleaned > 0) {
    const client = new SlackClient();
    await client.post({
      text: `Report cleanup: ${cleaned} stale report(s) marked as error`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Report Cleanup", emoji: true },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Marked *${cleaned}* stuck report(s) as \`error\` (generating for more than 2 hours).`,
          },
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
      icon_emoji: ":broom:",
      username: "Cloudless Bot",
    });
  }

  return NextResponse.json({ cleaned, total: reports.length });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
