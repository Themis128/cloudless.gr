/**
 * Optional integration API keys — loaded from env vars with SSM fallback.
 * The app works without any of these; each integration degrades gracefully.
 *
 * Use getIntegrations() (sync) in contexts where SSM is unavailable (e.g. build time).
 * Use getIntegrationsAsync() (async) in API routes — it merges SSM values for any
 * keys that are missing from process.env, which is the normal production case.
 */

export interface IntegrationConfig {
  SLACK_WEBHOOK_URL?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
  HUBSPOT_API_KEY?: string;
  HUBSPOT_CLIENT_SECRET?: string;
  NOTION_API_KEY?: string;
  NOTION_BLOG_DB_ID?: string;
  NOTION_SUBMISSIONS_DB_ID?: string;
  NOTION_DOCS_DB_ID?: string;
  NOTION_PROJECTS_DB_ID?: string;
  NOTION_TASKS_DB_ID?: string;
  NOTION_ANALYTICS_DB_ID?: string;
  NOTION_CALENDAR_DB_ID?: string;
  NOTION_REPORTS_DB_ID?: string;
  NOTION_CRM_SYNC_DB_ID?: string;
  NOTION_ORDERS_DB_ID?: string;
  NOTION_GSC_REPORTS_DB_ID?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_CALENDAR_ID?: string;
  STRIPE_SECRET_KEY?: string;
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;
  SENTRY_PROJECT?: string;
  NOTION_WEBHOOK_SECRET?: string;
  // ActiveCampaign
  ACTIVECAMPAIGN_API_URL?: string;
  ACTIVECAMPAIGN_API_TOKEN?: string;
  // Google Ads
  GOOGLE_ADS_DEVELOPER_TOKEN?: string;
  GOOGLE_ADS_CUSTOMER_ID?: string;
  // LinkedIn
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  LINKEDIN_ACCESS_TOKEN?: string;
  LINKEDIN_AD_ACCOUNT_ID?: string;
  LINKEDIN_ORGANIZATION_URN?: string;
  // TikTok
  TIKTOK_APP_ID?: string;
  TIKTOK_APP_SECRET?: string;
  TIKTOK_ACCESS_TOKEN?: string;
  TIKTOK_ADVERTISER_ID?: string;
  // X (Twitter)
  X_API_KEY?: string;
  X_API_SECRET?: string;
  X_ACCESS_TOKEN?: string;
  X_ACCESS_SECRET?: string;
  X_AD_ACCOUNT_ID?: string;
  // Meta
  META_AD_ACCOUNT_ID?: string;
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_ACCESS_TOKEN?: string;
  META_PAGE_ID?: string;
  // AI
  ANTHROPIC_API_KEY?: string;
}

let cached: IntegrationConfig | null = null;

