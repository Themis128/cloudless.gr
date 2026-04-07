/**
 * Optional integration API keys — loaded from env vars.
 * The app works without any of these; each integration degrades gracefully.
 * In production, add these to SSM under /cloudless/production/ and extend getConfig().
 */

export interface IntegrationConfig {
  SLACK_WEBHOOK_URL?: string;
  HUBSPOT_API_KEY?: string;
  NOTION_API_KEY?: string;
  NOTION_BLOG_DB_ID?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_CALENDAR_ID?: string;
  AHREFS_API_KEY?: string;
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;
  SENTRY_PROJECT?: string;
}

let cached: IntegrationConfig | null = null;

export function getIntegrations(): IntegrationConfig {
  if (cached) return cached;

  cached = {
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY,
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_BLOG_DB_ID: process.env.NOTION_BLOG_DB_ID,
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
    AHREFS_API_KEY: process.env.AHREFS_API_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG ?? "cloudless",
    SENTRY_PROJECT: process.env.SENTRY_PROJECT ?? "cloudless-gr",
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
