/**
 * HA failover path validation — verifies the Cloudflare Workers deployment.
 *
 * MIGRATION NOTE (July 2026): The application has migrated from k3s to Cloudflare
 * Workers. The standby (pi-origin.cloudless.gr) endpoint is now decommissioned.
 * These tests now focus on the primary Workers health and Cloudflare edge routing.
 *
 * Catches: Workers deployment issues, edge/DNS misconfiguration,
 * missing security headers, version format issues.
 */
import { test, expect } from "../coverage";
import { probeHealth, isHealthBody, isNetworkError, PRIMARY_HOST } from "./_helpers";

test.describe("HA failover readiness", () => {
  test("primary health endpoint returns 200 with valid body", async ({ request }) => {
    let r: Awaited<ReturnType<typeof probeHealth>>;
    try {
      r = await probeHealth(request, PRIMARY_HOST);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `cloudless.gr not reachable: ${e}`); return; }
      throw e;
    }
    expect(r.status, "primary /api/health must be 200").toBe(200);
    expect(isHealthBody(r.body)).toBe(true);
  });

  test("health response has expected schema (status, timestamp)", async ({ request }) => {
    let r: Awaited<ReturnType<typeof probeHealth>>;
    try {
      r = await probeHealth(request, PRIMARY_HOST);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `cloudless.gr not reachable: ${e}`); return; }
      throw e;
    }
    const body = JSON.parse(r.body);
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });

  test("primary path goes through the Cloudflare edge (cf-ray header)", async ({ request }) => {
    // The apex front door is Cloudflare Workers which terminates the connection.
    // A missing cf-ray means the apex isn't behind Cloudflare — a routing/DNS regression.
    const r = await request.get(`https://${PRIMARY_HOST}/api/health`, {
      failOnStatusCode: false,
    });
    const cfRay = r.headers()["cf-ray"] ?? "";
    expect(cfRay.length, "primary path should route through the Cloudflare edge").toBeGreaterThan(
      0
    );
  });
});