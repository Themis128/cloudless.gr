import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getConfig, type AppConfig } from "@/lib/ssm-config";
import { verifyActiveCampaignToken } from "@/lib/activecampaign";

export type IntegrationStatus = "configured" | "not_configured" | "degraded" | "error";

export type IntegrationReport = {
  id: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  message?: string;
  setupUrl?: string;
};

type PingResult = { status: IntegrationStatus; message?: string };
type Cfg = AppConfig;

async function pingEspoCRM(baseUrl: string, apiKey: string): Promise<PingResult> {
  try {
    const url = baseUrl.replace(/\/$/, "") + "/api/v1/App/user";
    const res = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403)
      return { status: "degraded", message: `API key rejected (${res.status}).` };
    if (!res.ok) return { status: "error", message: `API returned ${res.status}` };
    return { status: "configured" };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

async function pingSlack(token: string): Promise<PingResult> {
  try {
    const res = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { ok: boolean; error?: string; team?: string };
    if (!data.ok) return { status: "degraded", message: data.error ?? "auth.test failed." };
    return { status: "configured", message: `Workspace: ${data.team}` };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

async function pingNotion(token: string): Promise<PingResult> {
  try {
    const res = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401) return { status: "degraded", message: "Token rejected (401)." };
    if (!res.ok) return { status: "error", message: `API returned ${res.status}` };
    return { status: "configured" };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

async function pingPostiz(baseUrl: string, apiKey: string): Promise<PingResult> {
  try {
    // Use `/integrations` (universally exposed) rather than `/groups`, which
    // is only present in newer Postiz versions. /integrations being reachable
    // and authorised is the right proof that the public API + token are good.
    const url = `${baseUrl.replace(/\/$/, "")}/api/public/v1/integrations`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403)
      return { status: "degraded", message: `API key rejected (${res.status}).` };
    if (res.status >= 500)
      return {
        status: "error",
        message: `Upstream Postiz returned ${res.status} — pod/container may be down. Check the Postiz deployment.`,
      };
    if (!res.ok) return { status: "degraded", message: `API returned ${res.status}` };

    // Bonus: probe the multi-tenant /groups endpoint and note if it's missing,
    // so the operator knows their Postiz version pre-dates groups (the
    // workspaces page free-text picker is the right fallback, not a bug).
    const groupsRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/public/v1/groups`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
    if (groupsRes && groupsRes.status === 404) {
      return {
        status: "configured",
        message:
          "Reachable. Note: this Postiz version doesn't expose `/groups`; the workspaces picker uses free-text input.",
      };
    }
    return { status: "configured" };
  } catch {
    return {
      status: "error",
      message: "Connection failed — Postiz host unreachable from the app (DNS/network/pod down).",
    };
  }
}

async function pingStripe(secretKey: string): Promise<PingResult> {
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403)
      return { status: "degraded", message: "Secret key rejected." };
    if (!res.ok) return { status: "error", message: `API returned ${res.status}` };
    return { status: "configured" };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

type TikTokConfig = {
  TIKTOK_APP_ID: string;
  TIKTOK_APP_SECRET: string;
  TIKTOK_ACCESS_TOKEN: string;
  TIKTOK_ADVERTISER_ID: string;
};

const NOT_CONFIGURED: PingResult = { status: "not_configured" };

function sentryStatus(cfg: Cfg): IntegrationStatus {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return "not_configured";
  if (cfg.SENTRY_AUTH_TOKEN) return "configured";
  return "degraded";
}

function sentryReport(cfg: Cfg): IntegrationReport {
  const dsnOnly = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN && !cfg.SENTRY_AUTH_TOKEN);
  return {
    id: "sentry",
    name: "Sentry",
    category: "monitoring",
    status: sentryStatus(cfg),
    message: dsnOnly
      ? "DSN configured (frontend capture active) but SENTRY_AUTH_TOKEN missing — source map uploads disabled."
      : undefined,
    setupUrl: "https://sentry.io/settings/auth-tokens/",
  };
}

function tiktokStatus(cfg: TikTokConfig): IntegrationStatus {
  const appReady = Boolean(cfg.TIKTOK_APP_ID && cfg.TIKTOK_APP_SECRET);
  const fullyConfigured = Boolean(appReady && cfg.TIKTOK_ACCESS_TOKEN && cfg.TIKTOK_ADVERTISER_ID);
  if (fullyConfigured) return "configured";
  if (appReady) return "degraded";
  return "not_configured";
}

function tiktokReport(cfg: Cfg): IntegrationReport {
  const appReady = Boolean(cfg.TIKTOK_APP_ID && cfg.TIKTOK_APP_SECRET);
  const fullyConfigured = Boolean(appReady && cfg.TIKTOK_ACCESS_TOKEN && cfg.TIKTOK_ADVERTISER_ID);
  const tiktokSetupUrl = appReady
    ? "/api/admin/oauth/tiktok"
    : "https://ads.tiktok.com/marketing_api/apps";
  return {
    id: "tiktok",
    name: "TikTok Ads",
    category: "social_ads",
    status: tiktokStatus({ ...cfg } as TikTokConfig),
    message:
      appReady && !fullyConfigured
        ? "App credentials set. Complete OAuth to get access token and advertiser ID."
        : undefined,
    setupUrl: tiktokSetupUrl,
  };
}

function xAdsStatus(tokensReady: boolean, fullyConfigured: boolean): IntegrationStatus {
  if (fullyConfigured) return "configured";
  if (tokensReady) return "degraded";
  return "not_configured";
}

function xAdsReport(cfg: Cfg): IntegrationReport {
  const tokensReady = Boolean(
    cfg.X_API_KEY && cfg.X_ACCESS_TOKEN && cfg.X_API_SECRET && cfg.X_ACCESS_SECRET
  );
  const fullyConfigured = Boolean(tokensReady && cfg.X_AD_ACCOUNT_ID);
  return {
    id: "x",
    name: "X (Twitter) Ads",
    category: "social_ads",
    status: xAdsStatus(tokensReady, fullyConfigured),
    message:
      tokensReady && !fullyConfigured
        ? "OAuth tokens set. X_AD_ACCOUNT_ID missing — X Ads API access pending approval. Apply at ads.x.com/help."
        : undefined,
    setupUrl: "https://ads.x.com/help",
  };
}

function configuredIf(condition: unknown): IntegrationStatus {
  return condition ? "configured" : "not_configured";
}

function buildCoreReports(cfg: Cfg): IntegrationReport[] {
  return [
    {
      id: "cloudflare-email",
      name: "Cloudflare Email",
      category: "email",
      status: "configured", // Cloudflare Email is always available via EMAIL binding
    },
    {
      id: "google",
      name: "Google (Calendar + Search Console)",
      category: "productivity",
      status: configuredIf(
        cfg.GOOGLE_CLIENT_EMAIL && cfg.GOOGLE_PRIVATE_KEY && cfg.GOOGLE_CALENDAR_ID
      ),
      setupUrl: "https://console.cloud.google.com/iam-admin/serviceaccounts",
    },
    sentryReport(cfg),
    {
      id: "workers-ai",
      name: "Cloudflare Workers AI",
      category: "ai",
      status: configuredIf(
        Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN)
      ),
      message:
        process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN
          ? undefined
          : "Set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (Workers AI Read+Run) for Marketing Hub AI.",
      setupUrl: "https://dash.cloudflare.com/?to=/:account/ai",
    },
    {
      id: "gemini",
      name: "Google Gemini (AI fallback)",
      category: "ai",
      status: configuredIf(Boolean(cfg.GEMINI_API_KEY || process.env.GEMINI_API_KEY)),
      message:
        cfg.GEMINI_API_KEY || process.env.GEMINI_API_KEY
          ? undefined
          : "Optional fallback when Workers AI is unavailable. Set GEMINI_API_KEY.",
      setupUrl: "https://aistudio.google.com/apikey",
    },
    {
      id: "turnstile",
      name: "Cloudflare Turnstile",
      category: "ai",
      status: configuredIf(
        Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
      ),
      message:
        process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          ? undefined
          : "Set NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY to bot-filter contact/signup/newsletter.",
      setupUrl: "https://dash.cloudflare.com/?to=/:account/turnstile",
    },
    {
      id: "ai-gateway",
      name: "Cloudflare AI Gateway",
      category: "ai",
      status: configuredIf(Boolean(process.env.CLOUDFLARE_AI_GATEWAY_ID)),
      message: process.env.CLOUDFLARE_AI_GATEWAY_ID
        ? "Workers AI calls route through AI Gateway (cache + logs)."
        : "Optional: set CLOUDFLARE_AI_GATEWAY_ID to front Workers AI with caching/rate limits.",
      setupUrl: "https://dash.cloudflare.com/?to=/:account/ai/ai-gateway",
    },
    {
      id: "vectorize",
      name: "Cloudflare Vectorize (admin RAG)",
      category: "ai",
      status: configuredIf(
        Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN)
      ),
      message:
        "Index AppFlowy FAQs/docs via POST /api/admin/ai/rag/sync (CLOUDFLARE_VECTORIZE_INDEX).",
      setupUrl: "https://dash.cloudflare.com/?to=/:account/vectorize",
    },
    {
      id: "espocrm-queue",
      name: "EspoCRM Queues fan-out",
      category: "ai",
      status: configuredIf(
        Boolean(process.env.ESPOCRM_QUEUE_PRODUCER_URL && process.env.ESPOCRM_QUEUE_PRODUCER_SECRET)
      ),
      message:
        process.env.ESPOCRM_QUEUE_PRODUCER_URL && process.env.ESPOCRM_QUEUE_PRODUCER_SECRET
          ? "Webhooks enqueue to workers/espocrm-fanout."
          : "Optional: set ESPOCRM_QUEUE_PRODUCER_URL + SECRET (see workers/espocrm-fanout).",
      setupUrl: "https://dash.cloudflare.com/?to=/:account/workers/queues",
    },
  ];
}

function buildSocialAdsReports(cfg: Cfg): IntegrationReport[] {
  const linkedInConfigured = Boolean(
    cfg.LINKEDIN_ACCESS_TOKEN && cfg.LINKEDIN_AD_ACCOUNT_ID && cfg.LINKEDIN_ORGANIZATION_URN
  );
  const googleAdsConfigured = Boolean(cfg.GOOGLE_ADS_DEVELOPER_TOKEN && cfg.GOOGLE_ADS_CUSTOMER_ID);
  const googleAdsMessage = googleAdsConfigured
    ? undefined
    : "Needs GOOGLE_ADS_DEVELOPER_TOKEN (apply at ads.google.com/intl/en_us/home/tools/api-center/) and GOOGLE_ADS_CUSTOMER_ID. Google service account auth is already configured.";

  return [
    {
      id: "linkedin",
      name: "LinkedIn Ads",
      category: "social_ads",
      status: configuredIf(linkedInConfigured),
      setupUrl: "https://www.linkedin.com/campaignmanager",
    },
    tiktokReport(cfg),
    xAdsReport(cfg),
    {
      id: "google_ads",
      name: "Google Ads",
      category: "social_ads",
      status: configuredIf(googleAdsConfigured),
      message: googleAdsMessage,
      setupUrl: "https://ads.google.com/intl/en_us/home/tools/api-center/",
    },
  ];
}

/** Meta Marketing API account_status: 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, … */
async function pingMeta(accessToken: string, adAccountId: string): Promise<PingResult> {
  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${adAccountId}`);
    url.searchParams.set("fields", "id,name,account_status,disable_reason");
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.status === 401 || res.status === 403)
      return { status: "degraded", message: "Access token rejected by Graph API." };
    if (!res.ok) return { status: "error", message: `Graph API returned ${res.status}` };
    const data = (await res.json()) as {
      account_status?: number;
      disable_reason?: number;
      name?: string;
    };
    if (data.account_status === 1) {
      return {
        status: "configured",
        message: data.name ? `Ad account: ${data.name}` : undefined,
      };
    }
    if (data.account_status === 2) {
      return {
        status: "degraded",
        message:
          "Ad account DISABLED (policy/payment). Appeal in Meta Business Manager before running ads.",
      };
    }
    return {
      status: "degraded",
      message: `Ad account not active (account_status=${data.account_status ?? "unknown"}).`,
    };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

function buildStaticReports(cfg: Cfg): IntegrationReport[] {
  return [...buildCoreReports(cfg), ...buildSocialAdsReports(cfg)];
}

async function pingAppFlowy(baseUrl: string): Promise<PingResult> {
  // /api/health is public — proves the AppFlowy Cloud pod + nginx + tunnel are all up.
  try {
    const res = await fetch(baseUrl.replace(/\/$/, "") + "/api/health", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { status: "error", message: `health returned ${res.status}` };
    return { status: "configured", message: "AppFlowy Cloud healthy." };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

async function pingN8n(baseUrl: string, apiKey: string): Promise<PingResult> {
  // GET /api/v1/workflows?limit=1 — cheapest authenticated call. 401 = bad key.
  try {
    const res = await fetch(baseUrl.replace(/\/$/, "") + "/api/v1/workflows?limit=1", {
      headers: { "X-N8N-API-KEY": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401)
      return { status: "degraded", message: "API key rejected (regenerate in Settings → API)." };
    if (!res.ok) return { status: "error", message: `API returned ${res.status}` };
    return { status: "configured" };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

async function buildPingedReports(cfg: Cfg): Promise<IntegrationReport[]> {
  const metaReady = Boolean(cfg.META_AD_ACCOUNT_ID && cfg.META_ACCESS_TOKEN && cfg.META_PIXEL_ID);
  const [
    stripeResult,
    espocrmResult,
    slackResult,
    notionResult,
    acResult,
    acLead,
    postizResult,
    appflowyResult,
    n8nResult,
    metaResult,
  ] = await Promise.all([
    cfg.STRIPE_SECRET_KEY ? pingStripe(cfg.STRIPE_SECRET_KEY) : Promise.resolve(NOT_CONFIGURED),
    cfg.ESPOCRM_BASE_URL && cfg.ESPOCRM_API_KEY
      ? pingEspoCRM(cfg.ESPOCRM_BASE_URL, cfg.ESPOCRM_API_KEY)
      : Promise.resolve(NOT_CONFIGURED),
    cfg.SLACK_BOT_TOKEN ? pingSlack(cfg.SLACK_BOT_TOKEN) : Promise.resolve(NOT_CONFIGURED),
    cfg.NOTION_API_KEY ? pingNotion(cfg.NOTION_API_KEY) : Promise.resolve(NOT_CONFIGURED),
    verifyActiveCampaignToken(),
    getLeadAutomationStatus(),
    cfg.POSTIZ_API_URL && cfg.POSTIZ_API_KEY
      ? pingPostiz(cfg.POSTIZ_API_URL, cfg.POSTIZ_API_KEY)
      : Promise.resolve(NOT_CONFIGURED),
    cfg.APPFLOWY_API_URL ? pingAppFlowy(cfg.APPFLOWY_API_URL) : Promise.resolve(NOT_CONFIGURED),
    cfg.N8N_API_URL && cfg.N8N_API_KEY
      ? pingN8n(cfg.N8N_API_URL, cfg.N8N_API_KEY)
      : Promise.resolve(NOT_CONFIGURED),
    metaReady
      ? pingMeta(cfg.META_ACCESS_TOKEN, cfg.META_AD_ACCOUNT_ID)
      : Promise.resolve(NOT_CONFIGURED),
  ]);

  const acStatusMap: Record<string, IntegrationStatus> = {
    valid: "configured",
    rejected: "degraded",
    not_configured: "not_configured",
    error: "error",
  };
  const acMissingToken =
    acResult.status === "not_configured" &&
    cfg.ACTIVECAMPAIGN_API_URL &&
    !cfg.ACTIVECAMPAIGN_API_TOKEN;
  let acMessage = acMissingToken
    ? "URL configured but API token missing. Renew account then get token from Settings > Developer > API Access."
    : acResult.message;
  if (acResult.status === "valid" && !acLead.leadAutomationIdSet) {
    acMessage =
      "API OK, but ACTIVECAMPAIGN_LEAD_AUTOMATION_ID is unset — contact form enrollments are a no-op.";
  } else if (acResult.status === "valid" && acLead.leadAutomationIdSet) {
    acMessage = `${acResult.message} Lead automation ID is set.`;
  }

  return [
    {
      id: "stripe",
      name: "Stripe",
      category: "payments",
      ...stripeResult,
      setupUrl: "https://dashboard.stripe.com/apikeys",
    },
    {
      id: "espocrm",
      name: "EspoCRM",
      category: "crm",
      ...espocrmResult,
      setupUrl: "https://espocrm.cloudless.gr/#User/list",
    },
    {
      id: "slack",
      name: "Slack",
      category: "communication",
      ...slackResult,
      setupUrl: "https://api.slack.com/apps",
    },
    {
      id: "notion",
      name: "Notion",
      category: "content",
      ...notionResult,
      setupUrl: "https://www.notion.so/my-integrations",
    },
    {
      id: "activecampaign",
      name: "ActiveCampaign",
      category: "email_marketing",
      status:
        acResult.status === "valid" && !acLead.leadAutomationIdSet
          ? "degraded"
          : (acStatusMap[acResult.status] ?? "error"),
      message: acMessage,
      setupUrl: "https://www.activecampaign.com",
    },
    {
      id: "postiz",
      name: "Postiz (social publishing)",
      category: "social_ads",
      ...postizResult,
      setupUrl: cfg.POSTIZ_API_URL || "https://postiz.cloudless.gr",
    },
    {
      id: "appflowy",
      name: "AppFlowy Cloud (Notion replacement)",
      category: "content",
      ...appflowyResult,
      setupUrl: cfg.APPFLOWY_API_URL || "https://appflowy.cloudless.gr",
    },
    {
      id: "n8n",
      name: "n8n (workflow automation)",
      category: "automation",
      ...n8nResult,
      setupUrl: cfg.N8N_API_URL || "https://n8n.cloudless.gr",
    },
    {
      id: "meta",
      name: "Meta (Facebook/Instagram)",
      category: "social_ads",
      ...metaResult,
      setupUrl: "https://business.facebook.com/settings/ad_accounts",
    },
  ];
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const cfg = await getConfig();

  const [staticReports, pingedReports] = await Promise.all([
    Promise.resolve(buildStaticReports(cfg)),
    buildPingedReports(cfg),
  ]);

  const results: IntegrationReport[] = [...pingedReports, ...staticReports];

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
