import { GetParametersByPathCommand, SSMClient } from "@aws-sdk/client-ssm";

// || (not ??) so that SSM_PREFIX="" falls back to the default instead of fetching from "/"
const SSM_PREFIX = process.env.SSM_PREFIX || "/cloudless/production";
const REGION = process.env.AWS_REGION || "us-east-1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level singleton — avoids re-creating the connection pool on every cache miss
let ssmClient: SSMClient | null = null;
function getSsmClient(): SSMClient {
  if (!ssmClient) ssmClient = new SSMClient({ region: REGION });
  return ssmClient;
}

interface AppConfig {
  SES_FROM_EMAIL: string;
  SES_TO_EMAIL: string;
  AWS_SES_REGION: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  // Optional integrations
  SLACK_WEBHOOK_URL: string;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  HUBSPOT_API_KEY: string;
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
  // AI
  ANTHROPIC_API_KEY: string;
}

let cached: AppConfig | null = null;
let cachedAt = 0;

/** Clears the SSM config cache — used in tests to pick up env changes. */
export function resetSsmCache(): void {
  cached = null;
  cachedAt = 0;
}

/**
 * Builds an AppConfig purely from process.env — used in test environments
 * so tests never touch AWS SSM.
 */
function buildConfigFromEnv(): AppConfig {
  return {
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || "noreply@cloudless.gr",
    SES_TO_EMAIL: process.env.SES_TO_EMAIL || "tbaltzakis@cloudless.gr",
    AWS_SES_REGION: process.env.AWS_SES_REGION || "us-east-1",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || "",
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || "",
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || "",
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || "",
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET || "",
    HUBSPOT_API_KEY:
      process.env.HUBSPOT_API_KEY ||
      process.env.HUBSPOT_PRIVATE_APP_TOKEN ||
      "",
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
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL || "",
    GOOGLE_PRIVATE_KEY: (process.env.GOOGLE_PRIVATE_KEY || "").replace(
      /\\n/g,
      "\n",
    ),
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
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  };
}

async function fetchSsmParams(
  ssm: SSMClient,
  params: Map<string, string>,
  nextToken?: string,
): Promise<void> {
  const cmd = new GetParametersByPathCommand({
    Path: SSM_PREFIX,
    WithDecryption: true,
    NextToken: nextToken,
  });
  const res = await ssm.send(cmd);
  for (const p of res.Parameters ?? []) {
    const key = p.Name?.replace(`${SSM_PREFIX}/`, "") ?? "";
    if (key && p.Value) params.set(key, p.Value);
  }
  if (res.NextToken) {
    await fetchSsmParams(ssm, params, res.NextToken);
  }
}

/**
 * Fetches all /cloudless/production/* parameters from SSM.
 * Cache expires after 5 minutes to pick up rotated secrets without redeploy.
 * In test environments (NODE_ENV=test), reads from process.env directly.
 */
export async function getConfig(): Promise<AppConfig> {
  // In tests, skip SSM entirely and read from process.env. Still cache the
  // result so successive getConfig() calls return the same object reference;
  // resetSsmCache() clears `cached` so per-test vi.stubEnv() changes are picked up.
  if (process.env.NODE_ENV === "test") {
    if (cached) return cached;
    cached = buildConfigFromEnv();
    cachedAt = Date.now();
    return cached;
  }

  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  const ssm = getSsmClient();
  const params = new Map<string, string>();

  try {
    await fetchSsmParams(ssm, params);
  } catch (err) {
    // Transient SSM failure — serve stale cache rather than crashing all requests
    if (cached) {
      console.warn("[SSM] Fetch failed, serving stale config:", err);
      return cached;
    }
    throw err;
  }

  const required = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "COGNITO_USER_POOL_ID",
    "COGNITO_CLIENT_ID",
  ] as const;
  for (const key of required) {
    if (!params.get(key)) {
      throw new Error(`Missing required SSM parameter: ${SSM_PREFIX}/${key}`);
    }
  }

  const sesFrom = params.get("SES_FROM_EMAIL") || "noreply@cloudless.gr";
  const sesTo = params.get("SES_TO_EMAIL") || "tbaltzakis@cloudless.gr";
  const sesRegion = params.get("AWS_SES_REGION") || "us-east-1";

  if (!sesFrom.includes("@") || !sesTo.includes("@")) {
    console.warn(
      `[SSM] SES email addresses look invalid — FROM: ${sesFrom}, TO: ${sesTo}. Using defaults.`,
    );
  }

  cached = {
    SES_FROM_EMAIL: sesFrom,
    SES_TO_EMAIL: sesTo,
    AWS_SES_REGION: sesRegion,
    STRIPE_SECRET_KEY: params.get("STRIPE_SECRET_KEY")!,
    STRIPE_PUBLISHABLE_KEY: params.get("STRIPE_PUBLISHABLE_KEY") ?? "",
    STRIPE_WEBHOOK_SECRET: params.get("STRIPE_WEBHOOK_SECRET")!,
    COGNITO_USER_POOL_ID: params.get("COGNITO_USER_POOL_ID") ?? "",
    COGNITO_CLIENT_ID: params.get("COGNITO_CLIENT_ID") ?? "",
    SLACK_WEBHOOK_URL: params.get("SLACK_WEBHOOK_URL") ?? "",
    SLACK_BOT_TOKEN: params.get("SLACK_BOT_TOKEN") ?? "",
    SLACK_SIGNING_SECRET: params.get("SLACK_SIGNING_SECRET") ?? "",
    HUBSPOT_API_KEY: params.get("HUBSPOT_API_KEY") ?? "",
    HUBSPOT_CLIENT_SECRET: params.get("HUBSPOT_CLIENT_SECRET") ?? "",
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
    GOOGLE_CLIENT_EMAIL: params.get("GOOGLE_CLIENT_EMAIL") ?? "",
    GOOGLE_PRIVATE_KEY: (params.get("GOOGLE_PRIVATE_KEY") ?? "").replace(
      /\\n/g,
      "\n",
    ),
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
    ANTHROPIC_API_KEY: params.get("ANTHROPIC_API_KEY") ?? "",
  };
  cachedAt = Date.now();

  return cached;
}
