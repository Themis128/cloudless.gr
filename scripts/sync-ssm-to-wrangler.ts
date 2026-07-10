// Sync secrets from AWS SSM Parameter Store to Wrangler secrets
// Usage: pnpm tsx scripts/sync-ssm-to-wrangler.ts --env=production

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ENV = process.argv.includes("--env=staging") ? "staging" : "production";
const SSM_PREFIX = ENV === "production" ? "/cloudless/production" : "/cloudless/staging";

const ssm = new SSMClient({ region: "us-east-1" });

// Secrets that need to be synced from SSM to Wrangler
const SECRET_MAPPING: Record<string, string> = {
  // SSM parameter name -> Wrangler secret binding name
  "STRIPE_SECRET_KEY": "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET": "STRIPE_WEBHOOK_SECRET",
  "AUTH_SECRET": "AUTH_SECRET",
  "SLACK_WEBHOOK_URL": "SLACK_WEBHOOK_URL",
  "SLACK_BOT_TOKEN": "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET": "SLACK_SIGNING_SECRET",
  "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY",
  "SESSION_SECRET": "SESSION_SECRET",
  "AGENT_AUTH_TOKEN": "AGENT_AUTH_TOKEN",
};

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