export async function register() {
  // Local next-dev: bind wrangler D1 (AUTH_DB) so email/password auth works
  // without Cognito. OpenNext's config-time init does not always land in the
  // request process — resolve here via async getCloudflareContext.
  if (process.env.NODE_ENV === "development" && process.env.NEXT_RUNTIME === "nodejs") {
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

  // Sentry's require-in-the-middle module patcher breaks under Turbopack dev
  // (chunk-hashed names cannot be resolved at runtime). Production webpack
  // builds are unaffected — see sentry.server.config skipOpenTelemetrySetup.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
