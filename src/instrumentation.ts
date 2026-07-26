/**
 * Next.js Instrumentation — runs once on server startup (Lambda cold start).
 *
 * Loads secrets from AWS SSM Parameter Store into process.env so that
 * integrations.ts (which reads process.env) works in Lambda without
 * passing every secret through the SST environment block.
 *
 * Also fires a Slack deploy notification on first cold start after a new
 * deploy. Uses the app version (git SHA) as a fingerprint so that repeated
 * cold starts of the same version don't send duplicate notifications.
 *
 * Non-secret env vars (DB IDs, public keys) are set directly in sst.config.ts.
 * Secrets (API keys, webhook secrets) live in SSM under /cloudless/<stage>/.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

/** Tracks the last SHA that sent a deploy notification (module-level dedup). */
let lastNotifiedVersion: string | undefined;

async function loadSsmParams(prefix: string): Promise<Map<string, string>> {
  const ssm = new SSMClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  const params = new Map<string, string>();
  let nextToken: string | undefined;

  do {
    const res = await ssm.send(
      new GetParametersByPathCommand({
        Path: prefix,
        WithDecryption: true,
        NextToken: nextToken,
      })
    );
    for (const p of res.Parameters ?? []) {
      const key = p.Name?.replace(`${prefix}/`, "") ?? "";
      if (key && p.Value) params.set(key, p.Value);
    }
    nextToken = res.NextToken;
  } while (nextToken);

  return params;
}

async function fireDeployNotification(prefix: string, params: Map<string, string>): Promise<void> {
  console.warn(`[Instrumentation] Loaded ${params.size} SSM parameters from ${prefix}`);
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
  const stage = process.env.SST_STAGE ?? process.env.NODE_ENV ?? "production";
  if (version === "unknown" || version === lastNotifiedVersion) return;
  lastNotifiedVersion = version;
  const { slackDeployNotify } = await import("@/lib/slack-notify");
  slackDeployNotify({ version, stage, status: "succeeded", commitSha: version }).catch((err) =>
    console.warn("[Instrumentation] slackDeployNotify failed:", err)
  );
}

export async function register() {
  // Only run on the server (Lambda), not during build or in the browser
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip in local dev — .env.local already has everything
  if (process.env.NODE_ENV === "development") return;

  // Skip if SSM_PREFIX isn't set (shouldn't happen in SST deploys)
  const prefix = process.env.SSM_PREFIX;
  if (!prefix) return;

  try {
    const params = await loadSsmParams(prefix);

    // Inject SSM secrets into process.env (only if not already set)
    // This makes them available to integrations.ts / getIntegrations()
    for (const [key, value] of params) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }

    await fireDeployNotification(prefix, params);
  } catch (err) {
    console.error("[Instrumentation] Failed to load SSM parameters:", err);
    // Don't throw — let the app start anyway; individual features will
    // degrade gracefully when isConfigured() returns false.
  }
}
