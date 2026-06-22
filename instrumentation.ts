export async function register() {
  // Sentry's require-in-the-middle module patcher breaks under Turbopack dev
  // (chunk-hashed names cannot be resolved at runtime). Production webpack
  // builds are unaffected — see sentry.server.config skipOpenTelemetrySetup.
  if (process.env.NODE_ENV === "development") return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