export function getIntegrations(): IntegrationConfig {
  if (cached) return cached;

  cached = {
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
    HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY,
    HUBSPOT_CLIENT_SECRET: process.env.HUBSPOT_CLIENT_SECRET,
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_BLOG_DB_ID: process.env.NOTION_BLOG_DB_ID,
    NOTION_SUBMISSIONS_DB_ID: process.env.NOTION_SUBMISSIONS_DB_ID,
    NOTION_DOCS_DB_ID: process.env.NOTION_DOCS_DB_ID,
    NOTION_PROJECTS_DB_ID: process.env.NOTION_PROJECTS_DB_ID,
    NOTION_TASKS_DB_ID: process.env.NOTION_TASKS_DB_ID,
    NOTION_ANALYTICS_DB_ID: process.env.NOTION_ANALYTICS_DB_ID,
    NOTION_CALENDAR_DB_ID: process.env.NOTION_CALENDAR_DB_ID,
    NOTION_REPORTS_DB_ID: process.env.NOTION_REPORTS_DB_ID,
    NOTION_CRM_SYNC_DB_ID: process.env.NOTION_CRM_SYNC_DB_ID,
    NOTION_ORDERS_DB_ID: process.env.NOTION_ORDERS_DB_ID,
    NOTION_GSC_REPORTS_DB_ID: process.env.NOTION_GSC_REPORTS_DB_ID,
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_EMAIL:
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG ?? "baltzakisthemiscom",
    SENTRY_PROJECT: process.env.SENTRY_PROJECT ?? "cloudless-gr",
    NOTION_WEBHOOK_SECRET: process.env.NOTION_WEBHOOK_SECRET,
    ACTIVECAMPAIGN_API_URL: process.env.ACTIVECAMPAIGN_API_URL,
    ACTIVECAMPAIGN_API_TOKEN: process.env.ACTIVECAMPAIGN_API_TOKEN,
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_CUSTOMER_ID: process.env.GOOGLE_ADS_CUSTOMER_ID,
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
    LINKEDIN_ACCESS_TOKEN: process.env.LINKEDIN_ACCESS_TOKEN,
    LINKEDIN_AD_ACCOUNT_ID: process.env.LINKEDIN_AD_ACCOUNT_ID,
    LINKEDIN_ORGANIZATION_URN: process.env.LINKEDIN_ORGANIZATION_URN,
    TIKTOK_APP_ID: process.env.TIKTOK_APP_ID,
    TIKTOK_APP_SECRET: process.env.TIKTOK_APP_SECRET,
    TIKTOK_ACCESS_TOKEN: process.env.TIKTOK_ACCESS_TOKEN,
    TIKTOK_ADVERTISER_ID: process.env.TIKTOK_ADVERTISER_ID,
    X_API_KEY: process.env.X_API_KEY,
    X_API_SECRET: process.env.X_API_SECRET,
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN,
    X_ACCESS_SECRET: process.env.X_ACCESS_SECRET,
    X_AD_ACCOUNT_ID: process.env.X_AD_ACCOUNT_ID,
    META_AD_ACCOUNT_ID: process.env.META_AD_ACCOUNT_ID,
    META_PIXEL_ID: process.env.META_PIXEL_ID,
    META_CAPI_ACCESS_TOKEN: process.env.META_CAPI_ACCESS_TOKEN,
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    META_PAGE_ID: process.env.META_PAGE_ID,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };

  return cached;
}

/** Check if a specific integration is configured */
export function isConfigured(...keys: (keyof IntegrationConfig)[]): boolean {
  const config = getIntegrations();
  return keys.every((k) => Boolean(config[k]));
}

let cachedAsync: IntegrationConfig | null = null;

/**
 * Async version of getIntegrations() — reads from process.env first, then
 * fills any missing values from SSM Parameter Store (/cloudless/production/*).
 *
 * Use this in API route handlers where SSM is available (Lambda / server).
 * The sync getIntegrations() is only suitable for build-time / edge contexts
 * where SSM cannot be called.
 */
