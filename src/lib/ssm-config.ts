import { GetParametersByPathCommand, SSMClient } from "@aws-sdk/client-ssm";

const SSM_PREFIX = process.env.SSM_PREFIX ?? "/cloudless/production";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface AppConfig {
  SES_FROM_EMAIL: string;
  SES_TO_EMAIL: string;
  AWS_SES_REGION: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  // Optional integrations
  SLACK_WEBHOOK_URL: string;
  HUBSPOT_API_KEY: string;
  NOTION_API_KEY: string;
  NOTION_BLOG_DB_ID: string;
  GOOGLE_CLIENT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  GOOGLE_CALENDAR_ID: string;
  AHREFS_API_KEY: string;
}

let cached: AppConfig | null = null;
let cachedAt = 0;

/**
 * Fetches all /cloudless/production/* parameters from SSM.
 * Cache expires after 5 minutes to pick up rotated secrets without redeploy.
 */
export async function getConfig(): Promise<AppConfig> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  const ssm = new SSMClient({ region: REGION });
  const params = new Map<string, string>();

  let nextToken: string | undefined;
  do {
    const res = await ssm.send(
      new GetParametersByPathCommand({
        Path: SSM_PREFIX,
        WithDecryption: true,
        NextToken: nextToken,
      }),
    );

    for (const p of res.Parameters ?? []) {
      const key = p.Name?.replace(`${SSM_PREFIX}/`, "") ?? "";
      if (key && p.Value) params.set(key, p.Value);
    }

    nextToken = res.NextToken;
  } while (nextToken);

  const required = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;
  for (const key of required) {
    if (!params.get(key)) {
      throw new Error(`Missing required SSM parameter: ${SSM_PREFIX}/${key}`);
    }
  }

  const sesFrom = params.get("SES_FROM_EMAIL") || "noreply@cloudless.gr";
  const sesTo = params.get("SES_TO_EMAIL") || "tbaltzakis@cloudless.gr";
  const sesRegion = params.get("AWS_SES_REGION") || "us-east-1";

  if (!sesFrom.includes("@") || !sesTo.includes("@")) {
    console.warn(
      `[SSM] SES email addresses look invalid — FROM: ${sesFrom}, TO: ${sesTo}. Using defaults.`,
    );
  }

  cached = {
    SES_FROM_EMAIL: sesFrom,
    SES_TO_EMAIL: sesTo,
    AWS_SES_REGION: sesRegion,
    STRIPE_SECRET_KEY: params.get("STRIPE_SECRET_KEY")!,
    STRIPE_PUBLISHABLE_KEY: params.get("STRIPE_PUBLISHABLE_KEY") ?? "",
    STRIPE_WEBHOOK_SECRET: params.get("STRIPE_WEBHOOK_SECRET")!,
    COGNITO_USER_POOL_ID: params.get("COGNITO_USER_POOL_ID") ?? "",
    COGNITO_CLIENT_ID: params.get("COGNITO_CLIENT_ID") ?? "",
    SLACK_WEBHOOK_URL: params.get("SLACK_WEBHOOK_URL") ?? "",
    HUBSPOT_API_KEY: params.get("HUBSPOT_API_KEY") ?? "",
    NOTION_API_KEY: params.get("NOTION_API_KEY") ?? "",
    NOTION_BLOG_DB_ID: params.get("NOTION_BLOG_DB_ID") ?? "",
    GOOGLE_CLIENT_EMAIL: params.get("GOOGLE_CLIENT_EMAIL") ?? "",
    GOOGLE_PRIVATE_KEY: (params.get("GOOGLE_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n"),
    GOOGLE_CALENDAR_ID: params.get("GOOGLE_CALENDAR_ID") ?? "",
    AHREFS_API_KEY: params.get("AHREFS_API_KEY") ?? "",
  };
  cachedAt = Date.now();

  return cached;
}
