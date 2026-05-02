/**
 * Next.js Instrumentation — runs once on server startup (Lambda cold start).
 *
 * Loads secrets from AWS SSM Parameter Store into process.env so that
 * integrations.ts (which reads process.env) works in Lambda without
 * passing every secret through the SST environment block.
 *
 * Non-secret env vars (DB IDs, public keys) are set directly in sst.config.ts.
 * Secrets (API keys, webhook secrets) live in SSM under /cloudless/<stage>/.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the server (Lambda), not during build or in the browser
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip in local dev — .env.local already has everything
  if (process.env.NODE_ENV === "development") return;

  // Skip if SSM_PREFIX isn't set (shouldn't happen in SST deploys)
  const prefix = process.env.SSM_PREFIX;
  if (!prefix) return;

  try {
    const { SSMClient, GetParametersByPathCommand } =
      await import("@aws-sdk/client-ssm");
    const ssm = new SSMClient({
      region: process.env.AWS_REGION ?? "us-east-1",
    });

    const params = new Map<string, string>();
    let nextToken: string | undefined;

    do {
      const cmd = new GetParametersByPathCommand({
        Path: prefix,
        WithDecryption: true,
        NextToken: nextToken,
      });
      const res = await ssm.send(cmd); // NOSONAR — SSM pagination requires sequential reads (NextToken cursor)

      for (const p of res.Parameters ?? []) {
        const key = p.Name?.replace(`${prefix}/`, "") ?? "";
        if (key && p.Value) params.set(key, p.Value);
      }

      nextToken = res.NextToken;
    } while (nextToken);

    // Inject SSM secrets into process.env (only if not already set)
    // This makes them available to integrations.ts / getIntegrations()
    for (const [key, value] of params) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }

    console.warn(
      `[Instrumentation] Loaded ${params.size} SSM parameters from ${prefix}`,
    );
  } catch (err) {
    console.error("[Instrumentation] Failed to load SSM parameters:", err);
    // Don't throw — let the app start anyway; individual features will
    // degrade gracefully when isConfigured() returns false.
  }
}
