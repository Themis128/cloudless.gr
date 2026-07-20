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
    // Uses SST's built-in domain handling with redirects support
    const domainConfig = $app.stage === STAGE_PRODUCTION
      ? {
          name: "cloudless.gr",
          redirects: ["www.cloudless.gr"],
        }
      : undefined;

    // Build the Next.js app with OpenNext before SST deploys
    await $cli.run("pnpm exec opennextjs-cloudflare build --skipWranglerConfigCheck", {
      stage: $app.stage,
    });

    const mainApp = new sst.cloudflare.Worker("MainNextApp", {
      // OpenNext outputs to _worker-next directory
      handler: "./_worker-next/_worker.js",
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
        ANALYTICS_WORKER_URL: analyticsWorker.url,
      },
      domain: domainConfig,
    });

    // =========================================================================
    // 4. Cron Jobs (production only)
    // =========================================================================
    if ($app.stage === STAGE_PRODUCTION) {
      // Daily 01:00 UTC — flush event queue, weekly rollup, archive old events
      new sst.cloudflare.Cron("AnalyticsRollup", {
        schedule: "0 1 * * *",
        job: {
          handler: "./src/lambda/cron-invoker.ts",
        },
      });

      // Weekdays 06:00 UTC (≈08:00-09:00 Athens) — Google Calendar daily agenda to Slack
      new sst.cloudflare.Cron("CalendarDigest", {
        schedule: "0 6 ? * MON-FRI *",
        job: {
          handler: "./src/lambda/cron-invoker.ts",
        },
      });

      // Sunday 02:00 UTC — delete generated reports older than 90 days
      new sst.cloudflare.Cron("ReportCleanup", {
        schedule: "0 2 ? * SUN *",
        job: {
          handler: "./src/lambda/cron-invoker.ts",
        },
      });

      // Monday 05:00 UTC (≈07:00-08:00 Athens) — assemble + store weekly voice brief
      new sst.cloudflare.Cron("VoiceBrief", {
        schedule: "0 5 ? * MON *",
        job: {
          handler: "./src/lambda/cron-invoker.ts",
        },
      });
    }

    return {
      mainUrl: "https://cloudless.gr",
      analyticsUrl: analyticsWorker.url,
      workerUrl: mainApp.url,
    };
  },
}) satisfies sst.Config;
