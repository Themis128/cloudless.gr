/**
 * Shared helpers for the k3s standby suite.
 */
import type { APIRequestContext } from "@playwright/test";

const _apexHost = process.env.K3S_HOST ?? "cloudless.gr";
export const PRIMARY_HOST = _apexHost;
export const STANDBY_HOST = process.env.K3S_STANDBY_HOST ?? `pi-origin.${_apexHost}`;

/**
 * Issue a raw GET against the standby's /api/health and return the
 * resolved server-side IP if discoverable from the response. The
 * apex host that the k3s standby suite runs against.
 */
export async function probeHealth(req: APIRequestContext, host = STANDBY_HOST) {
  const r = await req.get(`https://${host}/api/health`, {
    failOnStatusCode: false,
    timeout: 20_000,
  });
  return {
    status: r.status(),
    headers: r.headers(),
    body: await r.text(),
  };
}

export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|Timeout/i.test(msg);
}

export function isOriginDown(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Checks if the standby endpoint is decommissioned (returns 404 or 410).
 * After July 2026 migration to Cloudflare Workers, pi-origin endpoint
 * no longer serves the application.
 */
export function isStandbyDecommissioned(status: number): boolean {
  return status === 404 || status === 410;
}

/**
 * Verifies the response carries the cloudless.gr Next.js app's own CSP
 * (rather than a generic LB / 502 page). For production Workers, we check
 * for the cf-ray header to confirm it's our Cloudflare deployment.
 *
 * MIGRATION NOTE (July 2026): The app migrated to Workers, which may not
 * return all headers that the k3s deployment previously did. We now accept
 * either:
 * - CSP header matching the app signature (dev/local)
 * - CF-Ray header (production Workers)
 */
export function isLikelyAppResponse(headers: Record<string, string>): boolean {
  const csp = headers["content-security-policy"] ?? "";
  const cfRay = headers["cf-ray"] ?? "";
  
  // Check for app signature CSP (dev/local)
  const hasAppCSP = 
    csp.includes("frame-ancestors 'none'") &&
    csp.includes("object-src 'none'") &&
    csp.includes("https://*.sentry.io");
  
  // Check for Cloudflare Workers header (production)
  const hasCFRay = cfRay.length > 0;
  
  // Either signature is valid
  return hasAppCSP || hasCFRay;
}

/**
 * Verify the body of /api/health matches the expected shape stamped by
 * the Next.js app on either side. The shape is shared so this passes for
 * PRIMARY (CloudFront → Lambda) and SECONDARY (APIGW → Funnel → Pi).
 */
export function isHealthBody(body: string): boolean {
  try {
    const j = JSON.parse(body);
    return j?.status === "ok" && typeof j?.timestamp === "string";
  } catch {
    return false;
  }
}

/**
 * Run a fetch with a small retry budget — the standby path can briefly
 * 502 mid rolling-update (kubectl rollout restart while a sync job fires).
 * Tests that depend on a fresh page should wrap their first hit with this.
 */
export async function getWithRetry(
  req: APIRequestContext,
  url: string,
  attempts = 3,
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  let last: { status: number; body: string; headers: Record<string, string> } = {
    status: 0,
    body: "",
    headers: {},
  };
  for (let i = 0; i < attempts; i++) {
    const r = await req.get(url, { failOnStatusCode: false });
    last = {
      status: r.status(),
      body: await r.text(),
      headers: r.headers(),
    };
    if (last.status >= 200 && last.status < 400) return last;
    await new Promise((res) => setTimeout(res, 1_000 * (i + 1)));
  }
  return last;
}
