/**
 * Cloudflare Workers Configuration Layer
 *
 * This module provides:
 * 1. Bindings accessor for Workers (R2, D1, AI)
 * 2. Environment detection (Lambda vs Workers)
 * 3. Zero-SSM configuration loading for Workers runtime
 *
 * After migration, secrets are loaded via:
 * - Wrangler secrets (wrangler secret put)
 * - Environment variables in wrangler.jsonc vars section
 */

// Cloudflare API token permissions needed
export interface RequiredTokenPermissions {
  account: {
    id: string;
    name: string;
  };
  zones: Array<{ id: string; name: string }>;
  permissions: string[];
}

// Environment bindings type (for Workers runtime)
export interface CloudflareEnv {
  // R2 Buckets
  ASSETS_BUCKET: R2Bucket;
  MEDIA_BUCKET: R2Bucket;
  ANALYTICS_BUCKET: R2Bucket;
  DATALAKE_BUCKET: R2Bucket;

  // D1 Database
  AUTH_DB: D1Database;

  // Workers AI
  AI: Ai;

  // Analytics Engine
  ANALYTICS: AnalyticsEngineDataset;

  // Email
  EMAIL: SendEmail;

  // Secrets (injected via Wrangler secrets)
  SESSION_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  SLACK_WEBHOOK_URL?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
  ANTHROPIC_API_KEY?: string;

  // Environment Variables
  ENVIRONMENT?: "production" | "staging";
  API_VERSION?: "v1.0";
  NEXT_PUBLIC_AUTH_PROVIDER?: "d1";
  NEXT_PUBLIC_SITE_URL?: string;
  APP_VERSION?: string;
}

// Detect if running in Cloudflare Workers
export function isCloudflareWorkers(): boolean {
  const g = globalThis as unknown as Record<string, unknown>;
  return (
    typeof g.Navigator === "undefined" &&
    typeof g.WebSocket === "undefined" &&
    typeof g.caches !== "undefined"
  );
}

// Get configuration based on environment
export function getCloudflareConfig() {
  if (!isCloudflareWorkers()) {
    return null; // Running on Lambda or locally
  }

  // Workers environment - access via global env
  // This would be set in the Worker's fetch handler via the env parameter
  const g = globalThis as unknown as Record<string, unknown>;
  return {
    getR2Binding: (name: "ASSETS_BUCKET" | "ANALYTICS_BUCKET") => {
      // This is called inside fetch() where env is available
      // Return the binding for use
      const r2 = g.__R2__ as Record<string, R2Bucket> | undefined;
      return r2?.[name];
    },
    getD1Binding: () => {
      return g.__D1__ as D1Database | undefined;
    },
    getAIBinding: () => {
      return g.__AI__ as Ai | undefined;
    },
  };
}

// Helper for Workers to validate required secrets
export function validateRequiredSecrets(env: CloudflareEnv): string[] {
  // Note: AUTH_SECRET is deprecated, using SESSION_SECRET instead
  const required = ["SESSION_SECRET"];
  return required.filter((k) => !env[k as keyof CloudflareEnv]);
}

// Session management for Workers
export function createSessionHeaders(sessionId: string): Headers {
  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    `session_token=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`
  );
  return headers;
}