export async function getIntegrationsAsync(): Promise<IntegrationConfig> {
  if (cachedAsync) return cachedAsync;

  // Start with env-based values
  const envCfg = getIntegrations();

  // If all critical keys are already present in env, skip SSM round-trip
  const criticalKeys: (keyof IntegrationConfig)[] = [
    "NOTION_API_KEY",
    "HUBSPOT_API_KEY",
    "STRIPE_SECRET_KEY",
    "SENTRY_AUTH_TOKEN",
  ];
  const allPresent = criticalKeys.every((k) => Boolean(envCfg[k]));
  if (allPresent) {
    cachedAsync = envCfg;
    return cachedAsync;
  }

  // At least one critical key is missing — pull from SSM
  try {
    const { getConfig } = await import("@/lib/ssm-config");
    const ssm = await getConfig();

    cachedAsync = {
      SLACK_WEBHOOK_URL:
        envCfg.SLACK_WEBHOOK_URL || ssm.SLACK_WEBHOOK_URL || undefined,
      SLACK_BOT_TOKEN:
        envCfg.SLACK_BOT_TOKEN || ssm.SLACK_BOT_TOKEN || undefined,
      SLACK_SIGNING_SECRET:
        envCfg.SLACK_SIGNING_SECRET || ssm.SLACK_SIGNING_SECRET || undefined,
      HUBSPOT_API_KEY:
        envCfg.HUBSPOT_API_KEY || ssm.HUBSPOT_API_KEY || undefined,
      HUBSPOT_CLIENT_SECRET:
        envCfg.HUBSPOT_CLIENT_SECRET || ssm.HUBSPOT_CLIENT_SECRET || undefined,
      NOTION_API_KEY: envCfg.NOTION_API_KEY || ssm.NOTION_API_KEY || undefined,
      NOTION_BLOG_DB_ID:
        envCfg.NOTION_BLOG_DB_ID || ssm.NOTION_BLOG_DB_ID || undefined,
      NOTION_SUBMISSIONS_DB_ID:
        envCfg.NOTION_SUBMISSIONS_DB_ID ||
        ssm.NOTION_SUBMISSIONS_DB_ID ||
        undefined,
      NOTION_DOCS_DB_ID:
        envCfg.NOTION_DOCS_DB_ID || ssm.NOTION_DOCS_DB_ID || undefined,
      NOTION_PROJECTS_DB_ID:
        envCfg.NOTION_PROJECTS_DB_ID || ssm.NOTION_PROJECTS_DB_ID || undefined,
      NOTION_TASKS_DB_ID:
        envCfg.NOTION_TASKS_DB_ID || ssm.NOTION_TASKS_DB_ID || undefined,
      NOTION_ANALYTICS_DB_ID:
        envCfg.NOTION_ANALYTICS_DB_ID ||
        ssm.NOTION_ANALYTICS_DB_ID ||
        undefined,
      NOTION_CALENDAR_DB_ID:
        envCfg.NOTION_CALENDAR_DB_ID || ssm.NOTION_CALENDAR_DB_ID || undefined,
      NOTION_REPORTS_DB_ID:
        envCfg.NOTION_REPORTS_DB_ID || ssm.NOTION_REPORTS_DB_ID || undefined,
      NOTION_CRM_SYNC_DB_ID:
        envCfg.NOTION_CRM_SYNC_DB_ID || ssm.NOTION_CRM_SYNC_DB_ID || undefined,
      NOTION_ORDERS_DB_ID:
        envCfg.NOTION_ORDERS_DB_ID || ssm.NOTION_ORDERS_DB_ID || undefined,
      NOTION_GSC_REPORTS_DB_ID:
        envCfg.NOTION_GSC_REPORTS_DB_ID ||
        ssm.NOTION_GSC_REPORTS_DB_ID ||
        undefined,
      GOOGLE_CLIENT_EMAIL:
        envCfg.GOOGLE_CLIENT_EMAIL || ssm.GOOGLE_CLIENT_EMAIL || undefined,
      GOOGLE_SERVICE_ACCOUNT_EMAIL:
        envCfg.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
        ssm.GOOGLE_CLIENT_EMAIL ||
        undefined,
      GOOGLE_PRIVATE_KEY:
        envCfg.GOOGLE_PRIVATE_KEY || ssm.GOOGLE_PRIVATE_KEY || undefined,
      GOOGLE_CALENDAR_ID:
        envCfg.GOOGLE_CALENDAR_ID || ssm.GOOGLE_CALENDAR_ID || undefined,
      STRIPE_SECRET_KEY:
        envCfg.STRIPE_SECRET_KEY || ssm.STRIPE_SECRET_KEY || undefined,
      SENTRY_AUTH_TOKEN:
        envCfg.SENTRY_AUTH_TOKEN || ssm.SENTRY_AUTH_TOKEN || undefined,
      SENTRY_ORG: envCfg.SENTRY_ORG || ssm.SENTRY_ORG || "baltzakisthemiscom",
      SENTRY_PROJECT:
        envCfg.SENTRY_PROJECT || ssm.SENTRY_PROJECT || "cloudless-gr",
      NOTION_WEBHOOK_SECRET:
        envCfg.NOTION_WEBHOOK_SECRET || ssm.NOTION_WEBHOOK_SECRET || undefined,
      ACTIVECAMPAIGN_API_URL:
        envCfg.ACTIVECAMPAIGN_API_URL ||
        ssm.ACTIVECAMPAIGN_API_URL ||
        undefined,
      ACTIVECAMPAIGN_API_TOKEN:
        envCfg.ACTIVECAMPAIGN_API_TOKEN ||
        ssm.ACTIVECAMPAIGN_API_TOKEN ||
        undefined,
      GOOGLE_ADS_DEVELOPER_TOKEN:
        envCfg.GOOGLE_ADS_DEVELOPER_TOKEN ||
        ssm.GOOGLE_ADS_DEVELOPER_TOKEN ||
        undefined,
      GOOGLE_ADS_CUSTOMER_ID:
        envCfg.GOOGLE_ADS_CUSTOMER_ID ||
        ssm.GOOGLE_ADS_CUSTOMER_ID ||
        undefined,
      LINKEDIN_CLIENT_ID:
        envCfg.LINKEDIN_CLIENT_ID || ssm.LINKEDIN_CLIENT_ID || undefined,
      LINKEDIN_CLIENT_SECRET:
        envCfg.LINKEDIN_CLIENT_SECRET ||
        ssm.LINKEDIN_CLIENT_SECRET ||
        undefined,
      LINKEDIN_ACCESS_TOKEN:
        envCfg.LINKEDIN_ACCESS_TOKEN || ssm.LINKEDIN_ACCESS_TOKEN || undefined,
      LINKEDIN_AD_ACCOUNT_ID:
        envCfg.LINKEDIN_AD_ACCOUNT_ID ||
        ssm.LINKEDIN_AD_ACCOUNT_ID ||
        undefined,
      LINKEDIN_ORGANIZATION_URN:
        envCfg.LINKEDIN_ORGANIZATION_URN ||
        ssm.LINKEDIN_ORGANIZATION_URN ||
        undefined,
      TIKTOK_APP_ID: envCfg.TIKTOK_APP_ID || ssm.TIKTOK_APP_ID || undefined,
      TIKTOK_APP_SECRET:
        envCfg.TIKTOK_APP_SECRET || ssm.TIKTOK_APP_SECRET || undefined,
      TIKTOK_ACCESS_TOKEN:
        envCfg.TIKTOK_ACCESS_TOKEN || ssm.TIKTOK_ACCESS_TOKEN || undefined,
      TIKTOK_ADVERTISER_ID:
        envCfg.TIKTOK_ADVERTISER_ID || ssm.TIKTOK_ADVERTISER_ID || undefined,
      X_API_KEY: envCfg.X_API_KEY || ssm.X_API_KEY || undefined,
      X_API_SECRET: envCfg.X_API_SECRET || ssm.X_API_SECRET || undefined,
      X_ACCESS_TOKEN: envCfg.X_ACCESS_TOKEN || ssm.X_ACCESS_TOKEN || undefined,
      X_ACCESS_SECRET:
        envCfg.X_ACCESS_SECRET || ssm.X_ACCESS_SECRET || undefined,
      X_AD_ACCOUNT_ID:
        envCfg.X_AD_ACCOUNT_ID || ssm.X_AD_ACCOUNT_ID || undefined,
      META_AD_ACCOUNT_ID:
        envCfg.META_AD_ACCOUNT_ID || ssm.META_AD_ACCOUNT_ID || undefined,
      META_PIXEL_ID: envCfg.META_PIXEL_ID || ssm.META_PIXEL_ID || undefined,
      META_CAPI_ACCESS_TOKEN:
        envCfg.META_CAPI_ACCESS_TOKEN ||
        ssm.META_CAPI_ACCESS_TOKEN ||
        undefined,
      META_ACCESS_TOKEN:
        envCfg.META_ACCESS_TOKEN || ssm.META_ACCESS_TOKEN || undefined,
      META_PAGE_ID: envCfg.META_PAGE_ID || ssm.META_PAGE_ID || undefined,
      ANTHROPIC_API_KEY:
        envCfg.ANTHROPIC_API_KEY || ssm.ANTHROPIC_API_KEY || undefined,
    };
  } catch (err) {
    console.warn(
      "[Integrations] SSM fallback failed, using env-only config:",
      err,
    );
    cachedAsync = envCfg;
  }

  return cachedAsync!;
}

