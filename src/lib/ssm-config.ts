// || (not ??) so that SSM_PREFIX="" falls back to the default instead of fetching from "/"
const SSM_PREFIX = process.env.SSM_PREFIX || "/cloudless/production";
const DEFAULT_REGION = "us-east-1";
const REGION = process.env.AWS_REGION || DEFAULT_REGION;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level singleton — avoids re-creating the connection pool on every cache miss
let ssmClient: import("@aws-sdk/client-ssm").SSMClient | null = null;
async function getSsmClient(): Promise<import("@aws-sdk/client-ssm").SSMClient> {
  if (!ssmClient) {
    const { SSMClient } = await import("@aws-sdk/client-ssm");
    ssmClient = new SSMClient({ region: REGION });
  }
  return ssmClient;
}

export interface AppConfig {
  SES_FROM_EMAIL: string;
  SES_TO_EMAIL: string;
  AWS_SES_REGION: string;
  /** Shared secret authenticating the weekly newsletter send endpoint. */
  NEWSLETTER_SEND_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  // next-auth
  AUTH_SECRET: string;
  // Optional integrations
  SLACK_WEBHOOK_URL: string;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  /**
   * @deprecated HubSpot is decommissioned. Kept empty for transitional type
   * compatibility only — use ESPOCRM_* for CRM.
   */
  HUBSPOT_API_KEY: string;
  /** @deprecated See HUBSPOT_API_KEY. */
  HUBSPOT_CLIENT_SECRET: string;
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

/** Clears the SSM config cache - used in tests to pick up env changes. */
export function resetSsmCache(): void {
  cached = null;
  cachedAt = 0;
}

async function fetchSsmParams(): Promise<Map<string, string>> {
  const ssm = await getSsmClient();
  const params = new Map<string, string>();
  let nextToken: string | undefined;
  do {
    const { GetParametersByPathCommand } = await import("@aws-sdk/client-ssm");
    const res = await ssm.send(
      new GetParametersByPathCommand({
        Path: SSM_PREFIX,
        WithDecryption: true,
        NextToken: nextToken,
      })
    );
    for (const p of res.Parameters ?? []) {
      const key = p.Name?.replace(`${SSM_PREFIX}/`, "") ?? "";
      if (key && p.Value) params.set(key, p.Value);
    }
    nextToken = res.NextToken;
  } while (nextToken);
  return params;
}

function validateRequiredKeys(params: Map<string, string>): void {
  const required = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as string[];
  // Cognito keys only required when still on Cognito Hosted UI path
  if ((process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "d1") === "cognito") {
    required.push("COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID");
  }
  const missing: string[] = [];
  for (const key of required) {
    if (!params.get(key)) {
      missing.push(`${SSM_PREFIX}/${key}`);
    }
  }
  if (missing.length > 0) {
    console.warn(
      `[SSM] Missing required parameters (some features may be disabled): ${missing.join(", ")}`
    );
  }
}

function buildConfigFromParams(params: Map<string, string>): AppConfig {
  const sesFrom = params.get("SES_FROM_EMAIL") || "noreply@cloudless.gr";
  const sesTo = params.get("SES_TO_EMAIL") || "tbaltzakis@cloudless.gr";
  const sesRegion = params.get("AWS_SES_REGION") || DEFAULT_REGION;

  if (!sesFrom.includes("@") || !sesTo.includes("@")) {
    console.warn(
      `[SSM] SES email addresses look invalid - FROM: ${sesFrom}, TO: ${sesTo}. Using defaults.`
    );
  }

  return {
    SES_FROM_EMAIL: sesFrom,
    SES_TO_EMAIL: sesTo,
    AWS_SES_REGION: sesRegion,
    NEWSLETTER_SEND_SECRET: params.get("NEWSLETTER_SEND_SECRET") ?? "",
    STRIPE_SECRET_KEY: params.get("STRIPE_SECRET_KEY") ?? "",
    STRIPE_PUBLISHABLE_KEY: params.get("STRIPE_PUBLISHABLE_KEY") ?? "",
    STRIPE_WEBHOOK_SECRET: params.get("STRIPE_WEBHOOK_SECRET") ?? "",
    COGNITO_USER_POOL_ID: params.get("COGNITO_USER_POOL_ID") ?? "",
    COGNITO_CLIENT_ID: params.get("COGNITO_CLIENT_ID") ?? "",
    AUTH_SECRET: params.get("AUTH_SECRET") ?? "",
    SLACK_WEBHOOK_URL: params.get("SLACK_WEBHOOK_URL") ?? "",
    SLACK_BOT_TOKEN: params.get("SLACK_BOT_TOKEN") ?? "",
    SLACK_SIGNING_SECRET: params.get("SLACK_SIGNING_SECRET") ?? "",
    // Deprecated HubSpot keys: ignored even if still present in SSM.
    HUBSPOT_API_KEY: "",
    HUBSPOT_CLIENT_SECRET: "",
    NOTION_API_KEY: params.get("NOTION_API_KEY") ?? "",
    NOTION_BLOG_DB_ID: params.get("NOTION_BLOG_DB_ID") ?? "",
    NOTION_WEBHOOK_SECRET: params.get("NOTION_WEBHOOK_SECRET") ?? "",
    NOTION_SUBMISSIONS_DB_ID: params.get("NOTION_SUBMISSIONS_DB_ID") ?? "",
    NOTION_DOCS_DB_ID: params.get("NOTION_DOCS_DB_ID") ?? "",
    NOTION_PROJECTS_DB_ID: params.get("NOTION_PROJECTS_DB_ID") ?? "",
    NOTION_TASKS_DB_ID: params.get("NOTION_TASKS_DB_ID") ?? "",
    NOTION_ANALYTICS_DB_ID: params.get("NOTION_ANALYTICS_DB_ID") ?? "",
    NOTION_GSC_REPORTS_DB_ID: params.get("NOTION_GSC_REPORTS_DB_ID") ?? "",
    NOTION_CALENDAR_DB_ID: params.get("NOTION_CALENDAR_DB_ID") ?? "",
    NOTION_REPORTS_DB_ID: params.get("NOTION_REPORTS_DB_ID") ?? "",
    NOTION_TESTIMONIALS_DB_ID: params.get("NOTION_TESTIMONIALS_DB_ID") ?? "",
    NOTION_CASE_STUDIES_DB_ID: params.get("NOTION_CASE_STUDIES_DB_ID") ?? "",
    NOTION_SERVICES_DB_ID: params.get("NOTION_SERVICES_DB_ID") ?? "",
    NOTION_FAQS_DB_ID: params.get("NOTION_FAQS_DB_ID") ?? "",
    GOOGLE_CLIENT_EMAIL: params.get("GOOGLE_CLIENT_EMAIL") ?? "",
    GOOGLE_PRIVATE_KEY: (params.get("GOOGLE_PRIVATE_KEY") ?? "").replaceAll(String.raw`\n`, "\n"),
    GOOGLE_CALENDAR_ID: params.get("GOOGLE_CALENDAR_ID") ?? "",
    GSC_SITE_URL: params.get("GSC_SITE_URL") ?? "sc-domain:cloudless.gr",
    SENTRY_AUTH_TOKEN: params.get("SENTRY_AUTH_TOKEN") ?? "",
    SENTRY_ORG: params.get("SENTRY_ORG") ?? "baltzakisthemiscom",
    SENTRY_PROJECT: params.get("SENTRY_PROJECT") ?? "cloudless-gr",
    ACTIVECAMPAIGN_API_URL: params.get("ACTIVECAMPAIGN_API_URL") ?? "",
    ACTIVECAMPAIGN_API_TOKEN: params.get("ACTIVECAMPAIGN_API_TOKEN") ?? "",
    GOOGLE_ADS_DEVELOPER_TOKEN: params.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "",
    GOOGLE_ADS_CUSTOMER_ID: params.get("GOOGLE_ADS_CUSTOMER_ID") ?? "",
    LINKEDIN_CLIENT_ID: params.get("LINKEDIN_CLIENT_ID") ?? "",
    LINKEDIN_CLIENT_SECRET: params.get("LINKEDIN_CLIENT_SECRET") ?? "",
    LINKEDIN_ACCESS_TOKEN: params.get("LINKEDIN_ACCESS_TOKEN") ?? "",
    LINKEDIN_AD_ACCOUNT_ID: params.get("LINKEDIN_AD_ACCOUNT_ID") ?? "",
    LINKEDIN_ORGANIZATION_URN: params.get("LINKEDIN_ORGANIZATION_URN") ?? "",
    TIKTOK_APP_ID: params.get("TIKTOK_APP_ID") ?? "",
    TIKTOK_APP_SECRET: params.get("TIKTOK_APP_SECRET") ?? "",
    TIKTOK_ACCESS_TOKEN: params.get("TIKTOK_ACCESS_TOKEN") ?? "",
    TIKTOK_ADVERTISER_ID: params.get("TIKTOK_ADVERTISER_ID") ?? "",
    X_API_KEY: params.get("X_API_KEY") ?? "",
    X_API_SECRET: params.get("X_API_SECRET") ?? "",
    X_ACCESS_TOKEN: params.get("X_ACCESS_TOKEN") ?? "",
    X_ACCESS_SECRET: params.get("X_ACCESS_SECRET") ?? "",
    X_AD_ACCOUNT_ID: params.get("X_AD_ACCOUNT_ID") ?? "",
    META_AD_ACCOUNT_ID: params.get("META_AD_ACCOUNT_ID") ?? "",
    META_PIXEL_ID: params.get("META_PIXEL_ID") ?? "",
    META_CAPI_ACCESS_TOKEN: params.get("META_CAPI_ACCESS_TOKEN") ?? "",
    META_ACCESS_TOKEN: params.get("META_ACCESS_TOKEN") ?? "",
    META_PAGE_ID: params.get("META_PAGE_ID") ?? "",
    GITHUB_TOKEN: params.get("GITHUB_TOKEN") ?? "",
    CRON_SECRET: params.get("CRON_SECRET") ?? "",
    ANTHROPIC_API_KEY: params.get("ANTHROPIC_API_KEY") ?? "",
    ANTHROPIC_CHAT_MODEL: params.get("ANTHROPIC_CHAT_MODEL") ?? "",
    GEMINI_API_KEY: params.get("GEMINI_API_KEY") ?? "",
    AI_GENERATE_SECRET: params.get("AI_GENERATE_SECRET") ?? "",
    GITHUB_DISPATCH_TOKEN: params.get("GITHUB_DISPATCH_TOKEN") ?? "",
    ADMIN_ALERT_SECRET: params.get("ADMIN_ALERT_SECRET") ?? "",
    CONTENT_WEBHOOK_SECRET: params.get("CONTENT_WEBHOOK_SECRET") ?? "",
    SENTRY_WEBHOOK_SECRET: params.get("SENTRY_WEBHOOK_SECRET") ?? "",
    SNS_PORTAL_TOPIC_ARN: params.get("SNS_PORTAL_TOPIC_ARN") ?? "",
    GRAFANA_BASE_URL: params.get("GRAFANA_BASE_URL") ?? "",
    GRAFANA_API_TOKEN: params.get("GRAFANA_API_TOKEN") ?? "",
    PROMETHEUS_URL: params.get("PROMETHEUS_URL") ?? "",
    KUMA_BASE_URL: params.get("KUMA_BASE_URL") ?? "",
    KUMA_STATUS_PAGE_SLUG: params.get("KUMA_STATUS_PAGE_SLUG") ?? "",
    KUMA_API_KEY: params.get("KUMA_API_KEY") ?? "",
    NTFY_BASE_URL: params.get("NTFY_BASE_URL") ?? "",
    NTFY_TOPIC: params.get("NTFY_TOPIC") ?? "",
    NTFY_TOKEN: params.get("NTFY_TOKEN") ?? "",
    ADMIN_PUSH_VIA_NTFY: params.get("ADMIN_PUSH_VIA_NTFY") ?? "",
    MQTT_BROKER_HOST: params.get("MQTT_BROKER_HOST") ?? "",
    MQTT_BROKER_PORT: params.get("MQTT_BROKER_PORT") ?? "",
    MQTT_USERNAME: params.get("MQTT_USERNAME") ?? "",
    MQTT_PASSWORD: params.get("MQTT_PASSWORD") ?? "",
    ESPOCRM_BASE_URL: params.get("ESPOCRM_BASE_URL") ?? "",
    ESPOCRM_API_KEY: params.get("ESPOCRM_API_KEY") ?? "",
    ESPOCRM_API_PASSWORD: params.get("ESPOCRM_API_PASSWORD") ?? "",
    ESPOCRM_API_USER: params.get("ESPOCRM_API_USER") ?? "admin",
    ESPOCRM_WEBHOOK_SECRET: params.get("ESPOCRM_WEBHOOK_SECRET") ?? "",
    APPFLOWY_API_URL: params.get("APPFLOWY_API_URL") ?? "",
    APPFLOWY_JWT_SECRET: params.get("APPFLOWY_JWT_SECRET") ?? "",
    APPFLOWY_EMAIL: params.get("APPFLOWY_EMAIL") ?? "",
    APPFLOWY_PASSWORD: params.get("APPFLOWY_PASSWORD") ?? "",
    POSTIZ_API_URL: params.get("POSTIZ_API_URL") ?? "",
    POSTIZ_API_KEY: params.get("POSTIZ_API_KEY") ?? "",
    POSTIZ_WEBHOOK_SECRET: params.get("POSTIZ_WEBHOOK_SECRET") ?? "",
    POSTIZ_SLACK_CHANNEL: params.get("POSTIZ_SLACK_CHANNEL") ?? "",
    ACTIVECAMPAIGN_LEAD_AUTOMATION_ID: params.get("ACTIVECAMPAIGN_LEAD_AUTOMATION_ID") ?? "",
    LINKEDIN_CAPI_ACCESS_TOKEN: params.get("LINKEDIN_CAPI_ACCESS_TOKEN") ?? "",
    N8N_API_URL: params.get("N8N_API_URL") ?? "",
    N8N_API_KEY: params.get("N8N_API_KEY") ?? "",
    N8N_WORKFLOW_LEAD_ENRICH_ID: params.get("N8N_WORKFLOW_LEAD_ENRICH_ID") ?? "",
    N8N_WORKFLOW_NEWSLETTER_NURTURE_ID: params.get("N8N_WORKFLOW_NEWSLETTER_NURTURE_ID") ?? "",
  };
}

/**
 * Builds an AppConfig purely from process.env - used in test environments
 * so tests never touch AWS SSM.
 */
function buildConfigFromEnv(): AppConfig {
  return {
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || "noreply@cloudless.gr",
    SES_TO_EMAIL: process.env.SES_TO_EMAIL || "tbaltzakis@cloudless.gr",
    AWS_SES_REGION: process.env.AWS_SES_REGION || DEFAULT_REGION,
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
    HUBSPOT_API_KEY: "",
    HUBSPOT_CLIENT_SECRET: "",
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
 * Fetches config from D1 app_config, SSM, or process.env.
 * Prefer D1 whenever AUTH_DB is bound (Workers *or* Pi with binding).
 * Secrets in process.env always win over D1 values.
 */
export async function getConfig(): Promise<AppConfig> {
  // 1. Prefer Cloudflare D1 app_config when AUTH_DB is bound (any runtime)
  try {
    const maybeEnv = (typeof process !== "undefined" ? process.env : {}) as Record<string, unknown>;
    const db = maybeEnv.AUTH_DB as D1Database | undefined;

    if (db && typeof db.prepare === "function") {
      const d1Config = await getD1Config(db);
      const envConfig = buildConfigFromEnv();
      // Env/secrets win; D1 fills non-secret gaps
      return { ...d1Config, ...envConfig } as AppConfig;
    }
  } catch (err) {
    console.warn("[config] D1 lookup failed, continuing:", err);
  }

  // 2. Workers without D1 → env only
  if (isWorkersEnvironment()) {
    return buildConfigFromEnv();
  }

  // 3. Fall back to AWS SSM for non-Worker environments (legacy Lambda)

  // In tests, skip SSM entirely and read from process.env. Still cache the
  // result so successive getConfig() calls return the same object reference;
  // resetSsmCache() clears `cached` so per-test vi.stubEnv() changes are picked up.
  if (process.env.NODE_ENV === "test" || process.env.SSM_DISABLED === "1") {
    if (cached) return cached;
    cached = buildConfigFromEnv();
    cachedAt = Date.now();
    return cached;
  }

  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  let params: Map<string, string>;
  try {
    params = await fetchSsmParams();
  } catch (err) {
    // Transient SSM failure - serve stale cache rather than crashing all requests
    if (cached) {
      console.warn("[SSM] Fetch failed, serving stale config:", err);
      return cached;
    }
    // Dev-only fallback: when AWS creds aren't available locally (no
    // ~/.aws/credentials, no SSO session, no env keys), don't crash every
    // API route. Build config from .env.local directly. In production,
    // throwing is correct - Lambda always has IAM role creds, so a failure
    // there is real.
    if (process.env.NODE_ENV !== "production") {
      const errName = (err as { name?: string })?.name ?? "Error";
      console.warn(
        `[SSM] ${errName} in dev - falling back to .env.local. ` +
          "Set AWS_PROFILE or use IAM env keys to talk to real SSM."
      );
      cached = buildConfigFromEnv();
      cachedAt = Date.now();
      return cached;
    }
    throw err;
  }

  validateRequiredKeys(params);

  cached = buildConfigFromParams(params);
  cachedAt = Date.now();

  return cached;
}
