/**
 * External Services Health Check
 *
 * Pings every configured external integration with a lightweight API call
 * to verify credentials and connectivity. Posts a consolidated status
 * dashboard to Slack so the team can see at a glance which services are
 * healthy without logging into each platform.
 *
 * Designed to run from .github/workflows/services-health-check.yml every
 * day at 05:00 UTC (before other sync jobs). Self-contained: reads
 * everything from process.env.
 *
 * Checked services (all optional — skipped gracefully if not configured):
 *   - Notion       GET /v1/users/me
 *   - HubSpot      GET /crm/v3/objects/contacts?limit=1
 *   - Stripe       GET /v1/balance
 *   - Sentry       GET /api/0/projects/{org}/{project}/
 *   - Google Cal   JWT token exchange
 *   - ActiveCampaign GET /api/3/contacts?limit=1
 *   - Slack        POST webhook (structural ping, no channel message)
 *
 * Required env (at least one must be set for a useful run):
 *   Any subset of the optional envs below.
 *
 * Optional env:
 *   SLACK_WEBHOOK_URL          Slack webhook — also the report destination
 *   NOTION_API_KEY             Notion integration token
 *   HUBSPOT_API_KEY            HubSpot private-app token
 *   STRIPE_SECRET_KEY          Stripe secret key
 *   SENTRY_AUTH_TOKEN          Sentry auth token
 *   SENTRY_ORG                 Sentry org slug (default: "baltzakisthemiscom")
 *   SENTRY_PROJECT             Sentry project slug (default: "cloudless-gr")
 *   GOOGLE_CLIENT_EMAIL        Service-account email
 *   GOOGLE_PRIVATE_KEY         PEM private key (literal \n)
 *   ACTIVECAMPAIGN_API_URL     ActiveCampaign base URL
 *   ACTIVECAMPAIGN_API_TOKEN   ActiveCampaign API token
 */

import { SignJWT, importPKCS8 } from "jose";

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

// ---------------------------------------------------------------------------
// Check result type
// ---------------------------------------------------------------------------

type ServiceStatus = "ok" | "error" | "skipped";

interface CheckResult {
  service: string;
  status: ServiceStatus;
  latencyMs?: number;
  message?: string;
}

// ---------------------------------------------------------------------------
// Individual service checks
// ---------------------------------------------------------------------------

async function checkNotion(): Promise<CheckResult> {
  const token = optionalEnv("NOTION_API_KEY");
  if (!token) return { service: "Notion", status: "skipped" };

  const start = Date.now();
  try {
    const res = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return {
        service: "Notion",
        status: "error",
        latencyMs,
        message: `HTTP ${res.status}`,
      };
    }
    return { service: "Notion", status: "ok", latencyMs };
  } catch (err) {
    return {
      service: "Notion",
      status: "error",
      latencyMs: Date.now() - start,
      message: String(err),
    };
  }
}

async function checkHubSpot(): Promise<CheckResult> {
  const token = optionalEnv("HUBSPOT_API_KEY");
  if (!token) return { service: "HubSpot", status: "skipped" };

  const start = Date.now();
  try {
    const res = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return {
        service: "HubSpot",
        status: "error",
        latencyMs,
        message: `HTTP ${res.status}`,
      };
    }
    return { service: "HubSpot", status: "ok", latencyMs };
  } catch (err) {
    return {
      service: "HubSpot",
      status: "error",
      latencyMs: Date.now() - start,
      message: String(err),
    };
  }
}

