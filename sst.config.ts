/**
 * SST Configuration for Cloudflare deployment
 *
 * ⚠️ DEPRECATED: This config has been migrated to SST + Cloudflare.
 * The legacy AWS resources below are kept only for backward compatibility.
 *
 * Production deployments use `sst.config.cloudflare.ts` which deploys to:
 * - Cloudflare Workers (Next.js app)
 * - D1 Database (auth + data)
 * - R2 Buckets (object storage)
 * - Workers KV (config cache)
 *
 * AWS services (Cognito, DynamoDB, SSM, SES, Bedrock) have been migrated:
 * - Cognito → D1 auth (src/lib/auth-d1.ts)
 * - DynamoDB → D1 tables (user-auth-db)
 * - SSM → D1 app_config + Wrangler secrets
 * - SES → Resend / Cloudflare Email Service
 * - Bedrock → Workers AI
 */

const STAGE_PRODUCTION = "production";

export default {
  app(input) {
    const stage = input?.stage ?? "";
    return {
      name: "cloudless",
      removal: input?.stage === STAGE_PRODUCTION ? "retain" : "remove",
      protect: [STAGE_PRODUCTION].includes(input?.stage ?? ""),
      // NOTE: home: "cloudflare" is now the default for new deployments
      home: "cloudflare",
    };
  },
  async run() {
    // =========================================================================
    // DEPRECATED - AWS resources migrated to Cloudflare
    // =========================================================================
    // ALL AWS services have been migrated to Cloudflare equivalents.
    // See docs/cloudflare/aws-to-cloudflare-migration.md for details.
    //
    // The active deployment config is in sst.config.cloudflare.ts
    // =========================================================================

    return {
      message: "AWS resources migrated to Cloudflare. See sst.config.cloudflare.ts for active config.",
    };
  },
};