/**
 * Async version of isConfigured() — uses SSM fallback.
 * Use in API routes instead of the sync isConfigured().
 */
export async function isConfiguredAsync(
  ...keys: (keyof IntegrationConfig)[]
): Promise<boolean> {
  // Fast-path: if any env var is explicitly cleared to "" return false immediately.
  // This ensures tests that clear env vars bypass the async cache regardless of
  // any module-isolation effects from vi.mock.
  for (const k of keys) {
    const val = process.env[k as string];
    if (val !== undefined && !val) return false;
  }
  const config = await getIntegrationsAsync();
  return keys.every((k) => Boolean(config[k]));
}

/** Reset the async integration cache — useful in tests */
export function resetIntegrationCacheAsync(): void {
  cachedAsync = null;
}

/* ------------------------------------------------------------------ */
/*  Slack-specific config helper                                       */
/* ------------------------------------------------------------------ */

export interface SlackConfig {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_WEBHOOK_URL: string;
}

let cachedSlack: SlackConfig | null = null;

/**
 * Returns Slack integration config.
 * Reads from the general IntegrationConfig (env-backed).
 */
export function getSlackConfig(): SlackConfig {
  if (cachedSlack) return cachedSlack;

  const cfg = getIntegrations();
  const token = cfg.SLACK_BOT_TOKEN ?? "";
  const signingSecret = cfg.SLACK_SIGNING_SECRET ?? "";
  const webhookUrl = cfg.SLACK_WEBHOOK_URL ?? "";

  if (!token && !webhookUrl) {
    console.warn(
      "[Slack] Neither SLACK_BOT_TOKEN nor SLACK_WEBHOOK_URL is set — " +
        "Slack notifications will be skipped.",
    );
  }

  cachedSlack = {
    SLACK_BOT_TOKEN: token,
    SLACK_SIGNING_SECRET: signingSecret,
    SLACK_WEBHOOK_URL: webhookUrl,
  };
  return cachedSlack;
}

