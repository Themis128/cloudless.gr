#!/usr/bin/env tsx
// Script to check and validate GitHub secrets needed for deployment

interface SecretInfo {
  name: string;
  required: boolean;
  description: string;
  value?: string; // Pre-known values
}

const secrets: SecretInfo[] = [
  {
    name: "CLOUDFLARE_API_TOKEN",
    required: true,
    description: "API token for SST deployment to Cloudflare",
  },
  {
    name: "CF_ACCOUNT_ID",
    required: true,
    description: "Cloudflare account ID",
  },
  {
    name: "CRON_SECRET",
    required: true,
    description: "Shared secret for cron job authorization",
    value: "3a0761c6c112e74b0e9a9692f864eb071d3fe6638fb3e042a348d0d5ccd429c4",
  },
  // Already configured secrets
  {
    name: "SESSION_SECRET",
    required: true,
    description: "Session signing secret (32+ bytes)",
  },
  {
    name: "ADMIN_ALERT_SECRET",
    required: false,
    description: "Admin alert webhook secret",
  },
  {
    name: "ESPOCRM_API_KEY",
    required: false,
    description: "EspoCRM API key",
  },
  {
    name: "ESPOCRM_API_PASSWORD",
    required: false,
    description: "EspoCRM API password",
  },
  {
    name: "SLACK_WEBHOOK_URL",
    required: false,
    description: "Slack notification webhook",
  },
  {
    name: "POSTIZ_API_KEY",
    required: false,
    description: "Postiz social publishing API key",
  },
  {
    name: "TS_CLIENT_ID",
    required: false,
    description: "Tailscale OAuth client ID",
  },
  {
    name: "TS_CLIENT_SECRET",
    required: false,
    description: "Tailscale OAuth client secret",
  },
  {
    name: "TS_AUTHKEY",
    required: false,
    description: "Tailscale auth key",
  },
  {
    name: "OMV_SSH_KEY",
    required: false,
    description: "SSH key for omv node access",
  },
];

console.log("🔐 Cloudless.gr Secret Configuration Checker");
console.log("============================================\n");

console.log("### SST Infrastructure Deployment Secrets ###\n");

for (const secret of secrets) {
  const marker = secret.required ? "✅ REQUIRED" : "⚪ OPTIONAL";
  const knownValue = secret.value ? ` (pre-known: ${secret.value.substring(0, 8)}...)` : "";

  console.log(`${marker} ${secret.name}${knownValue}`);
  console.log(`   ${secret.description}`);

  if (secret.value && secret.name === "CRON_SECRET") {
    console.log(`   📋 Ready to add: https://github.com/Themis128/cloudless.gr/settings/secrets/actions/new`);
  } else if (secret.required && secret.name === "CF_ACCOUNT_ID") {
    console.log(`   📋 Get from: https://dash.cloudflare.com (right sidebar)`);
  } else if (secret.required && secret.name === "CLOUDFLARE_API_TOKEN") {
    console.log(`   📋 Create at: https://dash.cloudflare.com/profile/api-tokens`);
  }
  console.log("");
}

console.log("### Deployment Commands ###\n");
console.log("# After adding secrets, run deployment:");
console.log("gh workflow run .github/workflows/sst-infra-deploy.yml --repo Themis128/cloudless.gr");
console.log("");
console.log("# Or deploy manually:");
console.log("pnpm sst:infra:deploy");
console.log("npx wrangler d1 migrations apply user-auth-db --config wrangler.jsonc");
console.log("echo '3a0761c6c112e74b0e9a9692f864eb071d3fe6638fb3e042a348d0d5ccd429c4' | npx wrangler secret put CRON_SECRET --config wrangler.jsonc");