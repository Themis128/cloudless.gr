/**
 * Edge-safe flags for instrumentation. Keep this file free of node:fs / sqlite
 * so Edge compilation of instrumentation.ts can import it.
 */

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
  if (process.env.AUTH_DB_USE_HTTP === "1") return false;
  if (!process.env.CLOUDFLARE_API_TOKEN) return false;
  return true;
}
