/* global $config, sst, $cf */

/// <reference path="./.sst/platform/config.d.ts" />

const STAGE_PRODUCTION = "production";

export default $config({
  app(input) {
    const stage = input?.stage ?? "development";
    return {
      name: "cloudless-monorepo",
      home: "cloudflare",
      removal: [STAGE_PRODUCTION].includes(stage) ? "retain" : "remove",
      protect: [STAGE_PRODUCTION].includes(stage),
    };
  },

  async run() {
    // =========================================================================
    // 1. Deploy the Analytics Worker from monorepo workspace
    // =========================================================================
    const analyticsWorker = new sst.cloudflare.Worker("AnalyticsWorker", {
      handler: "./workers/index-analytics.ts",
      url: true,
      compatibility: {
        date: "2026-07-05",
        flags: ["nodejs_compat"],
      },
      environment: {
        ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "fb7dc7b69b662480cd5961a4d1913c78",
      },
    });

    // =========================================================================
    // 2. Deploy the Main Next.js App using OpenNext outputs
    // =========================================================================
    // Domain configuration - redirects handled by separate Cloudflare page rules
    // to avoid API permission issues during deploy
    const domainConfig = $app.stage === STAGE_PRODUCTION
      ? {
          name: "cloudless.gr",
        }
      : undefined;

    // Build the Next.js app with OpenNext before SST deploys
    // The workflow runs `pnpm run cloudflare-build` before SST deploy
    const mainApp = new sst.cloudflare.Worker("MainNextApp", {
      // OpenNext outputs to .open-next directory
      handler: "./.open-next/worker.js",
      url: true,
      link: [analyticsWorker], // Injects analytics URL into Next.js edge runtime
      compatibility: {
        date: "2024-09-23",
        flags: ["nodejs_compat"],
      },
      environment: {
        ENVIRONMENT: $app.stage,
        NEXT_PUBLIC_SITE_URL: $app.stage === STAGE_PRODUCTION
          ? "https://cloudless.gr"
          : `https://${$app.stage}.cloudless.gr`,
        // Analytics worker URL passed to main app for API integration
        ANALYTICS_WORKER_URL: analyticsWorker.url ?? "",
      },
      domain: domainConfig,
      // Exclude problematic .bin font files from @vercel/og/Geist in Next.js 16.x
      // These cause SST bundling errors: "No loader is configured for .bin files"
      files: {
        exclude: [
          "**/*.bin",
        ],
      },
    });

    // =========================================================================
    // 4. Cron Jobs (production only)
    // =========================================================================
    // Temporarily disabled to resolve SST lock issues
    // Cron jobs will be re-enabled via separate workflow after initial deployment
    // if ($app.stage === STAGE_PRODUCTION) {
    //   new sst.cloudflare.Cron(...)
    // }

    return {
      mainUrl: "https://cloudless.gr",
      analyticsUrl: analyticsWorker.url,
      workerUrl: mainApp.url,
    };
  },
});