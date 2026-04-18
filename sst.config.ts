/* global $app, sst */

/// <reference path="./.sst/platform/config.d.ts" />

export default {
  app(input) {
    return {
      name: "cloudless",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage ?? ""),
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
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
      // Domain: cloudless.gr with existing Route53 zone + ACM cert
      domain: {
        name: isProd ? "cloudless.gr" : `${stage}.cloudless.gr`,
        redirects: isProd ? ["www.cloudless.gr"] : [],
        dns: sst.aws.dns(),
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

    return {
      url: site.url,
    };
  },
} satisfies sst.Config;
