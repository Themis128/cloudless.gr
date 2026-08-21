const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface AppConfig {
  SES_FROM_EMAIL: string;
  SES_TO_EMAIL: string;
  /** Shared secret authenticating the weekly newsletter send endpoint. */
  NEWSLETTER_SEND_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  // next-auth
  AUTH_SECRET: string;
  // Optional integrations
  SLACK_WEBHOOK_URL: string;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  NEWSLETTER_SLACK_BOT_TOKEN: string;
  NEWSLETTER_SLACK_SIGNING_SECRET: string;
  NEWSLETTER_SLACK_CHANNEL_ID: string;
  NOTION_API_KEY: string;
  NOTION_BLOG_DB_ID: string;
  NOTION_WEBHOOK_SECRET: string;
  // Notion database IDs
  NOTION_SUBMISSIONS_DB_ID: string;
  NOTION_DOCS_DB_ID: string;
  NOTION_PROJECTS_DB_ID: string;
  NOTION_TASKS_DB_ID: string;
  NOTION_ANALYTICS_DB_ID: string;
  NOTION_GSC_REPORTS_DB_ID: string;
  NOTION_CALENDAR_DB_ID: string;
  NOTION_REPORTS_DB_ID: string;
  NOTION_TESTIMONIALS_DB_ID: string;
  NOTION_CASE_STUDIES_DB_ID: string;
  NOTION_SERVICES_DB_ID: string;
  NOTION_FAQS_DB_ID: string;
  GOOGLE_CLIENT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  GOOGLE_CALENDAR_ID: string;
  /** GSC domain property, e.g. "sc-domain:cloudless.gr" */
  GSC_SITE_URL: string;
  // Sentry admin API access
  SENTRY_AUTH_TOKEN: string;
  SENTRY_ORG: string;
  SENTRY_PROJECT: string;
  // ActiveCampaign
  ACTIVECAMPAIGN_API_URL: string;
  ACTIVECAMPAIGN_API_TOKEN: string;
  // Google Ads
  GOOGLE_ADS_DEVELOPER_TOKEN: string;
  GOOGLE_ADS_CUSTOMER_ID: string;
  // LinkedIn
  LINKEDIN_CLIENT_ID: string;
  LINKEDIN_CLIENT_SECRET: string;
  LINKEDIN_ACCESS_TOKEN: string;
  LINKEDIN_AD_ACCOUNT_ID: string;
  LINKEDIN_ORGANIZATION_URN: string;
  // TikTok
  TIKTOK_APP_ID: string;
  TIKTOK_APP_SECRET: string;
  TIKTOK_ACCESS_TOKEN: string;
  TIKTOK_ADVERTISER_ID: string;
  // X (Twitter)
  X_API_KEY: string;
  X_API_SECRET: string;
  X_ACCESS_TOKEN: string;
  X_ACCESS_SECRET: string;
  X_AD_ACCOUNT_ID: string;
  // Meta
  META_AD_ACCOUNT_ID: string;
  META_PIXEL_ID: string;
  META_CAPI_ACCESS_TOKEN: string;
  META_ACCESS_TOKEN: string;
  META_PAGE_ID: string;
  // GitHub Actions
  GITHUB_TOKEN: string;
  // Cron auth
  CRON_SECRET: string;
  // AI
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_CHAT_MODEL: string;
  GEMINI_API_KEY: string;
  // Internal AI generate endpoint auth
  AI_GENERATE_SECRET: string;
  // GitHub Actions dispatch
  GITHUB_DISPATCH_TOKEN: string;
  // Admin alerts / webhooks
  ADMIN_ALERT_SECRET: string;
  CONTENT_WEBHOOK_SECRET: string;
  SENTRY_WEBHOOK_SECRET: string;
  SNS_PORTAL_TOPIC_ARN: string;
  // Monitoring / observability
  GRAFANA_BASE_URL: string;
  GRAFANA_API_TOKEN: string;
  PROMETHEUS_URL: string;
  KUMA_BASE_URL: string;
  KUMA_STATUS_PAGE_SLUG: string;
  KUMA_API_KEY: string;
  NTFY_BASE_URL: string;
  NTFY_TOPIC: string;
  NTFY_TOKEN: string;
  ADMIN_PUSH_VIA_NTFY: string;
  // MQTT broker
  MQTT_BROKER_HOST: string;
  MQTT_BROKER_PORT: string;
  MQTT_USERNAME: string;
  MQTT_PASSWORD: string;
  // EspoCRM (self-hosted on omv k3s) - supports both API key and Basic Auth
  ESPOCRM_BASE_URL: string;
  ESPOCRM_API_KEY: string;
  ESPOCRM_API_PASSWORD: string;
  ESPOCRM_API_USER: string;
  ESPOCRM_WEBHOOK_SECRET: string;
  // AppFlowy CMS
  APPFLOWY_API_URL: string;
  APPFLOWY_JWT_SECRET: string;
  APPFLOWY_EMAIL: string;
  APPFLOWY_PASSWORD: string;
  // Postiz social scheduler
  POSTIZ_API_URL: string;
  POSTIZ_API_KEY: string;
  POSTIZ_WEBHOOK_SECRET: string;
  POSTIZ_SLACK_CHANNEL: string;
  // ActiveCampaign
  ACTIVECAMPAIGN_LEAD_AUTOMATION_ID: string;
  // LinkedIn CAPI
  LINKEDIN_CAPI_ACCESS_TOKEN: string;
  // n8n
  N8N_API_URL: string;
  N8N_API_KEY: string;
  // n8n workflow IDs
  N8N_WORKFLOW_LEAD_ENRICH_ID: string;
  N8N_WORKFLOW_NEWSLETTER_NURTURE_ID: string;
}

