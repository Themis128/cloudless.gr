/**
 * Cron Invoker - Works in both AWS (SSM) and Cloudflare (D1/Workers) environments
 *
 * This module handles cron job invocation in both environments:
 *
 * - AWS Lambda (sst.config.ts): Fetches CRON_SECRET from SSM and calls the API route
 * - Cloudflare Workers (sst.config.cf-infra.ts): CRON_SECRET is passed via environment variable
 *
 * Workers Cron schedules invoke the Worker's fetch() handler directly - no separate
 * invoker needed. The CRON_ROUTE env var indicates which cron job to run.
 *
 * For Workers: The routing happens in src/index.ts handleCronRoute() which:
 * 1. Detects CRON_ROUTE environment variable
 * 2. Verifies CRON_SECRET from Wrangler secrets
 * 3. Routes to the appropriate /api/cron/* endpoint via ASSETS.fetch()
 */

// Detect Cloudflare Workers environment
function isWorkersEnvironment(): boolean {
  return typeof (globalThis as unknown as Record<string, string | undefined>).caches !== "undefined";
}

/**
 * Get CRON_SECRET from environment (Workers) or SSM (AWS/Lambda).
 * In Workers, this is set via Wrangler secret.
 * In Lambda, this reads from SSM.
 */
async function getCronSecret(): Promise<string> {
  // Workers environment - CRON_SECRET is a Wrangler secret
  if (isWorkersEnvironment()) {
    return process.env.CRON_SECRET || "";
  }

  // AWS Lambda environment - fetch from SSM
  const { SSMClient, GetParameterCommand } = await import("@aws-sdk/client-ssm");
  const ssm = new SSMClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  const ssmPrefix = process.env.SSM_PREFIX ?? "/cloudless/production";

  try {
    const { Parameter } = await ssm.send(
      new GetParameterCommand({
        Name: `${ssmPrefix}/CRON_SECRET`,
        WithDecryption: true,
      }),
    );
    return Parameter?.Value ?? "";
  } catch (err) {
    console.error("[cron-invoker] Failed to fetch CRON_SECRET from SSM:", err);
    return "";
  }
}

/**
 * Invoke the cron endpoint with proper authorization.
 * Used in AWS Lambda cron jobs.
 */
export async function handler(): Promise<{ statusCode: number; route: string; payload: unknown }> {
  const siteUrl = process.env.SITE_URL;
  const route = process.env.CRON_ROUTE;

  if (!siteUrl || !route) {
    throw new Error(`Missing env: SITE_URL=${siteUrl}, CRON_ROUTE=${route}`);
  }

  const secret = await getCronSecret();
  if (!secret) {
    throw new Error("CRON_SECRET not available");
  }

  const res = await fetch(`${siteUrl}${route}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cron ${route} responded ${res.status}: ${body.slice(0, 200)}`);
  }

  const payload = await res.json().catch(() => null);
  return { statusCode: res.status, route, payload };
}