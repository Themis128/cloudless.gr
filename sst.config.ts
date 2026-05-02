/* global $app, sst, aws */

/// <reference path="./.sst/platform/config.d.ts" />

export default {
  app(input) {
    const stage = input?.stage ?? "";
    return {
      name: "cloudless",
      removal: stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(stage),
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
    const isProd = stage === "production";

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
      warm: isProd ? 5 : 0,
      server: {
        memory: "1024 MB",
        architecture: "arm64",
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
    //   - SECONDARY: Pi 5 standby at WAN 150.228.63.192 (cloudless.online HA)
    //
    // Route 53 returns the primary while it's healthy and flips to the
    // secondary when the health check fails. CloudFront's hosted zone ID is
    // the well-known constant Z2FDTNDATAQYW2 for all alias records.
    if (isProd) {
      const zoneId = "Z079608614L53CC4EAZM3"; // cloudless.gr hosted zone
      const healthCheckId = "e239ad5c-dd17-40d7-8045-a153715168cf";
      const piWanIp = "150.228.63.192";
      const cfZoneId = "Z2FDTNDATAQYW2";
      const apexCfDomain = "d3k7muo3c6lw6s.cloudfront.net";
      const wwwCfDomain = "dgrxxatzrgxfi.cloudfront.net";

      // IMPORTANT — pre-deploy migration required.
      // The Route 53 records below are *adopted*, not *created*, on first
      // deploy. Before merging this PR + running `sst deploy`, the operator
      // must run `scripts/migrate-route53-failover.sh` to atomically convert
      // the four pre-existing simple alias records (apex+www × A+AAAA) into
      // the six failover records declared here. The `import:` resource option
      // tells Pulumi to read state from R53 instead of creating duplicates
      // (which would fail with "RRSet already exists"). Pulumi import ID
      // format for Route 53 records:  ZONEID_NAME_TYPE_SETIDENTIFIER
      // (underscore-separated).
      //
      // Pi has no IPv6, so AAAA SECONDARY is intentionally omitted. While the
      // primary is healthy, AAAA resolves normally; if the primary fails,
      // dual-stack clients fall back to v4 via the A SECONDARY.

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

      // Apex — SECONDARY A (Pi A record)
      new aws.route53.Record(
        "ApexSecondary",
        {
          zoneId,
          name: "cloudless.gr",
          type: "A",
          setIdentifier: "secondary",
          failoverRoutingPolicies: [{ type: "SECONDARY" }],
          ttl: 60,
          records: [piWanIp],
        },
        { import: `${zoneId}_cloudless.gr_A_secondary` },
      );

      // Apex — PRIMARY AAAA (CloudFront alias). No SECONDARY — Pi has no v6.
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

      // www — SECONDARY A (Pi A record)
      new aws.route53.Record(
        "WwwSecondary",
        {
          zoneId,
          name: "www.cloudless.gr",
          type: "A",
          setIdentifier: "secondary",
          failoverRoutingPolicies: [{ type: "SECONDARY" }],
          ttl: 60,
          records: [piWanIp],
        },
        { import: `${zoneId}_www.cloudless.gr_A_secondary` },
      );

      // www — PRIMARY AAAA (CloudFront alias). No SECONDARY — Pi has no v6.
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