async function checkStripe(): Promise<CheckResult> {
  const key = optionalEnv("STRIPE_SECRET_KEY");
  if (!key) return { service: "Stripe", status: "skipped" };

  const start = Date.now();
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${key}`,
        "Stripe-Version": "2025-02-24.acacia",
      },
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return {
        service: "Stripe",
        status: "error",
        latencyMs,
        message: `HTTP ${res.status}`,
      };
    }
    return { service: "Stripe", status: "ok", latencyMs };
  } catch (err) {
    return {
      service: "Stripe",
      status: "error",
      latencyMs: Date.now() - start,
      message: String(err),
    };
  }
}

async function checkSentry(): Promise<CheckResult> {
  const token = optionalEnv("SENTRY_AUTH_TOKEN");
  if (!token) return { service: "Sentry", status: "skipped" };

  const org = optionalEnv("SENTRY_ORG") ?? "baltzakisthemiscom";
  const project = optionalEnv("SENTRY_PROJECT") ?? "cloudless-gr";
  const start = Date.now();

  try {
    const res = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return {
        service: "Sentry",
        status: "error",
        latencyMs,
        message: `HTTP ${res.status}`,
      };
    }
    return { service: "Sentry", status: "ok", latencyMs };
  } catch (err) {
    return {
      service: "Sentry",
      status: "error",
      latencyMs: Date.now() - start,
      message: String(err),
    };
  }
}

async function checkGoogleCalendar(): Promise<CheckResult> {
  const email = optionalEnv("GOOGLE_CLIENT_EMAIL");
  const rawKey = optionalEnv("GOOGLE_PRIVATE_KEY");
  if (!email || !rawKey) return { service: "Google Calendar", status: "skipped" };

  const start = Date.now();
  try {
    const privateKey = await importPKCS8(rawKey.replace(/\\n/g, "\n"), "RS256");
    const now = Math.floor(Date.now() / 1000);
    const TOKEN_URL = "https://oauth2.googleapis.com/token";

    const jwt = await new SignJWT({
      iss: email,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      aud: TOKEN_URL,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return {
        service: "Google Calendar",
        status: "error",
        latencyMs,
        message: `Token exchange failed HTTP ${res.status}`,
      };
    }
    return { service: "Google Calendar", status: "ok", latencyMs };
  } catch (err) {
    return {
      service: "Google Calendar",
      status: "error",
      latencyMs: Date.now() - start,
      message: String(err),
    };
  }
}

async function checkActiveCampaign(): Promise<CheckResult> {
  const url = optionalEnv("ACTIVECAMPAIGN_API_URL");
  const token = optionalEnv("ACTIVECAMPAIGN_API_TOKEN");
  if (!url || !token) return { service: "ActiveCampaign", status: "skipped" };

  const start = Date.now();
  try {
    const base = url.replace(/\/$/, "");
    const res = await fetch(`${base}/api/3/contacts?limit=1`, {
      headers: { "Api-Token": token },
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    if (res.status === 401 || res.status === 403) {
      return {
        service: "ActiveCampaign",
        status: "error",
        latencyMs,
        message: `Token rejected (HTTP ${res.status})`,
      };
    }
    if (!res.ok) {
      return {
        service: "ActiveCampaign",
        status: "error",
        latencyMs,
        message: `HTTP ${res.status}`,
      };
    }
    return { service: "ActiveCampaign", status: "ok", latencyMs };
  } catch (err) {
    return {
      service: "ActiveCampaign",
      status: "error",
      latencyMs: Date.now() - start,
      message: String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Slack report
// ---------------------------------------------------------------------------

function statusEmoji(status: ServiceStatus): string {
  if (status === "ok") return "✅";
  if (status === "error") return "❌";
  return "⏭️";
}

async function postSlackReport(
  webhookUrl: string,
  results: CheckResult[],
  runUrl?: string,
): Promise<void> {
  const healthy = results.filter((r) => r.status === "ok").length;
  const failing = results.filter((r) => r.status === "error").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  const overallEmoji = failing > 0 ? "🔴" : "🟢";
  const overallText =
    failing > 0
      ? `${failing} service(s) have issues`
      : "All services healthy";

  const rows = results
    .map((r) => {
      const latency = r.latencyMs !== undefined ? ` — ${r.latencyMs}ms` : "";
      const note = r.message ? ` _(${r.message})_` : "";
      return `${statusEmoji(r.status)} *${r.service}*${latency}${note}`;
    })
    .join("\n");

  const body = {
    text: `${overallEmoji} Services health check — ${overallText}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${overallEmoji} Services Health Check`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Healthy:* ${healthy}` },
          { type: "mrkdwn", text: `*Failing:* ${failing}` },
          { type: "mrkdwn", text: `*Skipped:* ${skipped}` },
          {
            type: "mrkdwn",
            text: `*Checked at:* ${new Date().toISOString()}`,
          },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: rows },
      },
      ...(runUrl
        ? [
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: `<${runUrl}|View run>` }],
            },
          ]
        : []),
    ],
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const slackUrl = optionalEnv("SLACK_WEBHOOK_URL");
  const runUrl = optionalEnv("GITHUB_RUN_URL");

  console.log("[services-health-check] running checks in parallel…");

  const results = await Promise.all([
    checkNotion(),
    checkHubSpot(),
    checkStripe(),
    checkSentry(),
    checkGoogleCalendar(),
    checkActiveCampaign(),
  ]);

  for (const r of results) {
    const latency = r.latencyMs !== undefined ? ` (${r.latencyMs}ms)` : "";
    const note = r.message ? ` — ${r.message}` : "";
    console.log(`[services-health-check] ${r.service}: ${r.status}${latency}${note}`);
  }

  const failCount = results.filter((r) => r.status === "error").length;

  if (slackUrl) {
    await postSlackReport(slackUrl, results, runUrl);
  }

  if (failCount > 0) {
    console.error(
      `[services-health-check] ${failCount} service(s) failed health check`,
    );
    process.exit(1);
  }

  console.log("[services-health-check] all configured services are healthy");
}

main().catch((err: unknown) => {
  console.error("[services-health-check] FATAL:", err);
  process.exit(1);
});
