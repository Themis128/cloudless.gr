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

import type { D1User } from "./auth-d1";

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
  ANALYTICS_BUCKET: R2Bucket;
  
  // D1 Database
  AUTH_DB: D1Database;
  
  // Workers AI
  AI: Ai;
  
  // Secrets (injected via Wrangler)
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  AUTH_SECRET?: string;
  SLACK_WEBHOOK_URL?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
}

// Detect if running in Cloudflare Workers
export function isCloudflareWorkers(): boolean {
  return typeof (globalThis as any).Navigator === "undefined" &&
    typeof (globalThis as any).WebSocket === "undefined" &&
    typeof (globalThis as any).caches !== "undefined";
}

// Detect if running in AWS Lambda (current production)
export function isLambda(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env._HANDLER) ||
    Boolean(process.env.AWS_EXECUTION_ENV);
}

// Get configuration based on environment
export function getCloudflareConfig() {
  if (!isCloudflareWorkers()) {
    return null; // Running on Lambda or locally
  }
  
  // Workers environment - access via global env
  // This would be set in the Worker's fetch handler via the env parameter
  return {
    getR2Binding: (name: "ASSETS_BUCKET" | "ANALYTICS_BUCKET") => {
      // This is called inside fetch() where env is available
      // Return the binding for use
      return (globalThis as any).__R2__?.[name];
    },
    getD1Binding: () => {
      return (globalThis as any).__D1__;
    },
    getAIBinding: () => {
      return (globalThis as any).__AI__;
    }
  };
}

// Helper for Workers to validate required secrets
export function validateRequiredSecrets(env: CloudflareEnv): string[] {
  const required = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "AUTH_SECRET"];
  return required.filter(k => !env[k as keyof CloudflareEnv]);
}

// Session management for Workers
export function createSessionHeaders(sessionId: string): Headers {
  const headers = new Headers();
  headers.set("Set-Cookie", 
    `session_token=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`
  );
  return headers;
}