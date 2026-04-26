import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getConfig } from "@/lib/ssm-config";
import { verifyActiveCampaignToken } from "@/lib/activecampaign";

export type IntegrationStatus =
  | "configured"
  | "not_configured"
  | "degraded"
  | "error";

export type IntegrationReport = {
  id: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  message?: string;
  setupUrl?: string;
};

async function pingHubSpot(
  token: string,
): Promise<{ status: IntegrationStatus; message?: string }> {
  try {
    const res = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (res.status === 401 || res.status === 403)
      return { status: "degraded", message: `Token rejected (${res.status}).` };
    if (!res.ok)
      return { status: "error", message: `API returned ${res.status}` };
    return { status: "configured" };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

async function pingSlack(
  token: string,
): Promise<{ status: IntegrationStatus; message?: string }> {
  try {
    const res = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (!data.ok)
      return { status: "degraded", message: data.error ?? "auth.test failed." };
    return { status: "configured", message: `Workspace: ${data.team}` };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

async function pingNotion(
  token: string,
): Promise<{ status: IntegrationStatus; message?: string }> {
  try {
    const res = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401)
      return { status: "degraded", message: "Token rejected (401)." };
    if (!res.ok)
      return { status: "error", message: `API returned ${res.status}` };
    return { status: "configured" };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

async function pingStripe(
  secretKey: string,
): Promise<{ status: IntegrationStatus; message?: string }> {
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403)
      return { status: "degraded", message: "Secret key rejected." };
    if (!res.ok)
      return { status: "error", message: `API returned ${res.status}` };
    return { status: "configured" };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const cfg = await getConfig();
  const results: IntegrationReport[] = [];

  // ── AWS / SES ─────────────────────────────────────────────────────────────
  results.push({
    id: "ses",
    name: "AWS SES",
    category: "email",
    status:
      cfg.SES_FROM_EMAIL && cfg.AWS_SES_REGION
        ? "configured"
        : "not_configured",
  });

  // ── Cognito ───────────────────────────────────────────────────────────────
  results.push({
    id: "cognito",
    name: "AWS Cognito",
    category: "auth",
    status:
      cfg.COGNITO_USER_POOL_ID && cfg.COGNITO_CLIENT_ID
        ? "configured"
        : "not_configured",
    setupUrl: "https://console.aws.amazon.com/cognito",
  });

  // ── Stripe ────────────────────────────────────────────────────────────────
  if (!cfg.STRIPE_SECRET_KEY) {
    results.push({
      id: "stripe",
      name: "Stripe",
      category: "payments",
      status: "not_configured",
      setupUrl: "https://dashboard.stripe.com/apikeys",
    });
  } else {
    const ping = await pingStripe(cfg.STRIPE_SECRET_KEY);
    results.push({
      id: "stripe",
      name: "Stripe",
      category: "payments",
      ...ping,
    });
  }

  // ── HubSpot ───────────────────────────────────────────────────────────────
  if (!cfg.HUBSPOT_API_KEY) {
    results.push({
      id: "hubspot",
      name: "HubSpot CRM",
      category: "crm",
      status: "not_configured",
      setupUrl: "https://app.hubspot.com/private-apps",
    });
  } else {
    const ping = await pingHubSpot(cfg.HUBSPOT_API_KEY);
    results.push({
      id: "hubspot",
      name: "HubSpot CRM",
      category: "crm",
      ...ping,
    });
  }

  // ── Slack ─────────────────────────────────────────────────────────────────
  if (!cfg.SLACK_BOT_TOKEN) {
    results.push({
      id: "slack",
      name: "Slack",
      category: "communication",
      status: "not_configured",
      setupUrl: "https://api.slack.com/apps",
    });
  } else {
    const ping = await pingSlack(cfg.SLACK_BOT_TOKEN);
    results.push({
      id: "slack",
      name: "Slack",
      category: "communication",
      ...ping,
    });
  }

  // ── Notion ────────────────────────────────────────────────────────────────
  if (!cfg.NOTION_API_KEY) {
    results.push({
      id: "notion",
      name: "Notion",
      category: "content",
      status: "not_configured",
      setupUrl: "https://www.notion.so/my-integrations",
    });
  } else {
    const ping = await pingNotion(cfg.NOTION_API_KEY);
    results.push({
      id: "notion",
      name: "Notion",
      category: "content",
      ...ping,
    });
  }

  // ── Google Calendar + GSC ─────────────────────────────────────────────────
  results.push({
    id: "google",
    name: "Google (Calendar + Search Console)",
    category: "productivity",
    status:
      cfg.GOOGLE_CLIENT_EMAIL &&
      cfg.GOOGLE_PRIVATE_KEY &&
      cfg.GOOGLE_CALENDAR_ID
        ? "configured"
        : "not_configured",
    setupUrl: "https://console.cloud.google.com/iam-admin/serviceaccounts",
  });

  // ── Sentry ────────────────────────────────────────────────────────────────
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  results.push({
    id: "sentry",
    name: "Sentry",
    category: "monitoring",
    status: sentryDsn
      ? cfg.SENTRY_AUTH_TOKEN
        ? "configured"
        : "degraded"
      : "not_configured",
    message:
      sentryDsn && !cfg.SENTRY_AUTH_TOKEN
        ? "DSN configured (frontend capture active) but SENTRY_AUTH_TOKEN missing — source map uploads disabled."
        : undefined,
    setupUrl: "https://sentry.io/settings/auth-tokens/",
  });

  // ── Anthropic ─────────────────────────────────────────────────────────────
  results.push({
    id: "anthropic",
    name: "Anthropic (Claude AI)",
    category: "ai",
    status: cfg.ANTHROPIC_API_KEY ? "configured" : "not_configured",
    message: !cfg.ANTHROPIC_API_KEY
      ? "Add ANTHROPIC_API_KEY to SSM or .env.local to enable AI features (report insights, ad copy, audience analysis)."
      : undefined,
    setupUrl: "https://console.anthropic.com/settings/keys",
  });

  // ── ActiveCampaign ────────────────────────────────────────────────────────
  {
    const ac = await verifyActiveCampaignToken();
    const statusMap: Record<string, IntegrationStatus> = {
      valid: "configured",
      rejected: "degraded",
      not_configured: "not_configured",
      error: "error",
    };
    results.push({
      id: "activecampaign",
      name: "ActiveCampaign",
      category: "email_marketing",
      status: statusMap[ac.status] ?? "error",
      message:
        ac.status === "not_configured" &&
        cfg.ACTIVECAMPAIGN_API_URL &&
        !cfg.ACTIVECAMPAIGN_API_TOKEN
          ? "URL configured but API token missing. Renew account then get token from Settings > Developer > API Access."
          : ac.message,
      setupUrl: "https://www.activecampaign.com",
    });
  }

  // ── Meta ──────────────────────────────────────────────────────────────────
  const metaConfigured = Boolean(
    cfg.META_AD_ACCOUNT_ID && cfg.META_ACCESS_TOKEN && cfg.META_PIXEL_ID,
  );
  results.push({
    id: "meta",
    name: "Meta (Facebook/Instagram)",
    category: "social_ads",
    status: metaConfigured ? "configured" : "not_configured",
    message: metaConfigured
      ? "Instagram Business Account ID blocked — Meta ad policy violation on account 1558125105019725. Appeal required."
      : undefined,
    setupUrl: "https://business.facebook.com/settings/system-users",
  });

  // ── LinkedIn Ads ──────────────────────────────────────────────────────────
  const linkedInConfigured = Boolean(
    cfg.LINKEDIN_ACCESS_TOKEN &&
    cfg.LINKEDIN_AD_ACCOUNT_ID &&
    cfg.LINKEDIN_ORGANIZATION_URN,
  );
  results.push({
    id: "linkedin",
    name: "LinkedIn Ads",
    category: "social_ads",
    status: linkedInConfigured ? "configured" : "not_configured",
    setupUrl: "https://www.linkedin.com/campaignmanager",
  });

  // ── TikTok Ads ────────────────────────────────────────────────────────────
  const tiktokAppReady = Boolean(cfg.TIKTOK_APP_ID && cfg.TIKTOK_APP_SECRET);
  const tiktokFullyConfigured = Boolean(
    tiktokAppReady && cfg.TIKTOK_ACCESS_TOKEN && cfg.TIKTOK_ADVERTISER_ID,
  );
  results.push({
    id: "tiktok",
    name: "TikTok Ads",
    category: "social_ads",
    status: tiktokFullyConfigured
      ? "configured"
      : tiktokAppReady
        ? "degraded"
        : "not_configured",
    message:
      tiktokAppReady && !tiktokFullyConfigured
        ? "App credentials set. Complete OAuth to get access token and advertiser ID."
        : undefined,
    setupUrl: tiktokAppReady
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/oauth/tiktok`
      : "https://ads.tiktok.com/marketing_api/apps",
  });

  // ── X (Twitter) Ads ───────────────────────────────────────────────────────
  const xTokensReady = Boolean(
    cfg.X_API_KEY &&
    cfg.X_ACCESS_TOKEN &&
    cfg.X_API_SECRET &&
    cfg.X_ACCESS_SECRET,
  );
  const xFullyConfigured = Boolean(xTokensReady && cfg.X_AD_ACCOUNT_ID);
  results.push({
    id: "x",
    name: "X (Twitter) Ads",
    category: "social_ads",
    status: xFullyConfigured
      ? "configured"
      : xTokensReady
        ? "degraded"
        : "not_configured",
    message:
      xTokensReady && !xFullyConfigured
        ? "OAuth tokens set. X_AD_ACCOUNT_ID missing — X Ads API access pending approval. Apply at ads.x.com/help."
        : undefined,
    setupUrl: "https://ads.x.com/help",
  });

  // ── Google Ads ────────────────────────────────────────────────────────────
  const googleAdsConfigured = Boolean(
    cfg.GOOGLE_ADS_DEVELOPER_TOKEN && cfg.GOOGLE_ADS_CUSTOMER_ID,
  );
  results.push({
    id: "google_ads",
    name: "Google Ads",
    category: "social_ads",
    status: googleAdsConfigured ? "configured" : "not_configured",
    message: !googleAdsConfigured
      ? "Needs GOOGLE_ADS_DEVELOPER_TOKEN (apply at ads.google.com/intl/en_us/home/tools/api-center/) and GOOGLE_ADS_CUSTOMER_ID. Google service account auth is already configured."
      : undefined,
    setupUrl: "https://ads.google.com/intl/en_us/home/tools/api-center/",
  });

  const summary = {
    total: results.length,
    configured: results.filter((r) => r.status === "configured").length,
    degraded: results.filter((r) => r.status === "degraded").length,
    not_configured: results.filter((r) => r.status === "not_configured").length,
    error: results.filter((r) => r.status === "error").length,
  };

  return NextResponse.json({
    summary,
    integrations: results,
    checkedAt: new Date().toISOString(),
  });
}
