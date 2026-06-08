/* global $app, sst, aws */

/// <reference path="./.sst/platform/config.d.ts" />

const STAGE_PRODUCTION = "production";

/**
 * Lambda runtime environment for the Next.js site.
 *
 * Hoisted out of run() so the function stays under the cyclomatic /
 * line-count limit. Returned object is passed verbatim to
 * sst.aws.Nextjs.environment — no Pulumi inputs are wrapped here, so
 * the Output<string> for the DynamoDB table name is passed through.
 */
function buildSiteEnvironment(
  stage: string,
  isProd: boolean,
  stripeTransactionsTableName: $util.Output<string>,
  authSecret?: $util.Output<string>,
) {
  return {
    // next-auth requires AUTH_SECRET as an env var (reads synchronously at
    // module load, before SSM can be async-fetched).
    ...(authSecret ? { AUTH_SECRET: authSecret } : {}),
    // Lambda runs behind CloudFront — next-auth needs to trust the
    // X-Forwarded-Host header to construct correct callback URLs.
    AUTH_TRUST_HOST: "true",
    AUTH_URL: isProd ? "https://cloudless.gr" : `https://${stage}.cloudless.gr`,
    NODE_ENV: "production",
    SSM_PREFIX: isProd ? "/cloudless/production" : `/cloudless/${stage}`,
    // AWS_REGION is set automatically by Lambda — do not override it
    NEXT_PUBLIC_SITE_URL: isProd
      ? "https://cloudless.gr"
      : `https://${stage}.cloudless.gr`,
    NEXT_PUBLIC_STAGE: stage,
    // Carry the deploy SHA into runtime so /api/health.version reports
    // what's actually deployed (instead of the static "0.1.0" fallback
    // in src/app/api/health/route.ts). Used by scripts/detect-sha-drift
    // to compare cloud actual vs SSM expected.
    APP_VERSION: process.env.GITHUB_SHA ?? "local",
    STRIPE_TRANSACTIONS_TABLE: stripeTransactionsTableName,
    // AWS Cognito — replaces Keycloak. Public values baked into the client
    // bundle; the user pool ID and Hosted UI domain are non-secret constants.
    // The app client ID is injected at deploy time (process.env, sourced from
    // the NEXT_PUBLIC_COGNITO_CLIENT_ID GitHub secret / SSM) because it is
    // provisioned per-environment.
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: "us-east-1_1Bq3Mpqer",
    NEXT_PUBLIC_COGNITO_DOMAIN:
      "https://cloudless-auth.auth.us-east-1.amazoncognito.com",
    NEXT_PUBLIC_COGNITO_CLIENT_ID:
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "",
    // Server-side only (JWT issuer for proxy.ts + api-auth.ts + next-auth
    // Cognito provider). AWS_REGION is set automatically by Lambda.
    COGNITO_USER_POOL_ID: "us-east-1_1Bq3Mpqer",
    // COGNITO_CLIENT_ID and COGNITO_CLIENT_SECRET loaded from SSM at runtime
    // by ssm-config.ts (the app client is provisioned per-environment).
    // AUTH_SECRET injected from SSM at deploy time (above).
    // Notion database IDs (non-secret, safe to inline)
    NOTION_BLOG_DB_ID: "0ac591657ee44063bbbc8004ea7ccd6c",
    NOTION_SUBMISSIONS_DB_ID: "9abe0a5614d64b759d44a45cee2d0bbc",
    NOTION_DOCS_DB_ID: "b45af6ed5bb64d89b9a92a8aff4a9b29",
    NOTION_PROJECTS_DB_ID: "a9bab34b945e484fb6b0aa6034086e5c",
    NOTION_TASKS_DB_ID: "14ce4ff6c400437597b13e70ac909354",
    NOTION_ANALYTICS_DB_ID: "cc4287fcb42a42dc92a7053d6f1199c7",
    // Google Search Console site ownership verification — public token, safe to
    // inline here; moved out of layout.tsx to keep source files config-free.
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:
      "LXkyzmWrAYuY1C6XD6TKaqA31KB72xbUlkimE0vKI8w",
    // CMS databases (Testimonials, Case Studies, Services, FAQs)
    NOTION_TESTIMONIALS_DB_ID: "157ceb35d0b44661a6c67798f6d87e7b",
    NOTION_CASE_STUDIES_DB_ID: "7c50dc2403054f4a81f85b0a251ac4d7",
    NOTION_SERVICES_DB_ID: "98a4087c86704818a1dde515104c2331",
    NOTION_FAQS_DB_ID: "316acfca94f444d38c857aa765c259a2",
    // Content management databases
    NOTION_CALENDAR_DB_ID: "dcff73b9317b4ed69a450f200db0f629",
    NOTION_REPORTS_DB_ID: "3d2851e41daa4904ab0f4099a9c10d19",
  };
}

