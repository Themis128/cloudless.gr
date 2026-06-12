import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { readPortals, writePortals, type ClientPortal } from "@/lib/client-portals";
import { buildReportHtml } from "@/lib/client-report-email";
import { sendEmail } from "@/lib/email";

/**
 * Monthly client status report (Phase 3).
 *
 * For every portal with reportsEnabled=true that hasn't been reported on in
 * the last 25 days, emails the client a status summary: project steps,
 * deliverables awaiting review, and open payment links — with a link to
 * their portal.
 *
 * Trigger: GET with `Authorization: Bearer <CRON_SECRET>` (same contract as
 * the other /api/cron routes). Schedule it monthly from your scheduler of
 * choice (GitHub Actions cron, EventBridge, or the Pi's systemd timers).
 * Idempotent within the 25-day window — safe to run more often.
 */

const MIN_DAYS_BETWEEN_REPORTS = 25;
const BASE_URL = "https://cloudless.gr";

function isDue(portal: ClientPortal, now: Date): boolean {
  if (!portal.reportsEnabled) return false;
  if (!portal.lastReportAt) return true;
  const last = new Date(portal.lastReportAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= MIN_DAYS_BETWEEN_REPORTS * 86_400_000;
}

export async function GET(request: NextRequest) {
  if (!(await isCronAuthorized(request))) {
    return cronUnauthorized();
  }

  const now = new Date();
  const portals = await readPortals();
  const due = portals.filter((p) => isDue(p, now));

  if (due.length === 0) {
    return NextResponse.json({ sent: 0, message: "No client reports due." });
  }

  const sent: string[] = [];
  const failed: string[] = [];

  for (const portal of due) {
    try {
      await sendEmail({
        to: portal.clientEmail,
        subject: `Project update — ${portal.label}`,
        html: buildReportHtml(portal),
        text: `Your monthly project update for ${portal.label} is ready. View it at ${BASE_URL}/portal/${portal.token}`,
        fromLabel: "Cloudless",
      });
      portal.lastReportAt = now.toISOString();
      sent.push(portal.clientEmail);
    } catch (err) {
      console.error(`[ClientReports] send failed for ${portal.clientEmail}:`, err);
      failed.push(portal.clientEmail);
    }
  }

  if (sent.length > 0) {
    await writePortals(portals);
  }

  return NextResponse.json({ sent: sent.length, failed: failed.length, recipients: sent });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
