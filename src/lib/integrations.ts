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
  HUBSPOT_ACCESS_TOKEN?: string;
  HUBSPOT_PRIVATE_APP_TOKEN?: string;
  NOTION_API_KEY?: string;
  NOTION_BLOG_DB_ID?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_CALENDAR_ID?: string;
  AHREFS_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;
  SENTRY_PROJECT?: string;
}

let cached: IntegrationConfig | null = null;

export function getIntegrations(): IntegrationConfig {
  if (cached) return cached;

  cached = {
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
    HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY,
    HUBSPOT_ACCESS_TOKEN: process.env.HUBSPOT_ACCESS_TOKEN,
    HUBSPOT_PRIVATE_APP_TOKEN: process.env.HUBSPOT_PRIVATE_APP_TOKEN,
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_BLOG_DB_ID: process.env.NOTION_BLOG_DB_ID,
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_EMAIL:
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
    AHREFS_API_KEY: process.env.AHREFS_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG ?? "cloudless",
    SENTRY_PROJECT: process.env.SENTRY_PROJECT ?? "cloudless-gr",
  };

  return cached;
}

/** Check if a specific integration is configured */
export function isConfigured(...keys: (keyof IntegrationConfig)[]): boolean {
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

  cachedSlack = {
    SLACK_BOT_TOKEN: token,
    SLACK_SIGNING_SECRET: signingSecret,
    SLACK_WEBHOOK_URL: webhookUrl,
  };
  return cachedSlack;
}

/** Clears the config cache (useful in tests). */
export function resetSlackConfigCache(): void {
  cachedSlack = null;
  cached = null;
}
