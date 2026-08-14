export const dynamic = "force-dynamic";

export async function GET() {
  // Bracket access avoids Next build-time inlining of process.env.APP_VERSION.
  const env = globalThis.process?.env;
  const version =
    env?.["APP_VERSION"]?.trim() || env?.["NEXT_PUBLIC_APP_VERSION"]?.trim() || "0.1.0";

  let dbConnected = false;
  try {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    const db = getAuthDbFromEnv();
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
      dbConnected,
    },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } }
  );
}

  return globalThis.Response.json(
    {
      status: dbConnected ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version,
      authProvider: "d1",
      dbConnected,
    },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } }
  );
}
