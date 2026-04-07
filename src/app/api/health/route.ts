export const dynamic = "force-dynamic";

/* Baked in at build time so it's available in Lambda (unlike npm_package_version). */
const APP_VERSION = globalThis.process?.env.APP_VERSION ?? "0.1.0";

export async function GET() {
  return globalThis.Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
  });
}
