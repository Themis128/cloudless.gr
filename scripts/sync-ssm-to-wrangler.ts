#!/usr/bin/env npx tsx
/**
 * Sync AWS SSM parameters to Wrangler secrets
 * 
 * This script reads parameters from AWS SSM and pushes them to
 * Cloudflare Wrangler secrets. Run this before/during migration
 * to keep secrets in sync.
 * 
 * Usage:
 *   AWS_PROFILE=default CLOUDFLARE_API_TOKEN=xxx npx tsx scripts/sync-ssm-to-wrangler.ts
 */

import { GetParametersByPathCommand, SSMClient } from "@aws-sdk/client-ssm";
import { execSync } from "child_process";

const SSM_PREFIX = process.env.SSM_PREFIX || "/cloudless/production";
const REGION = process.env.AWS_REGION || "us-east-1";

// Secrets to migrate from SSM to Wrangler
const SECRETS_MAPPING: Record<string, string> = {
  // Stripe
  "STRIPE_SECRET_KEY": "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET": "STRIPE_WEBHOOK_SECRET",
  // Auth
  "AUTH_SECRET": "AUTH_SECRET",
  // Slack
  "SLACK_WEBHOOK_URL": "SLACK_WEBHOOK_URL",
  "SLACK_BOT_TOKEN": "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET": "SLACK_SIGNING_SECRET",
  // AI
  "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY",
  // Social APIs
  "META_ACCESS_TOKEN": "META_ACCESS_TOKEN",
  "LINKEDIN_ACCESS_TOKEN": "LINKEDIN_ACCESS_TOKEN",
  "X_ACCESS_TOKEN": "X_ACCESS_TOKEN",
  "TIKTOK_ACCESS_TOKEN": "TIKTOK_ACCESS_TOKEN",
  // Optional (may not exist)
  "GITHUB_TOKEN": "GITHUB_TOKEN",
  "SENTRY_AUTH_TOKEN": "SENTRY_AUTH_TOKEN",
};

function mapSecretName(name: string): string | null {
  // SSM: /cloudless/production/STRIPE_SECRET_KEY -> STRIPE_SECRET_KEY
  const cleanName = name.replace(`${SSM_PREFIX}/`, "");
  return SECRETS_MAPPING[cleanName] || null;
}

async function main() {
  console.log("Syncing SSM parameters to Wrangler secrets...\n");
  
  const ssm = new SSMClient({ region: REGION });
  const params = await ssm.send(
    new GetParametersByPathCommand({
      Path: SSM_PREFIX,
      WithDecryption: true,
    })
  );
  
  let synced = 0;
  let skipped = 0;
  
  for (const param of params.Parameters || []) {
    const ssName = param.Name?.replace(`${SSM_PREFIX}/`, "") ?? "";
    const wranglerName = mapSecretName(param.Name || "");
    
    if (!wranglerName) {
      skipped++;
      continue;
    }
    
    if (!param.Value) {
      console.log(`  ⚠️  ${ssName}: no value, skipping`);
      continue;
    }
    
    console.log(`  Syncing ${ssName} -> ${wranglerName}`);
    try {
      execSync(
        `echo '${param.Value}' | npx wrangler secret put ${wranglerName}`,
        { stdio: ["pipe", "pipe", "pipe"] }
      );
      synced++;
    } catch (err) {
      console.error(`  ❌ Failed to sync ${wranglerName}`);
    }
  }
  
  console.log(`\nSynced: ${synced}, Skipped: ${skipped}`);
}

main().catch(console.error);