let cachedSlackAsync: SlackConfig | null = null;

/**
 * Async version that tries env vars first, then falls back to SSM
 * if SLACK_SIGNING_SECRET is empty.
 */
export async function getSlackConfigAsync(): Promise<SlackConfig> {
  if (cachedSlackAsync) return cachedSlackAsync;

  const cfg = getIntegrations();
  let token = cfg.SLACK_BOT_TOKEN ?? "";
  let signingSecret = cfg.SLACK_SIGNING_SECRET ?? "";
  let webhookUrl = cfg.SLACK_WEBHOOK_URL ?? "";

  // SSM fallback when signing secret is missing from env
  if (!signingSecret) {
    try {
      const { getConfig } = await import("@/lib/ssm-config");
      const ssmCfg = await getConfig();
      signingSecret =
        (ssmCfg as unknown as Record<string, string>).SLACK_SIGNING_SECRET ??
        "";
      if (!token)
        token =
          (ssmCfg as unknown as Record<string, string>).SLACK_BOT_TOKEN ?? "";
      if (!webhookUrl)
        webhookUrl =
          (ssmCfg as unknown as Record<string, string>).SLACK_WEBHOOK_URL ?? "";
    } catch (err) {
      console.warn("[Slack] SSM fallback failed:", err);
    }
  }

  if (!token && !webhookUrl) {
    console.warn(
      "[Slack] Neither SLACK_BOT_TOKEN nor SLACK_WEBHOOK_URL is set — " +
        "Slack notifications will be skipped.",
    );
  }

  cachedSlackAsync = {
    SLACK_BOT_TOKEN: token,
    SLACK_SIGNING_SECRET: signingSecret,
    SLACK_WEBHOOK_URL: webhookUrl,
  };
  return cachedSlackAsync;
}

/** Reset the integration cache — useful in tests to pick up env changes */
export function resetIntegrationCache(): void {
  cached = null;
  cachedSlack = null;
  cachedAsync = null;
  cachedSlackAsync = null;
}

/** Clears the config cache (useful in tests). */
export function resetSlackConfigCache(): void {
  cachedSlack = null;
  cachedSlackAsync = null;
  cached = null;
}
