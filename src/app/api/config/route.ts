import { NextRequest, NextResponse } from "next/server";

// Detect if we're in a Cloudflare Workers environment
function isWorkersEnvironment(): boolean {
  return typeof (globalThis as unknown as Record<string, unknown>).caches !== "undefined";
}

// Inline config helper for Workers environment
function buildConfig(): Record<string, string> {
  const config: Record<string, string> = {};

  // Common configuration keys from environment
  const keys = [
    "SES_FROM_EMAIL",
    "SES_TO_EMAIL",
    "AWS_SES_REGION",
    "NEWSLETTER_SEND_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "SLACK_WEBHOOK_URL",
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "NOTION_API_KEY",
    "NOTION_BLOG_DB_ID",
    "GSC_SITE_URL",
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "ACTIVECAMPAIGN_API_URL",
    "ACTIVECAMPAIGN_API_TOKEN",
    "ESPOCRM_BASE_URL",
    "ESPOCRM_API_KEY",
    "POSTIZ_API_URL",
    "POSTIZ_API_KEY",
    "N8N_API_URL",
    "N8N_API_KEY",
    "GOOGLE_CLIENT_EMAIL",
    "GOOGLE_CALENDAR_ID",
    "GEMINI_API_KEY",
  ];

  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      config[key] = value;
    }
  }

  // Secrets that should only be accessed via Wrangler secrets (not exposed via API)
  const secretKeys = [
    "AUTH_SECRET",
    "CRON_SECRET",
    "GOOGLE_PRIVATE_KEY",
    "ESPOCRM_API_PASSWORD",
    "APPFLOWY_PASSWORD",
  ];

  for (const key of secretKeys) {
    const value = process.env[key];
    if (value) {
      config[key] = "***"; // Mask secrets in API response
    }
  }

  return config;
}

/**
 * GET /api/config
 *
 * Returns application configuration for ETL scripts and external integrations.
 * In Workers environment, reads from D1 app_config table if available.
 * In Node.js (K3s), reads from environment variables.
 *
 * Query parameters:
 *   - key: Return only the specified key (optional)
 *
 * Headers:
 *   - x-config-auth: Required token for external access (matches CONFIG_API_KEY)
 */
export async function GET(request: NextRequest) {
  const configAuth = request.headers.get("x-config-auth");

  // In production, require authentication for config access
  if (process.env.NODE_ENV === "production" || isWorkersEnvironment()) {
    const expectedAuth = process.env.CONFIG_API_KEY || process.env.ADMIN_ALERT_SECRET;
    if (!expectedAuth || configAuth !== expectedAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const key = searchParams.get("key");

  // Build config from environment
  const config = buildConfig();

  if (key) {
    return NextResponse.json({
      key,
      value: config[key] ?? null,
    });
  }

  return NextResponse.json({
    config,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
