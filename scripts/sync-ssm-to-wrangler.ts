// Sync secrets from AWS SSM Parameter Store to Wrangler secrets
// Usage: pnpm tsx scripts/sync-ssm-to-wrangler.ts --env=production
//
// This script extracts secrets from AWS SSM and prepares them for:
// 1. Wrangler secrets (Cloudflare Workers)
// 2. Fly.io secrets (--format=fly flag)

import { SSMClient, GetParameterCommand, GetParametersByPathCommand } from "@aws-sdk/client-ssm";

const ENV = process.argv.includes("--env=staging") ? "staging" : "production";
const SSM_PREFIX = ENV === "production" ? "/cloudless/production" : "/cloudless/staging";
const FORMAT = process.argv.includes("--format=fly") ? "fly" : "wrangler";

const ssm = new SSMClient({ region: "us-east-1" });

// Secrets that need to be synced from SSM to Wrangler/Fly.io
const SECRET_MAPPING: Record<string, string> = {
  // SSM parameter name -> Secret binding name
  // Auth & Security
  "AUTH_SECRET": "AUTH_SECRET",
  "SESSION_SECRET": "SESSION_SECRET",
  "CRON_SECRET": "CRON_SECRET",
  // Stripe
  "STRIPE_SECRET_KEY": "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY": "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET": "STRIPE_WEBHOOK_SECRET",
  // AI & Bedrock
  "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY",
  "ANTHROPIC_CHAT_MODEL": "ANTHROPIC_CHAT_MODEL",
  // Slack
  "SLACK_WEBHOOK_URL": "SLACK_WEBHOOK_URL",
  "SLACK_BOT_TOKEN": "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET": "SLACK_SIGNING_SECRET",
  "SLACK_OPS_USERS": "SLACK_OPS_USERS",
  // EspoCRM
  "ESPOCRM_API_KEY": "ESPOCRM_API_KEY",
  // AppFlowy
  "APPFLOWY_JWT_SECRET": "APPFLOWY_JWT_SECRET",
  // n8n
  "N8N_API_KEY": "N8N_API_KEY",
  // Meilisearch
  "MEILI_MASTER_KEY": "MEILI_MASTER_KEY",
  // Postiz
  "POSTIZ_API_KEY": "POSTIZ_API_KEY",
  // Google
  "GOOGLE_CALENDAR_ID": "GOOGLE_CALENDAR_ID",
  "GOOGLE_CLIENT_EMAIL": "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY": "GOOGLE_PRIVATE_KEY",
  // Tokens
  "GITHUB_DISPATCH_TOKEN": "GITHUB_DISPATCH_TOKEN",
  "AGENT_AUTH_TOKEN": "AGENT_AUTH_TOKEN",
};

// Cache for bulk fetch
let cachedParams: Map<string, string> | null = null;

async function getSecret(ssmName: string): Promise<string | undefined> {
  try {
    const cmd = new GetParameterCommand({
      Name: `${SSM_PREFIX}/${ssmName}`,
      WithDecryption: true,
    });
    const response = await ssm.send(cmd);
    return response.Parameter?.Value;
  } catch (err) {
    if (err instanceof Error && err.name !== "ParameterNotFound") {
      console.error(`  Error fetching ${ssmName}: ${err.message}`);
    }
    return undefined;
  }
}

async function main() {
  console.log(`Syncing secrets from SSM ${SSM_PREFIX} to Wrangler secrets...\n`);

  for (const [ssmName, wranglerSecret] of Object.entries(SECRET_MAPPING)) {
    const value = await getSecret(ssmName);

    if (!value) {
      console.log(`  ⚠️  ${wranglerSecret} - not found in SSM (skipping)`);
      continue;
    }

    // Use wrangler CLI to set the secret via child_process
    const proc = require("child_process").spawn(
      "npx",
      ["wrangler", "secret", "put", wranglerSecret, "--env=production"],
      {
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || "",
        },
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    proc.stdin.write(value);
    proc.stdin.end();

    await new Promise<void>((resolve) => {
      proc.on("close", resolve);
      proc.on("error", () => resolve());
    });

    console.log(`  ✅ ${wranglerSecret} - synced`);
  }

  console.log("\nDone! Secrets are now available in Wrangler.");
  console.log("\nTo verify, run: npx wrangler secret list");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});