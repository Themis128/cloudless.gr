/**
 * Next.js Instrumentation — runs once on server startup.
 *
 * Local dev: binds wrangler D1 (AUTH_DB) so email/password auth works without Cognito.
 * Production: fires a Slack deploy notification on first cold start after a new deploy.
 * Uses NEXT_PUBLIC_APP_VERSION (git SHA) as a fingerprint so repeated cold starts of
 * the same version don't send duplicate notifications.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

/** Tracks the last SHA that sent a deploy notification (module-level dedup). */
let lastNotifiedVersion: string | undefined;

async function fireDeployNotification(): Promise<void> {
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
  // Only run on the server (Node / Workers), not during build or in the browser
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Local next-dev: bind wrangler D1 (AUTH_DB) so email/password auth works
  // without Cognito. OpenNext's config-time init does not always land in the
  // request process — re-resolve here via async getCloudflareContext.
  if (process.env.NODE_ENV === "development") {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { env } = await getCloudflareContext({ async: true });
      const authDb = (env as { AUTH_DB?: { prepare: (q: string) => unknown } } | undefined)
        ?.AUTH_DB;
      if (authDb && typeof authDb.prepare === "function") {
        (globalThis as { __AUTH_DB__?: typeof authDb }).__AUTH_DB__ = authDb;
        (process as unknown as { env: { AUTH_DB?: typeof authDb } }).env.AUTH_DB = authDb;
        console.warn("[Instrumentation] AUTH_DB bound for local D1 auth");
      } else {
        console.warn("[Instrumentation] AUTH_DB missing from Cloudflare context");
      }
    } catch (err) {
      console.warn("[Instrumentation] Local AUTH_DB bind failed:", err);
    }
    return;
  }

  await fireDeployNotification();
}