export default {
  app(input) {
    const stage = input?.stage ?? "";
    return {
      name: "cloudless",
      removal: input?.stage === STAGE_PRODUCTION ? "retain" : "remove",
      protect: [STAGE_PRODUCTION].includes(input?.stage ?? ""),
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
          defaultTags: {
            tags: {
              Project: "cloudless",
              Environment: stage || "unknown",
              Owner: "tbaltzakis",
              ManagedBy: "sst",
            },
          },
        },
      },
    };
  },
  async run() {
    // --- SSM secrets are loaded at runtime by src/lib/ssm-config.ts ---
    // Exception: AUTH_SECRET must be a Lambda env var because next-auth reads
    // it synchronously at module load before ssm-config can async-fetch from SSM.
    // We fetch it from SSM at deploy time and inject it directly.
    const authSecretParam = aws.ssm.getParameterOutput({
      name: "/cloudless/production/AUTH_SECRET",
      withDecryption: true,
    });
    const authSecret = authSecretParam.value;

    const stage = $app.stage;
    const isProd = stage === STAGE_PRODUCTION;

    const stripeTransactionsTable = new sst.aws.Dynamo("StripeTransactions", {
      fields: {
        eventId: "string",
        eventType: "string",
        tagCategory: "string",
        tagStage: "string",
        stageCategory: "string",
        eventDay: "string",
        customerId: "string",
        processingStatus: "string",
        receivedAt: "number",
      },
      primaryIndex: { hashKey: "eventId" },
      globalIndexes: {
        ByTypeAndTime: { hashKey: "eventType", rangeKey: "receivedAt" },
        ByCategoryAndTime: { hashKey: "tagCategory", rangeKey: "receivedAt" },
        ByStageAndTime: { hashKey: "tagStage", rangeKey: "receivedAt" },
        ByStageCategoryAndTime: {
          hashKey: "stageCategory",
          rangeKey: "receivedAt",
        },
        ByStatusAndTime: {
          hashKey: "processingStatus",
          rangeKey: "receivedAt",
        },
        ByDayAndTime: { hashKey: "eventDay", rangeKey: "receivedAt" },
        ByCustomerAndTime: { hashKey: "customerId", rangeKey: "receivedAt" },
      },
    });

    const site = new sst.aws.Nextjs("CloudlessSite", {
      // Domain: cloudless.gr with existing Route53 zone + ACM cert.
      // dns: false — we manage Route 53 records explicitly below to support
      // failover routing (PRIMARY=CloudFront, SECONDARY=Pi). If we left this
      // as `sst.aws.dns()`, SST would create plain alias records and clobber
      // the failover SetIdentifier on every deploy.
      domain: {
        name: isProd ? "cloudless.gr" : `${stage}.cloudless.gr`,
        redirects: isProd ? ["www.cloudless.gr"] : [],
        dns: false,
        cert: "arn:aws:acm:us-east-1:278585680617:certificate/f505905a-97b4-46b0-a2b0-fb1900f425b2",
      },
      environment: buildSiteEnvironment(
        stage,
        isProd,
        stripeTransactionsTable.name,
        authSecret,
      ),
      link: [stripeTransactionsTable],
      permissions: [
        {
          // Allow the Lambda server to invoke Bedrock Converse for the chat widget.
          // The us.* prefix is required for cross-region inference profiles.
          actions: ["bedrock:InvokeModel", "bedrock:Converse"],
          resources: [
            // Foundation model — all US regions (cross-region inference routes through any of these)
            "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0",
            "arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0",
            "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0",
            // Cross-region inference profile (us.* prefix routes to any US region)
            "arn:aws:bedrock:us-east-1:278585680617:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0",
          ],
        },
      ],
      warm: isProd ? 5 : 0,
      server: {
        memory: "512 MB",
        architecture: "arm64",
        runtime: "nodejs22.x",
        timeout: "30 seconds",
      },
      transform: {
        // Force arm64 on SST-internal functions (warmer + revalidation).
        // The server function above is already arm64; these default to x86_64.
        warmer: (args) => {
          args.architectures = ["arm64"];
        },
        revalidation: (args) => {
          args.architectures = ["arm64"];
        },
      },
      // Invalidate CloudFront cache on every deployment for fresh content
      invalidation: {
        paths: "all",
        wait: true,
      },
    });

    // ---------------------------------------------------------------------
    // Cron jobs (production only)
    // ---------------------------------------------------------------------
    // Each cron triggers src/lambda/cron-invoker.ts, which fetches
    // CRON_SECRET from SSM and POSTs to the corresponding API route.
    // Schedules are in UTC; Athens is UTC+2 (EET) / UTC+3 (EEST summer).
    if (isProd) {
      const ssmPrefix = "/cloudless/production";
      const cronJobConfig = (route: string) => ({
        handler: "src/lambda/cron-invoker.handler",
        memory: "256 MB",
        timeout: "60 seconds",
        architecture: "arm64" as const,
        runtime: "nodejs22.x" as const,
        environment: {
          SITE_URL: site.url,
          SSM_PREFIX: ssmPrefix,
          CRON_ROUTE: route,
        },
        permissions: [
          {
            actions: ["ssm:GetParameter"],
            resources: [
              `arn:aws:ssm:us-east-1:278585680617:parameter${ssmPrefix}/CRON_SECRET`,
            ],
          },
        ],
      });

      // Daily 01:00 UTC — flush event queue, weekly rollup, archive old events
      new sst.aws.Cron("CronAnalyticsRollup", {
        schedule: "cron(0 1 * * ? *)",
        job: cronJobConfig("/api/cron/analytics-rollup"),
      });

      // Weekdays 06:00 UTC (≈08:00-09:00 Athens) — Google Calendar daily agenda to Slack
      new sst.aws.Cron("CronCalendarDigest", {
        schedule: "cron(0 6 ? * MON-FRI *)",
        job: cronJobConfig("/api/cron/calendar-digest"),
      });

      // Sunday 02:00 UTC — delete generated reports older than 90 days
      new sst.aws.Cron("CronReportCleanup", {
        schedule: "cron(0 2 ? * SUN *)",
        job: cronJobConfig("/api/cron/report-cleanup"),
      });

      // Monday 05:00 UTC (≈07:00-08:00 Athens) — assemble + store weekly voice brief
      new sst.aws.Cron("CronVoiceBrief", {
        schedule: "cron(0 5 ? * MON *)",
        job: cronJobConfig("/api/cron/voice-brief"),
      });
    }

    // ---------------------------------------------------------------------
    // Route 53 failover records (production only)
    // ---------------------------------------------------------------------
    // Architecture: cloudless.gr is dual-homed.
    //   - PRIMARY: CloudFront distributions (this SST stack), health-checked
    //     against https://cloudless.gr/api/health
    //   - SECONDARY: API Gateway HTTP API → Lambda IPv6 proxy → Pi 5
    //
    // Starlink/CGNAT pivot (2026-05-02): the Pi has no public IPv4 (Starlink
    // CGNAT) but has a global IPv6. The SECONDARY path is now an APIGW HTTP
    // API (`cloudless-pi-frontend`, id `dwtp9xt4dd`) with custom domains for
    // cloudless.gr + www.cloudless.gr, fronted by a Lambda function
    // (`cloudless-pi-proxy`) that runs in a dual-stack VPC and forwards each
    // request to the Pi over IPv6 on port 18443. The Pi's current global v6
    // is kept fresh in SSM by `cloudless-ddns-updater` (every 5 min); the
    // Lambda caches the lookup with a 5 min TTL.
    //
    // SECONDARY records are bound to a dedicated R53 health check that
    // probes the APIGW frontend (NOT CloudFront) so an outage on the AWS
    // SECONDARY path itself doesn't get masked by the PRIMARY health check.
    //
    // Route 53 returns the primary while it's healthy and flips to the
    // secondary when the PRIMARY health check fails. CloudFront's hosted zone
    // ID is the well-known constant Z2FDTNDATAQYW2 for all alias records.
    // APIGW regional has its own well-known zone ID Z1UJRXOUMOOFQ8.
    if (isProd) {
      const zoneId = "Z079608614L53CC4EAZM3"; // cloudless.gr hosted zone
      const healthCheckId = "e239ad5c-dd17-40d7-8045-a153715168cf"; // PRIMARY (CloudFront)
      const secondaryHealthCheckId = "30a69f1c-8d48-49bd-9067-cabec979478b"; // SECONDARY (APIGW frontend)
      const cfZoneId = "Z2FDTNDATAQYW2";
      const apigwZoneId = "Z1UJRXOUMOOFQ8"; // APIGW regional, us-east-1
      const apexCfDomain = "d3k7muo3c6lw6s.cloudfront.net";
      const wwwCfDomain = "dgrxxatzrgxfi.cloudfront.net";
      const apexApigwDomain =
        "d-uy6dmk95il.execute-api.us-east-1.amazonaws.com";
      const wwwApigwDomain = "d-2msx2z5q7d.execute-api.us-east-1.amazonaws.com";

      // IMPORTANT — pre-deploy migration required.
      // The Route 53 records below are *adopted*, not *created*, on first
      // deploy. The `import:` resource option tells Pulumi to read state from
      // R53 instead of creating duplicates. Pulumi import ID format for
      // Route 53 records: ZONEID_NAME_TYPE_SETIDENTIFIER (underscore-sep).
      //
      // SECONDARY records (apex+www × A+AAAA, all 4 alias to APIGW) MUST be
      // pre-applied to Route 53 before `sst deploy` runs against this branch.
      // The orchestrator will land them via aws-cli prior to merging this PR.
      //
      // PRIMARY records were already migrated by PR #90.

      // Apex — PRIMARY A (CloudFront alias)
      new aws.route53.Record(
        "ApexPrimary",
        {
          zoneId,
          name: "cloudless.gr",
          type: "A",
          setIdentifier: "primary",
          failoverRoutingPolicies: [{ type: "PRIMARY" }],
          healthCheckId,
          aliases: [
            {
              name: apexCfDomain,
              zoneId: cfZoneId,
              evaluateTargetHealth: false,
            },
          ],
        },
        { import: `${zoneId}_cloudless.gr_A_primary` },
      );

      // Apex — SECONDARY A (alias to APIGW custom domain, dual-stack)
      new aws.route53.Record(
        "ApexSecondary",
        {
          zoneId,
          name: "cloudless.gr",
          type: "A",
          setIdentifier: "secondary",
          failoverRoutingPolicies: [{ type: "SECONDARY" }],
          healthCheckId: secondaryHealthCheckId,
          aliases: [
            {
              name: apexApigwDomain,
              zoneId: apigwZoneId,
              evaluateTargetHealth: true,
            },
          ],
        },
        { import: `${zoneId}_cloudless.gr_A_secondary` },
      );

      // Apex — SECONDARY AAAA (alias to APIGW custom domain, dual-stack)
      new aws.route53.Record(
        "ApexSecondaryAAAA",
        {
          zoneId,
          name: "cloudless.gr",
          type: "AAAA",
          setIdentifier: "secondary",
          failoverRoutingPolicies: [{ type: "SECONDARY" }],
          healthCheckId: secondaryHealthCheckId,
          aliases: [
            {
              name: apexApigwDomain,
              zoneId: apigwZoneId,
              evaluateTargetHealth: true,
            },
          ],
        },
        { import: `${zoneId}_cloudless.gr_AAAA_secondary` },
      );

      // Apex — PRIMARY AAAA (CloudFront alias).
      new aws.route53.Record(
        "ApexPrimaryAAAA",
        {
          zoneId,
          name: "cloudless.gr",
          type: "AAAA",
          setIdentifier: "primary",
          failoverRoutingPolicies: [{ type: "PRIMARY" }],
          healthCheckId,
          aliases: [
            {
              name: apexCfDomain,
              zoneId: cfZoneId,
              evaluateTargetHealth: false,
            },
          ],
        },
        { import: `${zoneId}_cloudless.gr_AAAA_primary` },
      );

      // www — PRIMARY A (CloudFront alias)
      new aws.route53.Record(
        "WwwPrimary",
        {
          zoneId,
          name: "www.cloudless.gr",
          type: "A",
          setIdentifier: "primary",
          failoverRoutingPolicies: [{ type: "PRIMARY" }],
          healthCheckId,
          aliases: [
            {
              name: wwwCfDomain,
              zoneId: cfZoneId,
              evaluateTargetHealth: false,
            },
          ],
        },
        { import: `${zoneId}_www.cloudless.gr_A_primary` },
      );

      // www — SECONDARY A (alias to APIGW custom domain, dual-stack)
      new aws.route53.Record(
        "WwwSecondary",
        {
          zoneId,
          name: "www.cloudless.gr",
          type: "A",
          setIdentifier: "secondary",
          failoverRoutingPolicies: [{ type: "SECONDARY" }],
          healthCheckId: secondaryHealthCheckId,
          aliases: [
            {
              name: wwwApigwDomain,
              zoneId: apigwZoneId,
              evaluateTargetHealth: true,
            },
          ],
        },
        { import: `${zoneId}_www.cloudless.gr_A_secondary` },
      );

      // www — SECONDARY AAAA (alias to APIGW custom domain, dual-stack)
      new aws.route53.Record(
        "WwwSecondaryAAAA",
        {
          zoneId,
          name: "www.cloudless.gr",
          type: "AAAA",
          setIdentifier: "secondary",
          failoverRoutingPolicies: [{ type: "SECONDARY" }],
          healthCheckId: secondaryHealthCheckId,
          aliases: [
            {
              name: wwwApigwDomain,
              zoneId: apigwZoneId,
              evaluateTargetHealth: true,
            },
          ],
        },
        { import: `${zoneId}_www.cloudless.gr_AAAA_secondary` },
      );

      // www — PRIMARY AAAA (CloudFront alias).
      new aws.route53.Record(
        "WwwPrimaryAAAA",
        {
          zoneId,
          name: "www.cloudless.gr",
          type: "AAAA",
          setIdentifier: "primary",
          failoverRoutingPolicies: [{ type: "PRIMARY" }],
          healthCheckId,
          aliases: [
            {
              name: wwwCfDomain,
              zoneId: cfZoneId,
              evaluateTargetHealth: false,
            },
          ],
        },
        { import: `${zoneId}_www.cloudless.gr_AAAA_primary` },
      );
    }

    return {
      url: site.url,
    };
  },
} satisfies sst.Config;
