/**
 * Sentry alert webhook receiver — verifies Sentry's HMAC signature, classifies
 * severity, and fans out via `notifyAdmin()`.
 *
 * R8 of the 2026-06-21 R-series. Sentry signs every webhook with HMAC-SHA256
 * over the raw request body using the integration's client secret; the digest
 * arrives in `sentry-hook-signature`. We verify, then map the alert's level
 * field to one of our `AdminAlertSeverity` buckets:
 *   - "fatal" / "error" → critical
 *   - "warning"         → warning
 *   - "info" / "debug"  → info
 *
 * Only fires when the issue is unresolved AND in the "production" environment
 * (or env field missing). Resolved/regressed events from staging are dropped to
 * avoid waking the operator over noise.
 *
 * Operator wire-up: Sentry → Settings → Developer Settings → New Internal
 * Integration → Webhook URL `https://cloudless.gr/api/webhooks/sentry`,
 * subscribe to "issue" events, copy the Client Secret into SSM key
 * `SENTRY_WEBHOOK_SECRET` (`aws ssm put-parameter --name
 * /cloudless/production/SENTRY_WEBHOOK_SECRET --type SecureString --value '...'
 * --overwrite`).
 *
 * Webhook signing reference: https://docs.sentry.io/product/integrations/integration-platform/webhooks/#sentry-hook-signature
 */
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "@/lib/ssm-config";
import { notifyAdmin, type AdminAlertSeverity } from "@/lib/admin-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SentryHookData {
  issue?: {
    id?: string;
    title?: string;
    culprit?: string;
    level?: string;
    status?: string;
    permalink?: string;
    project?: { slug?: string };
    metadata?: { value?: string };
  };
  event?: {
    environment?: string;
  };
}

interface SentryHookBody {
  action?: string;
  data?: SentryHookData;
  installation?: { uuid?: string };
}

function mapSeverity(level: string | undefined): AdminAlertSeverity {
  switch (level) {
    case "fatal":
    case "error":
      return "critical";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Browser / health probe — webhooks are POST-only. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    method: "POST",
    usage:
      "Configure this URL as a Sentry Internal Integration webhook (issue events). Do not open it in a browser for delivery tests.",
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("sentry-hook-signature") ?? "";

  const cfg = await getConfig();
  const secret = cfg.SENTRY_WEBHOOK_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "receiver_not_configured" }, { status: 404 });
  }
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let body: SentryHookBody;
  try {
    body = JSON.parse(rawBody) as SentryHookBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const issue = body.data?.issue;
  if (!issue) {
    return NextResponse.json({ ok: true, skipped: "no_issue_in_payload" });
  }

  // Drop noise: resolved events, low-priority info from non-prod environments.
  // R14: AWS/Lambda production emits "prod"; keep accepting legacy "production"
  // during transition. Pi standby emits "pi-standby" and should be skipped here.
  const env = body.data?.event?.environment ?? "";
  const isProdEnv = env === "prod" || env === "production";
  if (env && !isProdEnv) {
    return NextResponse.json({ ok: true, skipped: `non_prod_env:${env}` });
  }
  if (issue.status === "resolved" || issue.status === "ignored") {
    return NextResponse.json({ ok: true, skipped: `issue_status:${issue.status}` });
  }

  const severity = mapSeverity(issue.level);
  const project = issue.project?.slug ?? "sentry";
  const title = `[sentry/${project}] ${issue.title ?? "untitled issue"}`.slice(0, 200);
  const messageLines = [
    issue.culprit ? `Culprit: ${issue.culprit}` : "",
    issue.metadata?.value ? `Value: ${issue.metadata.value}` : "",
    issue.level ? `Level: ${issue.level}` : "",
    body.action ? `Action: ${body.action}` : "",
  ].filter(Boolean);
  const message = messageLines.join("\n").slice(0, 2000);

  const result = await notifyAdmin({
    severity,
    title,
    message,
    click: issue.permalink,
  });

  return NextResponse.json({ ok: true, result });
}
