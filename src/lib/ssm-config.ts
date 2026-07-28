import { getParameter } from "@aws-sdk/client-ssm";
import { getSecretValue } from "@aws-sdk/client-secrets-manager";
import { env } from "@/config";

export interface AppConfig {
  // ... other properties
  APPFLOWY_WEBHOOK_SECRET: string;
  GOOGLE_CLIENT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  APPFLOWY_API_URL: string;
  STRIPE_SECRET_KEY: string;
  CRON_SECRET: string;
  PROMETHEUS_URL: string;
  SENTRY_AUTH_TOKEN: string;
  TIKTOK_APP_ID: string;
  TIKTOK_APP_SECRET: string;
  // ... other properties
}

export async function getConfig(): Promise<AppConfig> {
  // ... implementation
}
