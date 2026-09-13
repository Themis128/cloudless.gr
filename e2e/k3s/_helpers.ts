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
  });
  return {
    status: r.status(),
    headers: r.headers(),
    body: await r.text(),
  };
}

/**
 * Verifies the response carries the cloudless.gr Next.js app's own CSP
 * (rather than a generic LB / 502 page). The same app runs on PRIMARY
 * and SECONDARY, so this is a "this is *our* app responding" check, not
 * a "this is the Pi specifically" check. Network-path verification lives
 * in standby-path.spec.ts via the APIGW request-id assertion.
 */
export function isLikelyAppResponse(headers: Record<string, string>): boolean {
  const csp = headers["content-security-policy"] ?? "";
  // Match the live Next proxy CSP — sentry was removed from connect-src;
  // frame-ancestors + object-src are the durable "our app" markers.
  return csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'");
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
  attempts = 3
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
    // 429 from edge/proxy rate limits — back off harder than a brief 502.
    const backoffMs = last.status === 429 ? 3_000 * (i + 1) : 1_000 * (i + 1);
    await new Promise((res) => setTimeout(res, backoffMs));
  }
  return last;
}

export function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|502|503|network/i.test(msg);
}

export function isOriginDown(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 521 || status === 522;
}
