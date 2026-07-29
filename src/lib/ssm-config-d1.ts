/**
 * D1-based configuration store for Workers environment.
 *
 * When running in Cloudflare Workers (detected by presence of caches global),
 * this module reads configuration from the D1 app_config table instead of
 * AWS SSM. Falls back to process.env in development.
 */

// Detect if we're in a Cloudflare Workers environment
export function isWorkersEnvironment(): boolean {
  return typeof (globalThis as unknown as Record<string, unknown>).caches !== "undefined";
}

/**
 * Fetch all configuration keys from D1 app_config table.
 * Used by ETL scripts and Workers to get runtime configuration.
 */
export async function getD1Config<T extends Record<string, string> = Record<string, string>>(
  db: D1Database
): Promise<T> {
  const config: Record<string, string> = {};

  const results = await db
    .prepare("SELECT key, value FROM app_config WHERE value IS NOT NULL")
    .all<{ key: string; value: string }>();

  for (const row of results.results) {
    if (row.key && row.value) {
      config[row.key] = row.value;
    }
  }

  return config as T;
}

/**
 * Get a single configuration value from D1.
 */
export async function getD1ConfigValue(db: D1Database, key: string): Promise<string | undefined> {
  const result = await db
    .prepare("SELECT value FROM app_config WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();

  return result?.value;
}

/**
 * Set a configuration value in D1 (for admin endpoints).
 */
export async function setD1ConfigValue(
  db: D1Database,
  key: string,
  value: string,
  description?: string
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO app_config (key, value, description, updated_at)
     VALUES (?, ?, ?, strftime('%s', 'now'))`
    )
    .bind(key, value, description ?? "")
    .run();
}

/**
 * Type definition for application configuration.
 */
interface AppConfig {
  SES_FROM_EMAIL: string;
  SES_TO_EMAIL: string;
  AWS_SES_REGION: string;
  NEWSLETTER_SEND_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  AUTH_SECRET: string;
  SLACK_WEBHOOK_URL: string;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  HUBSPOT_API_KEY: string;
  HUBSPOT_CLIENT_SECRET: string;
  NOTION_API_KEY: string;
  NOTION_BLOG_DB_ID: string;
  NOTION_WEBHOOK_SECRET: string;
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
  GEMINI_API_KEY: string;
  GOOGLE_PRIVATE_KEY: string;
  GOOGLE_CALENDAR_ID: string;
  GSC_SITE_URL: string;
  SENTRY_AUTH_TOKEN: string;
  SENTRY_ORG: string;
  SENTRY_PROJECT: string;
  ACTIVECAMPAIGN_API_URL: string;
  ACTIVECAMPAIGN_API_TOKEN: string;
  GOOGLE_ADS_DEVELOPER_TOKEN: string;
  GOOGLE_ADS_CUSTOMER_ID: string;
  LINKEDIN_CLIENT_ID: string;
  LINKEDIN_CLIENT_SECRET: string;
  LINKEDIN_ACCESS_TOKEN: string;
  LINKEDIN_AD_ACCOUNT_ID: string;
  LINKEDIN_ORGANIZATION_URN: string;
  TIKTOK_APP_ID: string;
  TIKTOK_APP_SECRET: string;
  TIKTOK_ACCESS_TOKEN: string;
  TIKTOK_ADVERTISER_ID: string;
  X_API_KEY: string;
  X_API_SECRET: string;
  X_ACCESS_TOKEN: string;
  X_ACCESS_SECRET: string;
  X_AD_ACCOUNT_ID: string;
  META_AD_ACCOUNT_ID: string;
  META_PIXEL_ID: string;
  META_CAPI_ACCESS_TOKEN: string;
  META_ACCESS_TOKEN: string;
  META_PAGE_ID: string;
  GITHUB_TOKEN: string;
  CRON_SECRET: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_CHAT_MODEL: string;
  AI_GENERATE_SECRET: string;
  GITHUB_DISPATCH_TOKEN: string;
  ADMIN_ALERT_SECRET: string;
  CONTENT_WEBHOOK_SECRET: string;
  SENTRY_WEBHOOK_SECRET: string;
  SNS_PORTAL_TOPIC_ARN: string;
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
  MQTT_BROKER_HOST: string;
  MQTT_BROKER_PORT: string;
  MQTT_USERNAME: string;
  MQTT_PASSWORD: string;
  ESPOCRM_BASE_URL: string;
  ESPOCRM_API_KEY: string;
  ESPOCRM_API_PASSWORD: string;
  ESPOCRM_API_USER: string;
  ESPOCRM_WEBHOOK_SECRET: string;
  APPFLOWY_API_URL: string;
  APPFLOWY_JWT_SECRET: string;
  APPFLOWY_EMAIL: string;
  APPFLOWY_PASSWORD: string;
  POSTIZ_API_URL: string;
  POSTIZ_API_KEY: string;
  POSTIZ_WEBHOOK_SECRET: string;
  POSTIZ_SLACK_CHANNEL: string;
  ACTIVECAMPAIGN_LEAD_AUTOMATION_ID: string;
  LINKEDIN_CAPI_ACCESS_TOKEN: string;
  N8N_API_URL: string;
  N8N_API_KEY: string;
  N8N_WORKFLOW_LEAD_ENRICH_ID: string;
  N8N_WORKFLOW_NEWSLETTER_NURTURE_ID: string;
}

/**
 * Build configuration object from environment variables (development fallback).
 * This mirrors the buildConfigFromEnv from ssm-config.ts.
 */
function buildConfigFromEnv(): AppConfig {
  return {
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || "noreply@cloudless.gr",
    SES_TO_EMAIL: process.env.SES_TO_EMAIL || "tbaltzakis@cloudless.gr",
    AWS_SES_REGION: process.env.AWS_SES_REGION || "us-east-1",
    NEWSLETTER_SEND_SECRET: process.env.NEWSLETTER_SEND_SECRET || "",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || "",
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || "",
    AUTH_SECRET: process.env.AUTH_SECRET || "",
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || "",
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || "",
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET || "",
    HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_PRIVATE_APP_TOKEN || "",
    HUBSPOT_CLIENT_SECRET: process.env.HUBSPOT_CLIENT_SECRET || "",
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
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
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
 * Get configuration - Workers uses D1, Node.js uses SSM.
 * This is a unified interface that works in both environments.
 */
export async function getConfig<T extends Record<string, string> = Record<string, string>>(
  db?: D1Database
): Promise<T> {
  // In Workers environment with D1 binding
  if (isWorkersEnvironment() && db) {
    const d1Config = await getD1Config(db);
    // Merge with environment variables (secrets take precedence)
    const envConfig = buildConfigFromEnv();
    return { ...d1Config, ...envConfig } as unknown as T;
  }

  // In development or when no D1 binding, use environment
  return buildConfigFromEnv() as unknown as T;
}
