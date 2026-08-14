export const dynamic = "force-dynamic";

export async function GET() {
  // Bracket access avoids Next build-time inlining of process.env.APP_VERSION.
  const env = globalThis.process?.env;
  const version =
    env?.["APP_VERSION"]?.trim() || env?.["NEXT_PUBLIC_APP_VERSION"]?.trim() || "0.1.0";
  const useLiveHttp = env?.["AUTH_DB_USE_HTTP"] === "1";

  let dbConnected = false;
  try {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    let db = getAuthDbFromEnv();
    // Only fall back to local sqlite when not forced onto live D1.
    if (!db && process.env.NODE_ENV === "development" && !useLiveHttp) {
      const { getLocalAuthDb } = await import("@/lib/auth-db-local");
      db = getLocalAuthDb();
    }
    if (db) {
      const row = await db.prepare("SELECT 1 as ok").first<{ ok?: unknown }>();
      dbConnected = Number(row?.ok) === 1;
    }
  } catch {
    dbConnected = false;
  }

  return globalThis.Response.json(
    {
      status: dbConnected ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version,
      authProvider: "d1",
      authDb: useLiveHttp ? "d1-http" : "local-or-binding",
      dbConnected,
    },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } }
  );
}
