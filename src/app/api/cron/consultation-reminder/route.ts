import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { getUpcomingConsultations } from "@/lib/google-calendar";
import { isConfiguredAsync } from "@/lib/integrations";
import { SlackClient } from "@/lib/slack-notify";
import { notifyTeam } from "@/lib/email";

// Window: remind for consultations starting between 45 and 75 minutes from now.
// Run this cron every 30 minutes so any consultation is caught exactly once.
const REMIND_MIN_MS = 45 * 60_000;
const REMIND_MAX_MS = 75 * 60_000;

export async function GET(request: NextRequest) {
  if (!(await isCronAuthorized(request))) {
    return cronUnauthorized();
  }

  if (!(await isConfiguredAsync("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY"))) {
    return NextResponse.json({ skipped: true, reason: "Google Calendar not configured" });
  }

  const now = Date.now();
  const consultations = await getUpcomingConsultations().catch(() => []);

  const soon = consultations.filter((c) => {
    const ms = new Date(c.start).getTime() - now;
    return ms >= REMIND_MIN_MS && ms <= REMIND_MAX_MS;
  });

  if (soon.length === 0) {
    return NextResponse.json({ reminded: 0 });
  }

  const results = await Promise.allSettled(
    soon.map(async (c) => {
      const startLabel = new Date(c.start).toLocaleString("en-IE", {
        timeZone: "Europe/Athens",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const meetLine = c.meetLink ? `\nMeet: ${c.meetLink}` : "";

      await Promise.all([
        new SlackClient().post({
          text: `⏰ Consultation starting in ~1 hour: *${c.title}*`,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "⏰ Consultation in 1 hour", emoji: true },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: [
                  `*${c.title}*`,
                  `*When:* ${startLabel} Athens`,
                  c.meetLink ? `*Meet:* <${c.meetLink}|Join Google Meet>` : "",
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            },
          ],
          icon_emoji: ":calendar:",
          username: "Cloudless Bot",
        }),
        notifyTeam(
          `⏰ Consultation starting in 1 hour — ${c.title}`,
          [
            `<p><strong>Event:</strong> ${c.title}</p>`,
            `<p><strong>When:</strong> ${startLabel} (Athens time)</p>`,
            c.meetLink
              ? `<p><strong>Google Meet:</strong> <a href="${c.meetLink}">${c.meetLink}</a></p>`
              : "",
          ]
            .filter(Boolean)
            .join("\n")
        ),
      ]);
      return c.id;
    })
  );

  const reminded = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ reminded, total: soon.length });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
