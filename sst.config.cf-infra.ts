/* global $config, D1, R2, Cron */

/// <reference path="./.sst/platform/config.d.ts" />

import { D1, R2, Cron } from "sst/cloudflare";

const STAGE_PRODUCTION = "production";

/**
 * SST Cloudflare Infrastructure Config
 *
 * Deploys Cloudflare infrastructure resources separately from the main application.
 * Used in conjunction with Wrangler for Next.js Worker deployment.
 *
 * NOTE: This uses SST's output-based approach where resources are created
 * and their IDs are exported for use in Wrangler. For existing resources
 * (user-auth-db created manually), the database_id in wrangler.jsonc should
 * reference the existing database.
 */
export default $config({
  app(input) {
    const stage = input?.stage ?? "development";
    return {
      name: "cloudless-infra",
      home: "cloudflare",
      removal: [STAGE_PRODUCTION].includes(stage) ? "retain" : "remove",
      protect: [STAGE_PRODUCTION].includes(stage),
    };
  },

  async run() {
    const stage = $app.stage;
    const isProd = stage === STAGE_PRODUCTION;

    // =========================================================================
    // D1 Database - User Authentication
    // =========================================================================
    // NOTE: For production, we can either:
    // 1. Import existing database (user-auth-db already exists with migration 0006/0007)
    // 2. Create new database (SST will generate a new ID)
    // For now, we create stage-specific databases to avoid conflicts
    const authDb = new D1("AuthDb", {
      databaseName: isProd ? "user-auth-db" : `auth-db-${stage}`,
    });

    // =========================================================================
    // R2 Buckets
    // =========================================================================
    const buckets = {
      assets: new R2("AssetsBucket", {
        bucketName: isProd ? "cloudless-assets" : `cloudless-assets-${stage}`,
      }),
      media: new R2("MediaBucket", {
        bucketName: isProd ? "app-media-bucket" : `app-media-${stage}`,
      }),
      analytics: new R2("AnalyticsBucket", {
        bucketName: isProd ? "cloudless-analytics" : `cloudless-analytics-${stage}`,
      }),
      datalake: new R2("DataLakeBucket", {
        bucketName: isProd ? "datalake-bucket" : `datalake-${stage}`,
      }),
    };

    // =========================================================================
    // Scheduled Triggers (Cron Jobs) - Production only
    // =========================================================================
    // Each cron invokes the Worker's fetch handler with CRON_ROUTE set.
    // The Worker routes internally to the appropriate API endpoint.
    // Schedules are in UTC. Athens is UTC+3 (EEST) in summer / UTC+2 (EET) in winter.
    //
    // NOTE: SST Cron triggers call the Worker's fetch() method directly.
    // The CRON_ROUTE environment variable tells the Worker which cron job to execute.
    // CRON_SECRET must be set as a secret in Wrangler for authorization.
    if (isProd) {
      // Daily 01:00 UTC — analytics rollup and event archival
      new Cron("AnalyticsRollup", {
        schedule: "0 1 * * *",
        // SST Cron invokes the Worker's fetch() directly with these env vars set
        // The Worker checks for CRON_ROUTE and routes to the internal API
        environment: {
          CRON_ROUTE: "/api/cron/analytics-rollup",
        },
      });

      // Weekdays 06:00 UTC (≈09:00 Athens EEST) — Google Calendar daily digest
      new Cron("CalendarDigest", {
        schedule: "0 6 * * 1-5",
        environment: { CRON_ROUTE: "/api/cron/calendar-digest" },
      });

      // Sunday 02:00 UTC — cleanup of old generated reports
      new Cron("ReportCleanup", {
        schedule: "0 2 * * 0",
        environment: { CRON_ROUTE: "/api/cron/report-cleanup" },
      });

      // Monday 05:00 UTC (≈08:00 Athens EEST) — weekly voice brief generation
      new Cron("VoiceBrief", {
        schedule: "0 5 * * 1",
        environment: { CRON_ROUTE: "/api/cron/voice-brief" },
      });
    }

    return {
      // Export IDs and names for use in other configurations
      authDbId: authDb.id,
      authDbName: authDb.databaseName,
      assetsBucket: buckets.assets.bucketName,
      mediaBucket: buckets.media.bucketName,
      analyticsBucket: buckets.analytics.bucketName,
      datalakeBucket: buckets.datalake.bucketName,
    };
  },
});