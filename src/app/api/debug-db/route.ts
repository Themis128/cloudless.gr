export const dynamic = "force-dynamic";

export async function GET() {
  // Test database connection with detailed debugging
  let dbConnected = false;
  let dbSource = 'none';
  let errorMessage = '';
  
  try {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    const db = getAuthDbFromEnv();
    
    if (!db) {
      errorMessage = 'getAuthDbFromEnv() returned null';
    } else if (typeof db.prepare !== 'function') {
      errorMessage = 'getAuthDbFromEnv() returned object without prepare method';
    } else {
      // Try to query the database
      const result = await db.prepare("SELECT 1 as ok").first<{ ok: number }>();
      if (result?.ok === 1) {
        dbConnected = true;
        dbSource = 'getAuthDbFromEnv()';
      } else {
        errorMessage = `Query failed: result.ok = ${result?.ok ?? 'undefined'}`;
      }
    }
  } catch (err) {
    errorMessage = `Exception: ${(err as Error).message}`;
  }

  // Also try to get some environment info for debugging
  const envInfo = {
    hasProcessEnv: typeof process !== 'undefined' && !!process.env,
    hasGlobalThis: typeof globalThis !== 'undefined',
    nodeEnv: process.env?.NODE_ENV,
    // Check for AUTH_DB in process.env directly
    processEnvHasAuthDb: !!(
      typeof process !== 'undefined' && 
      process.env && 
      process.env.AUTH_DB
    ),
  };

  return Response.json(
    {
      dbConnected,
      dbSource,
      errorMessage,
      envInfo,
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } }
  );
}