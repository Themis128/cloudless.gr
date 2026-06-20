/* global $app, sst, aws */

/// <reference path="./.sst/platform/config.d.ts" />

const STAGE_PRODUCTION = "production";

/**
 * Lambda runtime environment for the Next.js site.
 *
 * Auth provider: Cognito (always-up AWS), activated by passing the `cognito`
 * argument so the Lambda env carries the COGNITO_* variables.
 */
function buildSiteEnvironment(
  stage: string,
  isProd: boolean,
  stripeTransactionsTableName: $util.Output<string>,
  userProfileTableName: $util.Output<string>,
  adminNotificationsTableName: $util.Output<string>,
  analyticsCacheTableName: $util.Output<string>,
  sessionTokenStoreTableName: $util.Output<string>,
  authSecret?: $util.Output<string>,
  cognito?: {
    issuer: $util.Output<string>;
    clientId: $util.Output<string>;
    clientSecret: $util.Output<string>;
    domain: string;
  }
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
    NEXT_PUBLIC_SITE_URL: isProd ? "https://cloudless.gr" : `https://${stage}.cloudless.gr`,
    NEXT_PUBLIC_STAGE: stage,
    // Carry the deploy SHA into runtime so /api/health.version reports
    // what's actually deployed.
    APP_VERSION: process.env.GITHUB_SHA ?? "local",
    STRIPE_TRANSACTIONS_TABLE: stripeTransactionsTableName,
    USER_PROFILE_TABLE: userProfileTableName,
    ADMIN_NOTIFICATIONS_TABLE: adminNotificationsTableName,
    ANALYTICS_CACHE_TABLE: analyticsCacheTableName,
    SESSION_TOKEN_STORE_TABLE: sessionTokenStoreTableName,
    // Cloudflare Workers AI — consumed by /api/admin/ai/generate. Passed from
    // the deploy workflow env; the route returns 503 when absent.
    ...(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN
      ? {
          CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
          CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
        }
      : {}),
    // Auth provider — Cognito (AWS). NEXT_PUBLIC_AUTH_PROVIDER drives the login button label.
    ...(cognito
      ? {
          COGNITO_ISSUER: cognito.issuer,
          COGNITO_CLIENT_ID: cognito.clientId,
          COGNITO_CLIENT_SECRET: cognito.clientSecret,
          COGNITO_DOMAIN: cognito.domain,
          NEXT_PUBLIC_AUTH_PROVIDER: "cognito",
        }
      : {}),
    // Notion database IDs (non-secret, safe to inline)
    NOTION_BLOG_DB_ID: "0ac591657ee44063bbbc8004ea7ccd6c",
    NOTION_SUBMISSIONS_DB_ID: "9abe0a5614d64b759d44a45cee2d0bbc",
    NOTION_DOCS_DB_ID: "b45af6ed5bb64d89b9a92a8aff4a9b29",
    NOTION_PROJECTS_DB_ID: "a9bab34b945e484fb6b0aa6034086e5c",
    NOTION_TASKS_DB_ID: "14ce4ff6c400437597b13e70ac909354",
    NOTION_ANALYTICS_DB_ID: "cc4287fcb42a42dc92a7053d6f1199c7",
    // Google Search Console site ownership verification — public token, safe to inline.
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "LXkyzmWrAYuY1C6XD6TKaqA31KB72xbUlkimE0vKI8w",
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

    // Provider-agnostic user-profile store (name/company/phone/preferences),
    // keyed by the OIDC `sub`. Decouples the dashboard profile from the IdP so
    // it works identically for any OIDC provider (see src/lib/user-profile.ts).
    const userProfileTable = new sst.aws.Dynamo("UserProfile", {
      fields: { userId: "string" },
      primaryIndex: { hashKey: "userId" },
    });

    // Durable admin notifications store — audit + analytics for every
    // client-facing interaction (contact, subscribe, booking, order, error,
    // auth, portal). 90-day hot retention, then archived to S3 via the
    // notifications-archive cron (see src/lib/admin-notifications.ts).
    //
    // pk = "NOTIF", sk = "<createdAt-ISO8601>#<id>"
    // GSI categoryIndex: catPk = "CAT#<category>", catSk = "<createdAt-ISO8601>#<id>"
    const adminNotificationsTable = new sst.aws.Dynamo("AdminNotifications", {
      fields: {
        pk: "string",
        sk: "string",
        catPk: "string",
        catSk: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        categoryIndex: { hashKey: "catPk", rangeKey: "catSk" },
      },
    });

    // Read-through cache for Google Search Console responses.
    //
    // GSC has per-minute / per-day / 50k-rows-per-day quotas, and every
    // admin tab open today calls 1-2 endpoints directly. This table caches
    // each (route, params) combination keyed by a deterministic hash, with
    // TTL enforced application-side. See src/lib/gsc-cache.ts.
    //
    // pk = "<route>"  e.g. "seo", "keywords", "ctr-opportunities"
    // sk = "<params-hash>"  deterministic for a given query-string
    //
    // Refreshed hourly by /api/cron/gsc-cache-refresh (PR C3).
    const analyticsCacheTable = new sst.aws.Dynamo("AnalyticsCache", {
      fields: {
        pk: "string",
        sk: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    // Session token store — keeps idToken + refreshToken out of the JWT cookie
    // to avoid hitting the 4KB cookie / CloudFront header size limit (Issue #933).
    // Keyed by userId (OIDC sub). TTL via `expiresAt` attribute (DynamoDB TTL).
    const sessionTokenStoreTable = new sst.aws.Dynamo("SessionTokenStore", {
      fields: { userId: "string" },
      primaryIndex: { hashKey: "userId" },
      ttl: "expiresAt",
    });

    // -------------------------------------------------------------------------
    // Cognito User Pool — always-up AWS auth
    //
    // Active when COGNITO_ISSUER is set in the Lambda env
    // (passed via `cognito` to buildSiteEnvironment below).
    // -------------------------------------------------------------------------
    const userPool = new aws.cognito.UserPool("CloudlessAuth", {
      name: isProd ? "cloudless-auth" : `cloudless-auth-${stage}`,
      usernameAttributes: ["email"],
      autoVerifiedAttributes: ["email"],
      passwordPolicy: {
        minimumLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireNumbers: false,
        requireSymbols: false,
        temporaryPasswordValidityDays: 7,
      },
      accountRecoverySetting: {
        recoveryMechanisms: [{ name: "verified_email", priority: 1 }],
      },
      // Self-registration enabled — Hosted UI shows "Create account" link.
      adminCreateUserConfig: { allowAdminCreateUserOnly: false },
      mfaConfiguration: "OFF",
      tags: {
        Project: "cloudless",
        Environment: stage || "unknown",
        Owner: "tbaltzakis",
        ManagedBy: "sst",
      },
    });

    // Admin group — membership gives admin access in the app.
    // isAdmin() in api-auth.ts checks cognito:groups claim for "admin".
    new aws.cognito.UserGroup("CloudlessAdminGroup", {
      userPoolId: userPool.id,
      name: "admin",
      description: "Cloudless administrators",
    });

    // Hosted UI domain (globally unique within us-east-1 Cognito).
    const hostedUiPrefix = isProd ? "cloudless-auth" : `cloudless-auth-${stage}`;
    new aws.cognito.UserPoolDomain("CloudlessAuthDomain", {
      domain: hostedUiPrefix,
      userPoolId: userPool.id,
    });

    const cognitoHostedDomain = `https://${hostedUiPrefix}.auth.us-east-1.amazoncognito.com`;

    // Compute the site base URL without a Pulumi dependency — we know it from
    // the domain config above, so we can use it in the callback URLs below
    // without creating a circular dependency between the client and the site.
    const siteBaseUrl = isProd ? "https://cloudless.gr" : `https://${stage}.cloudless.gr`;
    // Deduplicate: in production siteBaseUrl === "https://cloudless.gr".
    const callbackUrls = [
      ...new Set([
        `${siteBaseUrl}/api/auth/callback/cognito`,
        "https://cloudless.gr/api/auth/callback/cognito",
      ]),
    ];
    const logoutUrls = [...new Set([`${siteBaseUrl}/`, "https://cloudless.gr/"])];

    // Confidential app client — next-auth Cognito provider requires a secret.
    const userPoolClient = new aws.cognito.UserPoolClient("CloudlessAuthClient", {
      userPoolId: userPool.id,
      name: "cloudless-app",
      generateSecret: true,
      allowedOauthFlows: ["code"],
      allowedOauthScopes: ["openid", "email", "profile"],
      allowedOauthFlowsUserPoolClient: true,
      supportedIdentityProviders: ["COGNITO"],
      callbackUrls,
      logoutUrls,
      explicitAuthFlows: ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_SRP_AUTH"],
      accessTokenValidity: 1,
      idTokenValidity: 1,
      refreshTokenValidity: 30,
      tokenValidityUnits: {
        accessToken: "hours",
        idToken: "hours",
        refreshToken: "days",
      },
    });

    // Issuer URL: https://cognito-idp.<region>.amazonaws.com/<poolId>
    const cognitoIssuer = $util.interpolate`https://cognito-idp.us-east-1.amazonaws.com/${userPool.id}`;

    const site = new sst.aws.Nextjs("CloudlessSite", {
      // Domain: cloudless.gr, fronted by an ACM cert on CloudFront.
      // dns: false — cloudless.gr is delegated to Cloudflare (ns: fay/jihoon
      // .ns.cloudflare.com), NOT Route 53. Cloudflare owns the apex/www records
      // and HA failover (a Cloudflare Load Balancer steers AWS→Pi; see
      // scripts/setup-cloudflare-lb.sh). SST must therefore never touch DNS,
      // or it would try to create alias records in a zone it doesn't control.
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
        userProfileTable.name,
        adminNotificationsTable.name,
        analyticsCacheTable.name,
        sessionTokenStoreTable.name,
        authSecret,
        {
          issuer: cognitoIssuer,
          clientId: userPoolClient.id,
          clientSecret: userPoolClient.clientSecret.apply((s) => s ?? ""),
          domain: cognitoHostedDomain,
        }
      ),
      link: [stripeTransactionsTable, userProfileTable, adminNotificationsTable, analyticsCacheTable, sessionTokenStoreTable],
      permissions: [
        {
          // Allow the Lambda server to invoke Bedrock Converse for the chat widget.
          // The us.* prefix is required for cross-region inference profiles.
          //
          // Model: Amazon Nova Micro (switched from Claude Haiku 4.5 on
          // 2026-06-19). Haiku 4.5 needed a Bedrock Marketplace subscription
          // that was never enabled on this account; Nova Micro is already
          // active and is ~30x cheaper. See src/lib/bedrock-shared.ts for
          // the matching DEFAULT_MODEL_ID — keep these in sync.
          actions: ["bedrock:InvokeModel", "bedrock:Converse"],
          resources: [
            // Foundation model — all US regions (cross-region inference routes through any of these)
            "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0",
            "arn:aws:bedrock:us-east-2::foundation-model/amazon.nova-micro-v1:0",
            "arn:aws:bedrock:us-west-2::foundation-model/amazon.nova-micro-v1:0",
            // Cross-region inference profile (us.* prefix routes to any US region)
            "arn:aws:bedrock:us-east-1:278585680617:inference-profile/us.amazon.nova-micro-v1:0",
          ],
        },
        {
          // Admin Users page (/api/admin/users) manages Cognito accounts via the
          // AWS SDK: list users, read group membership, enable/disable, and
          // promote/demote (admin group). Scoped to this pool only. Without
          // these the route 500s with AccessDenied in Cognito production.
          actions: [
            "cognito-idp:ListUsers",
            "cognito-idp:AdminListGroupsForUser",
            "cognito-idp:AdminEnableUser",
            "cognito-idp:AdminDisableUser",
            "cognito-idp:AdminAddUserToGroup",
            "cognito-idp:AdminRemoveUserFromGroup",
          ],
          resources: [userPool.arn],
        },
      ],
      warm: isProd ? 5 : 0,
      server: {
        memory: "1024 MB",
        architecture: "arm64",
        runtime: "nodejs22.x",
        timeout: "30 seconds",
        // X-Ray active tracing — captures cold-start frequency + duration,
        // p50/p95/p99 by route, and downstream call latency (Bedrock, DDB,
        // SSM). Documented as Phase 2 in docs/SECURITY_ENHANCEMENTS_ROADMAP.md.
        // The CloudWatch SERVERLESS-APP_MAIN-Errors alarm only counts errors;
        // X-Ray segments are what actually explain them. AWS bills $5 / 1M
        // traces — at our volume that's <$0.01/mo. Sampled 5% by default;
        // bump if more detail is needed via aws xray put-sampling-rule.
        tracing: "active",
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
            resources: [`arn:aws:ssm:us-east-1:278585680617:parameter${ssmPrefix}/CRON_SECRET`],
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

      // Hourly — pre-warm the GSC AnalyticsCache for the two most common
      // ranges (7d, 28d) so the first user to open /admin/analytics on a
      // given hour gets a cache hit instead of a 2-4 s fresh GSC query.
      // See src/app/api/cron/gsc-cache-refresh/route.ts.
      new sst.aws.Cron("CronGscCacheRefresh", {
        schedule: "cron(0 * * * ? *)",
        job: cronJobConfig("/api/cron/gsc-cache-refresh"),
      });
    }

    // ---------------------------------------------------------------------
    // HA / failover
    // ---------------------------------------------------------------------
    // cloudless.gr is dual-homed for high availability:
    //   - PRIMARY:   this SST stack (CloudFront -> Lambda).
    //   - SECONDARY: the Pi/k3s cluster, reachable on the public Tailscale
    //                Funnel (omv.tail8eb71.ts.net:443), serving the SAME
    //                Next.js image.
    //
    // Failover is owned by Cloudflare (where the domain DNS lives), NOT by
    // Route 53. A Cloudflare Load Balancer health-checks /api/health and steers
    // traffic AWS -> Pi automatically. Provision/update it with
    // scripts/setup-cloudflare-lb.sh (CI: .github/workflows/cloudflare-lb.yml).
    //
    // HISTORY: a Route 53 PRIMARY/SECONDARY record set used to live here, but
    // the domain has never actually been delegated to Route 53 (it resolves via
    // Cloudflare), so those records served no real traffic. The hosted zone
    // Z079608614L53CC4EAZM3 was then deleted out-of-band on 2026-06-02, which
    // broke every sst deploy (pulumi could no longer refresh the imported
    // records). The dead block was removed in favour of the Cloudflare LB.

    return {
      url: site.url,
      cognitoUserPoolId: userPool.id,
      cognitoClientId: userPoolClient.id,
      cognitoHostedDomain,
    };
  },
} satisfies sst.Config;
