/**
 * Next.js instrumentation — runs once per server instance and must finish
 * before the process accepts requests (Next 16 gates the request handler on
 * `register()`). A hanging bind here makes Playwright's `/api/health` probe
 * time out for the full webServer timeout.
 *
 * Local next-dev: optionally bind wrangler D1 (AUTH_DB). Production: Sentry
 * + a SHA-deduped Slack deploy ping.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

/** Tracks the last SHA that sent a deploy notification (module-level dedup). */
let lastNotifiedVersion: string | undefined;

const REMOTE_BIND_TIMEOUT_MS = 5_000;
const LOG_PREFIX = "[Instrumentation]";

/**
 * Remote OpenNext bind needs a Cloudflare token and a live API. CI, E2E, and
 * tokenless `next dev` must skip it — otherwise wrangler starts a remote
 * proxy session that never becomes ready and `register()` never resolves.
 */
export function shouldBindRemoteAuthDb(): boolean {
  if (process.env.NEXT_RUNTIME !== "nodejs") return false;
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.CI === "true") return false;
  if (process.env.NEXT_PUBLIC_E2E === "1") return false;
  if (process.env.AUTH_DB_PREFER_LOCAL === "1") return false;
  if (!process.env.CLOUDFLARE_API_TOKEN) return false;
  return true;
}

function timeoutReject(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref?.();
  });
}

async function bindRemoteAuthDb(): Promise<void> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await Promise.race([
    getCloudflareContext({ async: true }),
    timeoutReject(
      REMOTE_BIND_TIMEOUT_MS,
      `getCloudflareContext timed out after ${REMOTE_BIND_TIMEOUT_MS}ms`
    ),
  ]);
  const authDb = (env as { AUTH_DB?: { prepare: (q: string) => unknown } } | undefined)?.AUTH_DB;
  if (authDb && typeof authDb.prepare === "function") {
    (globalThis as { __AUTH_DB__?: typeof authDb }).__AUTH_DB__ = authDb;
    (process as unknown as { env: { AUTH_DB?: typeof authDb } }).env.AUTH_DB = authDb;
    console.warn(`${LOG_PREFIX} AUTH_DB bound for local D1 auth`);
  } else {
    console.warn(`${LOG_PREFIX} AUTH_DB missing from Cloudflare context`);
  }
}

async function fireDeployNotification(): Promise<void> {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
  const stage = process.env.SST_STAGE ?? process.env.NODE_ENV ?? "production";
  if (version === "unknown" || version === lastNotifiedVersion) return;
  lastNotifiedVersion = version;
  const { slackDeployNotify } = await import("@/lib/slack-notify");
  slackDeployNotify({ version, stage, status: "succeeded", commitSha: version }).catch((err) =>
    console.warn(`${LOG_PREFIX} slackDeployNotify failed:`, err)
  );
}

export async function register() {
  if (process.env.NODE_ENV === "development") {
    if (process.env.NEXT_RUNTIME === "nodejs" && shouldBindRemoteAuthDb()) {
      try {
        await bindRemoteAuthDb();
      } catch (err) {
        const { isCloudflareApiHostError } = await import("@/lib/is-cloudflare-api-host-error");
        if (isCloudflareApiHostError(err)) {
          console.warn(
            `${LOG_PREFIX} Cloudflare remote context unavailable — auth will use local D1 sqlite fallback`
          );
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`${LOG_PREFIX} Local AUTH_DB bind failed:`, msg);
        }
      }
    }
    return;
  }

  // Sentry's require-in-the-middle patcher breaks under Turbopack dev
  // (chunk-hashed names cannot be resolved at runtime). Production webpack
  // / standalone builds are fine — see sentry.server.config skipOpenTelemetrySetup.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    await fireDeployNotification();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
