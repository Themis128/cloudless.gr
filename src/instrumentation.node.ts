/**
 * Node-only instrumentation. Loaded exclusively from instrumentation.ts via
 * `if (process.env.NEXT_RUNTIME === "nodejs") { await import("./instrumentation.node") }`
 * so Turbopack can drop this module from the Edge Instrumentation graph.
 *
 * @see https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code
 * @see https://github.com/vercel/next.js/issues/61728
 * @see https://github.com/vercel/next.js/issues/85938
 */

import { shouldBindRemoteAuthDb } from "./instrumentation-flags";

const REMOTE_BIND_TIMEOUT_MS = 5_000;
const LOG_PREFIX = "[Instrumentation]";

/** Tracks the last SHA that sent a deploy notification (module-level dedup). */
let lastNotifiedVersion: string | undefined;

type AuthDbBinding = { prepare: (q: string) => unknown };

function bindAuthDb(authDb: AuthDbBinding): void {
  (globalThis as { __AUTH_DB__?: AuthDbBinding }).__AUTH_DB__ = authDb;
  (process as unknown as { env: { AUTH_DB?: AuthDbBinding } }).env.AUTH_DB = authDb;
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
  const authDb = (env as { AUTH_DB?: AuthDbBinding } | undefined)?.AUTH_DB;
  if (authDb && typeof authDb.prepare === "function") {
    bindAuthDb(authDb);
    console.warn(`${LOG_PREFIX} AUTH_DB bound for local D1 auth`);
  } else {
    console.warn(`${LOG_PREFIX} AUTH_DB missing from Cloudflare context`);
  }
}

function bindLocalAuthDb(): void {
  // Computed specifier so Turbopack does not statically trace node:sqlite into
  // the Edge instrumentation graph (same pattern as auth-d1 tryLoadLocalAuthDb).
  const spec = "." + "/lib/" + ["auth", "db", "local"].join("-");
  const { getLocalAuthDb } = require(spec) as {
    getLocalAuthDb?: () => AuthDbBinding | null;
  };
  const local = getLocalAuthDb?.();
  if (local && typeof local.prepare === "function") {
    bindAuthDb(local);
    console.warn(`${LOG_PREFIX} AUTH_DB bound (local D1)`);
    return;
  }
  console.warn(`${LOG_PREFIX} AUTH_DB missing — run: pnpm d1:migrate:local`);
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

export async function registerNode(): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    // Live D1 REST: do not bind local sqlite into __AUTH_DB__, or getAuthDbFromEnv
    // would prefer it over Cloudflare user-auth-db (same DB as cloudless.gr).
    if (process.env.AUTH_DB_USE_HTTP === "1") {
      const { canUseD1Http } = await import("@/lib/d1-http");
      if (canUseD1Http()) {
        console.warn(
          `${LOG_PREFIX} AUTH_DB_USE_HTTP=1 — live D1 REST (user-auth-db), not local sqlite`
        );
        return;
      }
      console.warn(
        `${LOG_PREFIX} AUTH_DB_USE_HTTP=1 but CLOUDFLARE_ACCOUNT_ID/API_TOKEN missing — falling back to local sqlite`
      );
    }
    if (shouldBindRemoteAuthDb()) {
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
    const already = (globalThis as { __AUTH_DB__?: AuthDbBinding }).__AUTH_DB__;
    if (!already || typeof already.prepare !== "function") {
      bindLocalAuthDb();
    }
    return;
  }

  await import("../sentry.server.config");
  await fireDeployNotification();
}
