/* global $config, D1, R2, Cron */

/// <reference path="./.sst/platform/config.d.ts" />

// Note: SST v4 does not have native Cloudflare provider support.
// The D1 database and R2 buckets are already configured in wrangler.jsonc.
// This config is kept for reference but deployment should use Wrangler directly.
// 
// For future Cloudflare infrastructure, use:
// - wrangler CLI for D1/R2 operations
// - sst.config.ts for AWS resources (Next.js, Lambda, etc.)

const STAGE_PRODUCTION = "production";

export default $config({
  app(input) {
    const stage = input?.stage ?? "development";
    return {
      name: "cloudless-infra",
      home: "aws", // Changed from cloudflare - SST v4 uses AWS as default
      removal: [STAGE_PRODUCTION].includes(stage) ? "retain" : "remove",
      protect: [STAGE_PRODUCTION].includes(stage),
    };
  },

  async run() {
    // This config is a placeholder - actual Cloudflare infra is managed via Wrangler
    // See wrangler.jsonc for R2 buckets and D1 database configuration
    
    // For reference, the configured resources are:
    // D1: user-auth-db (production) / auth-db-{stage} (other stages)
    // R2: cloudless-assets, app-media-bucket, cloudless-analytics, datalake-bucket
    
    return {
      // No resources to create - using existing Wrangler-managed infrastructure
      // The workflow will:
      // 1. Deploy SST AWS resources (if any needed in future)
      // 2. Apply D1 migrations via Wrangler
      // 3. Set CRON_SECRET via Wrangler
    };
  },
});