/* global $app, sst, aws */

/// <reference path="./.sst/platform/config.d.ts" />

const STAGE_PRODUCTION = "production";

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
    // No need to pass STRIPE keys as env vars; the app reads them from SSM.
    // Only pass non-secret configuration that varies per stage.

    const stage = $app.stage;
    const isProd = stage === STAGE_PRODUCTION;

    const stripeTransactionsTable = new sst.aws.Dynamo("StripeTransactions", {
      fields: {
        eventId: "string",
        eventType: "string",
        tagCategory: "string",
        tagStage: "string",
        processingStatus: "string",
        receivedAt: "number",
      },
      primaryIndex: { hashKey: "eventId" },
      globalIndexes: {
        ByTypeAndTime: { hashKey: "eventType", rangeKey: "receivedAt" },
        ByCategoryAndTime: { hashKey: "tagCategory", rangeKey: "receivedAt" },
        ByStageAndTime: { hashKey: "tagStage", rangeKey: "receivedAt" },
        ByStatusAndTime: { hashKey: "processingStatus", rangeKey: "receivedAt" },
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
      environment: {
        NODE_ENV: "production",
        SSM_PREFIX: isProd ? "/cloudless/production" : `/cloudless/${stage}`,
        // AWS_REGION is set automatically by Lambda — do not override it
        NEXT_PUBLIC_SITE_URL: isProd
          ? "https://cloudless.gr"
          : `https://${stage}.cloudless.gr`,
        NEXT_PUBLIC_STAGE: stage,
        STRIPE_TRANSACTIONS_TABLE: stripeTransactionsTable.name,
        NEXT_PUBLIC_COGNITO_USER_POOL_ID: "us-east-1_JQWwFbO9a",
        NEXT_PUBLIC_COGNITO_CLIENT_ID: "2qq6i24oc48391cmuv4kfl1rm2",
        // Notion database IDs (non-secret, safe to inline)
        NOTION_BLOG_DB_ID: "0ac591657ee44063bbbc8004ea7ccd6c",
        NOTION_SUBMISSIONS_DB_ID: "9abe0a5614d64b759d44a45cee2d0bbc",
        NOTION_DOCS_DB_ID: "b45af6ed5bb64d89b9a92a8aff4a9b29",
        NOTION_PROJECTS_DB_ID: "a9bab34b945e484fb6b0aa6034086e5c",
        NOTION_TASKS_DB_ID: "14ce4ff6c400437597b13e70ac909354",
        NOTION_ANALYTICS_DB_ID: "cc4287fcb42a42dc92a7053d6f1199c7",
      },
      link: [stripeTransactionsTable],
      warm: isProd ? 5 : 0,
      server: {
        memory: "1024 MB",
        architecture: "arm64",
        runtime: "nodejs22.x",
        timeout: "30 seconds",
      },
      // Invalidate CloudFront cache on every deployment for fresh content
      invalidation: {
        paths: "all",
        wait: true,
      },
    });

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
      const apexApigwDomain = "d-uy6dmk95il.execute-api.us-east-1.amazonaws.com";
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
