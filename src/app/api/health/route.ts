export const dynamic = "force-dynamic";

export async function GET() {
  // Bracket access avoids Next build-time inlining of process.env.APP_VERSION.
  const env = globalThis.process?.env;
  const version =
    env?.["APP_VERSION"]?.trim() || env?.["NEXT_PUBLIC_APP_VERSION"]?.trim() || "0.1.0";
  return globalThis.Response.json(
    { status: "ok", timestamp: new Date().toISOString(), version },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } }
  );
}