// Import D1 configuration functions
import type { D1Database } from "@cloudflare/workers-types";
import { isWorkersEnvironment, getD1Config } from "./ssm-config-d1";

let cached: AppConfig | null = null;
let cachedAt = 0;

/** Clears the config cache — used in tests to pick up env changes. */
export function resetSsmCache(): void {
  cached = null;
  cachedAt = 0;
}

/**
 * Builds an AppConfig purely from process.env.
 */
function buildConfigFromEnv(): AppConfig {
  return {
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || "noreply@cloudless.gr",
    SES_TO_EMAIL: process.env.SES_TO_EMAIL || "tbaltzakis@cloudless.gr",
    NEWSLETTER_SEND_SECRET: process.env.NEWSLETTER_SEND_SECRET || "",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
    AUTH_SECRET: process.env.AUTH_SECRET || "",
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || "",
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || "",
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET || "",
    NEWSLETTER_SLACK_BOT_TOKEN: process.env.NEWSLETTER_SLACK_BOT_TOKEN || "",
    NEWSLETTER_SLACK_SIGNING_SECRET: process.env.NEWSLETTER_SLACK_SIGNING_SECRET || "",
    NEWSLETTER_SLACK_CHANNEL_ID: process.env.NEWSLETTER_SLACK_CHANNEL_ID || "",
    NOTION_API_KEY: process.env.NOTION_API_KEY || "",
    NOTION_BLOG_DB_ID: process.env.NOTION_BLOG_DB_ID || "",
    NOTION_WEBHOOK_SECRET: process.env.NOTION_WEBHOOK_SECRET || "",
    NOTION_SUBMISSIONS_DB_ID: process.env.NOTION_SUBMISSIONS_DB_ID || "",
    NOTION_DOCS_DB_ID: process.env.NOTION_DOCS_DB_ID || "",
    NOTION_PROJECTS_DB_ID: process.env.NOTION_PROJECTS_DB_ID || "",
    NOTION_TASKS_DB_ID: process.env.NOTION_TASKS_DB_ID || "",
    NOTION_ANALYTICS_DB_ID: process.env.NOTION_ANALYTICS_DB_ID || "",
    NOTION_GSC_REPORTS_DB_ID: process.env.NOTION_GSC_REPORTS_DB_ID || "",
    NOTION_CALENDAR_DB_ID: process.env.NOTION_CALENDAR_DB_ID || "",
    NOTION_REPORTS_DB_ID: process.env.NOTION_REPORTS_DB_ID || "",
    NOTION_TESTIMONIALS_DB_ID: process.env.NOTION_TESTIMONIALS_DB_ID || "",
    NOTION_CASE_STUDIES_DB_ID: process.env.NOTION_CASE_STUDIES_DB_ID || "",
    NOTION_SERVICES_DB_ID: process.env.NOTION_SERVICES_DB_ID || "",
    NOTION_FAQS_DB_ID: process.env.NOTION_FAQS_DB_ID || "",
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL || "",
    GOOGLE_PRIVATE_KEY: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || "",
    GSC_SITE_URL: process.env.GSC_SITE_URL || "sc-domain:cloudless.gr",
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN || "",
    SENTRY_ORG: process.env.SENTRY_ORG || "baltzakisthemiscom",
    SENTRY_PROJECT: process.env.SENTRY_PROJECT || "cloudless-gr",
    ACTIVECAMPAIGN_API_URL: process.env.ACTIVECAMPAIGN_API_URL || "",
    ACTIVECAMPAIGN_API_TOKEN: process.env.ACTIVECAMPAIGN_API_TOKEN || "",
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    GOOGLE_ADS_CUSTOMER_ID: process.env.GOOGLE_ADS_CUSTOMER_ID || "",
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || "",
    LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || "",
    LINKEDIN_ACCESS_TOKEN: process.env.LINKEDIN_ACCESS_TOKEN || "",
    LINKEDIN_AD_ACCOUNT_ID: process.env.LINKEDIN_AD_ACCOUNT_ID || "",
    LINKEDIN_ORGANIZATION_URN: process.env.LINKEDIN_ORGANIZATION_URN || "",
    TIKTOK_APP_ID: process.env.TIKTOK_APP_ID || "",
    TIKTOK_APP_SECRET: process.env.TIKTOK_APP_SECRET || "",
    TIKTOK_ACCESS_TOKEN: process.env.TIKTOK_ACCESS_TOKEN || "",
    TIKTOK_ADVERTISER_ID: process.env.TIKTOK_ADVERTISER_ID || "",
    X_API_KEY: process.env.X_API_KEY || "",
    X_API_SECRET: process.env.X_API_SECRET || "",
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN || "",
    X_ACCESS_SECRET: process.env.X_ACCESS_SECRET || "",
    X_AD_ACCOUNT_ID: process.env.X_AD_ACCOUNT_ID || "",
    META_AD_ACCOUNT_ID: process.env.META_AD_ACCOUNT_ID || "",
    META_PIXEL_ID: process.env.META_PIXEL_ID || "",
    META_CAPI_ACCESS_TOKEN: process.env.META_CAPI_ACCESS_TOKEN || "",
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || "",
    META_PAGE_ID: process.env.META_PAGE_ID || "",
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",
    CRON_SECRET: process.env.CRON_SECRET || "",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    ANTHROPIC_CHAT_MODEL: process.env.ANTHROPIC_CHAT_MODEL || "",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    AI_GENERATE_SECRET: process.env.AI_GENERATE_SECRET || "",
    GITHUB_DISPATCH_TOKEN: process.env.GITHUB_DISPATCH_TOKEN || "",
    ADMIN_ALERT_SECRET: process.env.ADMIN_ALERT_SECRET || "",
    CONTENT_WEBHOOK_SECRET: process.env.CONTENT_WEBHOOK_SECRET || "",
    SENTRY_WEBHOOK_SECRET: process.env.SENTRY_WEBHOOK_SECRET || "",
    SNS_PORTAL_TOPIC_ARN: process.env.SNS_PORTAL_TOPIC_ARN || "",
    GRAFANA_BASE_URL: process.env.GRAFANA_BASE_URL || "",
    GRAFANA_API_TOKEN: process.env.GRAFANA_API_TOKEN || "",
    PROMETHEUS_URL: process.env.PROMETHEUS_URL || "",
    KUMA_BASE_URL: process.env.KUMA_BASE_URL || "",
    KUMA_STATUS_PAGE_SLUG: process.env.KUMA_STATUS_PAGE_SLUG || "",
    KUMA_API_KEY: process.env.KUMA_API_KEY || "",
    NTFY_BASE_URL: process.env.NTFY_BASE_URL || "",
    NTFY_TOPIC: process.env.NTFY_TOPIC || "",
    NTFY_TOKEN: process.env.NTFY_TOKEN || "",
    ADMIN_PUSH_VIA_NTFY: process.env.ADMIN_PUSH_VIA_NTFY || "",
    MQTT_BROKER_HOST: process.env.MQTT_BROKER_HOST || "",
    MQTT_BROKER_PORT: process.env.MQTT_BROKER_PORT || "",
    MQTT_USERNAME: process.env.MQTT_USERNAME || "",
    MQTT_PASSWORD: process.env.MQTT_PASSWORD || "",
    ESPOCRM_BASE_URL: process.env.ESPOCRM_BASE_URL || "",
    ESPOCRM_API_KEY: process.env.ESPOCRM_API_KEY || "",
    ESPOCRM_API_PASSWORD: process.env.ESPOCRM_API_PASSWORD || "",
    ESPOCRM_API_USER: process.env.ESPOCRM_API_USER || "admin",
    ESPOCRM_WEBHOOK_SECRET: process.env.ESPOCRM_WEBHOOK_SECRET || "",
    APPFLOWY_API_URL: process.env.APPFLOWY_API_URL || "",
    APPFLOWY_JWT_SECRET: process.env.APPFLOWY_JWT_SECRET || "",
    APPFLOWY_EMAIL: process.env.APPFLOWY_EMAIL || "",
    APPFLOWY_PASSWORD: process.env.APPFLOWY_PASSWORD || "",
    POSTIZ_API_URL: process.env.POSTIZ_API_URL || "",
    POSTIZ_API_KEY: process.env.POSTIZ_API_KEY || "",
    POSTIZ_WEBHOOK_SECRET: process.env.POSTIZ_WEBHOOK_SECRET || "",
    POSTIZ_SLACK_CHANNEL: process.env.POSTIZ_SLACK_CHANNEL || "",
    ACTIVECAMPAIGN_LEAD_AUTOMATION_ID: process.env.ACTIVECAMPAIGN_LEAD_AUTOMATION_ID || "",
    LINKEDIN_CAPI_ACCESS_TOKEN: process.env.LINKEDIN_CAPI_ACCESS_TOKEN || "",
    N8N_API_URL: process.env.N8N_API_URL || "",
    N8N_API_KEY: process.env.N8N_API_KEY || "",
    N8N_WORKFLOW_LEAD_ENRICH_ID: process.env.N8N_WORKFLOW_LEAD_ENRICH_ID || "",
    N8N_WORKFLOW_NEWSLETTER_NURTURE_ID: process.env.N8N_WORKFLOW_NEWSLETTER_NURTURE_ID || "",
  };
}

