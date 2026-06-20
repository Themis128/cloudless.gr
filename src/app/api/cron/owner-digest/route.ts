import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { SlackClient } from "@/lib/slack-notify";
import { readPortals } from "@/lib/client-portals";
import { scoreClientHealth } from "@/lib/client-health";
import { getCalendarItems } from "@/lib/content-calendar";
import { listContacts } from "@/lib/espocrm";
import { isConfiguredAsync } from "@/lib/integrations";

/**
 * Weekly owner digest (Phase 4) — one Slack message with everything that
 * needs the owner's attention:
 *   - new leads (HubSpot contacts created in the last 7 days)
 *   - content published/scheduled this week (calendar)
 *   - deliverables awaiting client review
 *   - open payment links
 *   - at-risk / watch clients (health score)
 *
 * Trigger: GET with `Authorization: Bearer <CRON_SECRET>` — schedule weekly.
 * Every section degrades gracefully when its source is unconfigured.
 */

const WEEK_MS = 7 * 86_400_000;

interface HubSpotContactRecord {
  properties?: { email?: string; createdate?: string };
}

async function countNewLeads(sinceIso: string): Promise<number | null> {
  if (!(await isConfiguredAsync("ESPOCRM_API_KEY"))) return null;
  try {
    const contacts = (await listContacts(100)) as HubSpotContactRecord[];
    return contacts.filter((c) => {
      const created = c.properties?.createdate;
      return created !== undefined && created >= sinceIso;
    }).length;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!(await isCronAuthorized(request))) {
    return cronUnauthorized();
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - WEEK_MS);
  const weekAgoDate = weekAgo.toISOString().split("T")[0];
  const todayDate = now.toISOString().split("T")[0];

  const [newLeads, calendarItems, portals] = await Promise.all([
    countNewLeads(weekAgo.toISOString()),
    getCalendarItems(weekAgoDate, todayDate).catch(() => []),
    readPortals().catch(() => []),
  ]);

  const published = calendarItems.filter((i) => i.status === "published").length;
  const scheduled = calendarItems.filter((i) => i.status === "scheduled").length;

  const awaitingReview = portals.flatMap((p) =>
    (p.deliverables ?? [])
      .filter((d) => d.status === "in_review")
      .map((d) => `• ${d.title} — ${p.clientName || p.clientEmail}`)
  );
  const openPayments = portals.flatMap((p) =>
    (p.paymentLinks ?? [])
      .filter((l) => l.status === "open")
      .map(
        (l) =>
          `• ${l.label}${typeof l.amountCents === "number" ? ` (${(l.amountCents / 100).toFixed(2)} ${l.currency ?? "EUR"})` : ""} — ${p.clientName || p.clientEmail}`
      )
  );
  const unhealthy = portals
    .map((p) => ({ portal: p, health: scoreClientHealth(p, now) }))
    .filter(({ health }) => health.band !== "healthy")
    .map(
      ({ portal, health }) =>
        `• ${portal.clientName || portal.clientEmail} (${portal.label}): ${health.score}/100 ${health.band === "at_risk" ? "🔴" : "🟡"} — ${health.reasons.join("; ")}`
    );

  const lines: string[] = [
    `*Leads:* ${newLeads === null ? "HubSpot not configured" : `${newLeads} new in the last 7 days`}`,
    `*Content:* ${published} published, ${scheduled} scheduled this week`,
    `*Deliverables awaiting client review:* ${awaitingReview.length}`,
    ...awaitingReview.slice(0, 10),
    `*Open payments:* ${openPayments.length}`,
    ...openPayments.slice(0, 10),
    `*Client health:* ${unhealthy.length === 0 ? "all clients healthy ✅" : `${unhealthy.length} need(s) attention`}`,
    ...unhealthy.slice(0, 10),
  ];

  const sent = await new SlackClient().post({
    text: `Weekly digest: ${newLeads ?? 0} new leads, ${awaitingReview.length} reviews pending, ${unhealthy.length} client(s) need attention`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `📊 Weekly Digest — ${todayDate}`, emoji: true },
      },
      { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
    ],
  });

  return NextResponse.json({
    sent,
    newLeads,
    published,
    scheduled,
    awaitingReview: awaitingReview.length,
    openPayments: openPayments.length,
    clientsNeedingAttention: unhealthy.length,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
