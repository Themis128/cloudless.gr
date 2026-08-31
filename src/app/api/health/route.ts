export const dynamic = "force-dynamic";

export async function GET() {
  // Bracket access avoids Next build-time inlining of process.env.APP_VERSION.
  const env = globalThis.process?.env;
  const version =
    env?.["APP_VERSION"]?.trim() || env?.["NEXT_PUBLIC_APP_VERSION"]?.trim() || "0.1.0";
  const useLiveHttp = env?.["AUTH_DB_USE_HTTP"] === "1";

  let dbConnected = false;
  let dbResolved = false;
  let diagnostic: string | undefined;
  try {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    let db = getAuthDbFromEnv();
    dbResolved = !!db;
    // Only fall back to local sqlite when not forced onto live D1.
    if (!db && process.env.NODE_ENV === "development" && !useLiveHttp) {
      const { getLocalAuthDb } = await import("@/lib/auth-db-local");
      db = getLocalAuthDb();
      dbResolved = !!db;
    }
    if (db) {
      const row = await db.prepare("SELECT 1 as ok").first<{ ok?: unknown }>();
      dbConnected = Number(row?.ok) === 1;
    } else if (useLiveHttp) {
      diagnostic = "d1-http mode but getAuthDbFromEnv() returned null";
    }
  } catch (err) {
    dbConnected = false;
    const msg = err instanceof Error ? err.message : String(err);
    diagnostic = `dbResolved=${dbResolved} error=${msg}`;
    console.error("[health] D1 probe failed:", msg);
  }

  return globalThis.Response.json(
    {
      status: dbConnected ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version,
      authProvider: "d1",
      authDb: useLiveHttp ? "d1-http" : "local-or-binding",
      dbConnected,
      ...(diagnostic ? { diagnostic } : {}),
    },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } }
  );
}
