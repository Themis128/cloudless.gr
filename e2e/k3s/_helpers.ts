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
 * Tries to extract a "this came from the standby path" signal. The Lambda
 * proxy forwards Pi response headers (CSP, X-Frame-Options, etc.) and
 * the Pi's Next.js app stamps `Strict-Transport-Security` only when fronted
 * by Traefik (which it always is in the standby path).
 */
export function isLikelyStandbyResponse(headers: Record<string, string>): boolean {
  const csp = headers["content-security-policy-report-only"] ?? "";
  // The Pi Next.js app's CSP includes a stable signature.
  return csp.includes("o4509865549561856.ingest");
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
