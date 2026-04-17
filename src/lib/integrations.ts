/**
 * Optional integration API keys — loaded from env vars.
 * The app works without any of these; each integration degrades gracefully.
 * In production, add these to SSM under /cloudless/production/ and extend getConfig().
 */

export interface IntegrationConfig {
  SLACK_WEBHOOK_URL?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
  HUBSPOT_API_KEY?: string;
  NOTION_API_KEY?: string;
  NOTION_BLOG_DB_ID?: string;
  NOTION_SUBMISSIONS_DB_ID?: string;
  NOTION_DOCS_DB_ID?: string;
  NOTION_PROJECTS_DB_ID?: string;
  NOTION_TASKS_DB_ID?: string;
  NOTION_ANALYTICS_DB_ID?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_CALENDAR_ID?: string;
  STRIPE_SECRET_KEY?: string;
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;
  SENTRY_PROJECT?: string;
  NOTION_WEBHOOK_SECRET?: string;
}

let cached: IntegrationConfig | null = null;

export function getIntegrations(): IntegrationConfig {
  if (cached) return cached;

  cached = {
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
    HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY,
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_BLOG_DB_ID: process.env.NOTION_BLOG_DB_ID,
    NOTION_SUBMISSIONS_DB_ID: process.env.NOTION_SUBMISSIONS_DB_ID,
    NOTION_DOCS_DB_ID: process.env.NOTION_DOCS_DB_ID,
    NOTION_PROJECTS_DB_ID: process.env.NOTION_PROJECTS_DB_ID,
    NOTION_TASKS_DB_ID: process.env.NOTION_TASKS_DB_ID,
    NOTION_ANALYTICS_DB_ID: process.env.NOTION_ANALYTICS_DB_ID,
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG ?? "baltzakisthemiscom",
    SENTRY_PROJECT: process.env.SENTRY_PROJECT ?? "cloudless-gr",
    NOTION_WEBHOOK_SECRET: process.env.NOTION_WEBHOOK_SECRET,
  };

  return cached;
}

/** Check if a specific integration is configured */
export function isConfigured(
  ...keys: (keyof IntegrationConfig)[]
): boolean {
  const config = getIntegrations();
  return keys.every((k) => Boolean(config[k]));
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

  cachedSlack = { SLACK_BOT_TOKEN: token, SLACK_SIGNING_SECRET: signingSecret, SLACK_WEBHOOK_URL: webhookUrl };
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
  let token = cfg.SLACK_BOT_TOKEN ?? '';
  let signingSecret = cfg.SLACK_SIGNING_SECRET ?? '';
  let webhookUrl = cfg.SLACK_WEBHOOK_URL ?? '';

  // SSM fallback when signing secret is missing from env
  if (!signingSecret) {
    try {
      const { getConfig } = await import('@/lib/ssm-config');
      const ssmCfg = await getConfig();
      signingSecret = (ssmCfg as unknown as Record<string, string>).SLACK_SIGNING_SECRET ?? '';
      if (!token) token = (ssmCfg as unknown as Record<string, string>).SLACK_BOT_TOKEN ?? '';
      if (!webhookUrl) webhookUrl = (ssmCfg as unknown as Record<string, string>).SLACK_WEBHOOK_URL ?? '';
    } catch (err) {
      console.warn('[Slack] SSM fallback failed:', err);
    }
  }

  if (!token && !webhookUrl) {
    console.warn(
      '[Slack] Neither SLACK_BOT_TOKEN nor SLACK_WEBHOOK_URL is set — ' +
        'Slack notifications will be skipped.',
    );
  }

  cachedSlackAsync = { SLACK_BOT_TOKEN: token, SLACK_SIGNING_SECRET: signingSecret, SLACK_WEBHOOK_URL: webhookUrl };
  return cachedSlackAsync;
}

/** Reset the integration cache — useful in tests to pick up env changes */
export function resetIntegrationCache(): void {
  cached = null;
  cachedSlack = null;
}

/** Clears the config cache (useful in tests). */
export function resetSlackConfigCache(): void {
  cachedSlack = null;
  cachedSlackAsync = null;
  cached = null;
}
