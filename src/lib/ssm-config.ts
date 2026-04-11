import { GetParametersByPathCommand, SSMClient } from "@aws-sdk/client-ssm";

const SSM_PREFIX = process.env.SSM_PREFIX ?? "/cloudless/production";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface AppConfig {
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
  HUBSPOT_API_KEY: string;
  NOTION_API_KEY: string;
  NOTION_BLOG_DB_ID: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  GOOGLE_CALENDAR_ID: string;
  AHREFS_API_KEY: string;
  SENTRY_AUTH_TOKEN: string;
  SENTRY_ORG: string;
  SENTRY_PROJECT: string;
}

let configCache: { config: AppConfig; fetchedAt: number } | null = null;

function buildConfigFrom(
  record: Record<string, string | undefined>,
): AppConfig {
  return {
    SES_FROM_EMAIL: record.SES_FROM_EMAIL ?? process.env.SES_FROM_EMAIL ?? "",
    SES_TO_EMAIL: record.SES_TO_EMAIL ?? process.env.SES_TO_EMAIL ?? "",
    AWS_SES_REGION: record.AWS_SES_REGION ?? process.env.AWS_SES_REGION ?? "",
    STRIPE_SECRET_KEY:
      record.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? "",
    STRIPE_PUBLISHABLE_KEY:
      record.STRIPE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
      "",
    STRIPE_WEBHOOK_SECRET:
      record.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET ?? "",
    COGNITO_USER_POOL_ID:
      record.COGNITO_USER_POOL_ID ??
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ??
      "",
    COGNITO_CLIENT_ID:
      record.COGNITO_CLIENT_ID ??
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ??
      "",
    SLACK_WEBHOOK_URL:
      record.SLACK_WEBHOOK_URL ?? process.env.SLACK_WEBHOOK_URL ?? "",
    HUBSPOT_API_KEY:
      record.HUBSPOT_API_KEY ?? process.env.HUBSPOT_API_KEY ?? "",
    NOTION_API_KEY: record.NOTION_API_KEY ?? process.env.NOTION_API_KEY ?? "",
    NOTION_BLOG_DB_ID:
      record.NOTION_BLOG_DB_ID ?? process.env.NOTION_BLOG_DB_ID ?? "",
    GOOGLE_SERVICE_ACCOUNT_EMAIL:
      record.GOOGLE_SERVICE_ACCOUNT_EMAIL ??
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ??
      "",
    GOOGLE_PRIVATE_KEY:
      record.GOOGLE_PRIVATE_KEY ?? process.env.GOOGLE_PRIVATE_KEY ?? "",
    GOOGLE_CALENDAR_ID:
      record.GOOGLE_CALENDAR_ID ?? process.env.GOOGLE_CALENDAR_ID ?? "",
    AHREFS_API_KEY: record.AHREFS_API_KEY ?? process.env.AHREFS_API_KEY ?? "",
    SENTRY_AUTH_TOKEN:
      record.SENTRY_AUTH_TOKEN ?? process.env.SENTRY_AUTH_TOKEN ?? "",
    SENTRY_ORG: record.SENTRY_ORG ?? process.env.SENTRY_ORG ?? "",
    SENTRY_PROJECT: record.SENTRY_PROJECT ?? process.env.SENTRY_PROJECT ?? "",
  };
}

/**
 * Fetch app config from AWS SSM Parameter Store.
 * Falls back to environment variables.
 */
export async function getConfig(): Promise<AppConfig> {
  // Return cache if fresh
  if (configCache && Date.now() - configCache.fetchedAt < CACHE_TTL_MS) {
    return configCache.config;
  }

  // Keep tests deterministic and avoid SSM/AWS credential lookups.
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    const config = buildConfigFrom({});
    configCache = { config, fetchedAt: Date.now() };
    return config;
  }

  type ConfigRecord = Record<string, string | undefined>;
  const ssmConfig: ConfigRecord = {};

  try {
    const client = new SSMClient({ region: REGION });
    const cmd = new GetParametersByPathCommand({
      Path: SSM_PREFIX,
      Recursive: true,
      WithDecryption: true,
    });

    const response = await client.send(cmd);
    if (response.Parameters) {
      response.Parameters.forEach((param) => {
        if (param.Name && param.Value) {
          const key = param.Name.split("/").pop();
          if (key) ssmConfig[key] = param.Value;
        }
      });
    }
    client.destroy();
  } catch (err) {
    // Fall through to env vars
    console.warn("Could not fetch from SSM:", err);
  }

  // Build config with env var fallbacks
  const config = buildConfigFrom(ssmConfig);

  configCache = { config, fetchedAt: Date.now() };
  return config;
}

export function requireSesConfig(config: AppConfig): void {
  if (!config.SES_FROM_EMAIL || !config.SES_TO_EMAIL) {
    throw new Error(
      "Missing required SES config: SES_FROM_EMAIL and SES_TO_EMAIL must be set",
    );
  }
  if (!config.AWS_SES_REGION) {
    throw new Error("Missing required SES config: AWS_SES_REGION must be set");
  }
}
