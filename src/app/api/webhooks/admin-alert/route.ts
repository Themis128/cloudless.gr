/**
 * Generic admin-alert webhook receiver — fires `notifyAdmin()` (Slack + opt-in ntfy)
 * for any caller that can POST a JSON payload with a shared secret.
 *
 * R8 of the 2026-06-21 R-series. Backstop endpoint for the three "SEV1 should
 * wake the operator" sources that aren't natively wired through `notifyAdmin()`:
 *
 *   1. Sentry alerts — configure a webhook in Sentry → Alerts → Internal Integration
 *      pointing here. (For Sentry's native body shape use the dedicated
 *      /api/webhooks/sentry endpoint instead — it handles the shape difference.)
 *   2. Pi alert-api Lambda — when severity >= high, POST here in addition to the
 *      existing MQTT publish. Operator wire-up step in alert-api's deploy.sh.
 *   3. Any future cron / health check that wants phone push.
 *
 * Auth: `x-cloudless-alert-secret` header must equal SSM `ADMIN_ALERT_SECRET`
 * (falls back to `NOTION_WEBHOOK_SECRET` so existing callers can reuse their
 * token until rotation). Constant-time compare to avoid timing leaks.
 *
 * Always returns 2xx unless auth fails or the body is malformed — so an outage
 * in Slack/ntfy doesn't loop the caller into infinite retries.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getConfig } from "@/lib/ssm-config";
import { notifyAdmin, type AdminAlertSeverity } from "@/lib/admin-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_SEVERITIES: AdminAlertSeverity[] = ["info", "warning", "error", "high", "critical"];

interface AdminAlertBody {
  severity: AdminAlertSeverity;
  title: string;
  message: string;
  click?: string;
  source?: string;
}

function isValid(body: unknown): body is AdminAlertBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.severity === "string" &&
    VALID_SEVERITIES.includes(b.severity as AdminAlertSeverity) &&
    typeof b.title === "string" &&
    b.title.length > 0 &&
    b.title.length <= 200 &&
    typeof b.message === "string" &&
    b.message.length <= 2000 &&
    (b.click === undefined || typeof b.click === "string") &&
    (b.source === undefined || typeof b.source === "string")
  );
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  const provided = req.headers.get("x-cloudless-alert-secret") ?? "";
  if (!provided) {
    return NextResponse.json({ error: "missing_secret" }, { status: 401 });
  }

  const cfg = await getConfig();
  const expected = cfg.ADMIN_ALERT_SECRET || cfg.CONTENT_WEBHOOK_SECRET || "";
  if (!expected) {
    // No secret configured anywhere — refuse rather than open up the endpoint.
    return NextResponse.json({ error: "receiver_not_configured" }, { status: 503 });
  }
  if (!safeEq(provided, expected)) {
    return NextResponse.json({ error: "bad_secret" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isValid(body)) {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }

  const tagged = body.source ? { ...body, title: `[${body.source}] ${body.title}` } : body;

  const result = await notifyAdmin({
    severity: tagged.severity,
    title: tagged.title,
    message: tagged.message,
    click: tagged.click,
  });

  return NextResponse.json({ ok: true, result });
}
