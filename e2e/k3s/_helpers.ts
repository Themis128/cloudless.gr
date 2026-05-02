/**
 * Shared helpers for the k3s standby suite.
 */
import type { APIRequestContext } from "@playwright/test";

export const STANDBY_HOST = "cloudless.online";
export const PRIMARY_HOST = "cloudless.gr";

/**
 * Issue a raw GET against the standby's /api/health and return the
 * resolved server-side IP if discoverable from the response. The
 * cloudless.online apex always points at APIGW (no PRIMARY in that zone),
 * so any successful probe should be answering from an AWS-owned range.
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
  const csp = headers["content-security-policy-report-only"] ?? "";
  return (
    csp.includes("frame-ancestors 'none'") &&
    csp.includes("object-src 'none'") &&
    csp.includes("https://*.sentry.io")
  );
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