/**
 * Merge D1 app_config with env-derived config.
 * Base = env defaults; D1 fills gaps; non-empty env/secrets win.
 * Empty env strings must NOT wipe D1 values (Wrangler secrets may be absent
 * while the same key still lives in app_config).
 */
function mergeD1AndEnv(d1Config: Record<string, string>, envConfig: AppConfig): AppConfig {
  const nonEmptyEnv = Object.fromEntries(
    Object.entries(envConfig).filter(([, value]) => Boolean(value))
  );
  return { ...envConfig, ...d1Config, ...nonEmptyEnv } as AppConfig;
}

/**
 * Fetches config from D1 app_config (when AUTH_DB is bound) then process.env.
 * AWS SSM has been removed — secrets come from D1, k8s envFrom, or local .env.
 */
export async function getConfig(): Promise<AppConfig> {
  try {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    const db = getAuthDbFromEnv();

    if (db) {
      const d1Config = await getD1Config(db as D1Database);
      const envConfig = buildConfigFromEnv();
      return mergeD1AndEnv(d1Config as Record<string, string>, envConfig);
    }
  } catch (err) {
    console.warn("[config] D1 lookup failed, continuing:", err);
  }

  if (isWorkersEnvironment()) {
    return buildConfigFromEnv();
  }

  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  cached = buildConfigFromEnv();
  cachedAt = Date.now();
  return cached;
}
