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
      "