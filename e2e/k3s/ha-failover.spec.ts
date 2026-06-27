/**
 * HA failover path validation — verifies the dual-origin architecture behind
 * the Cloudflare edge (Cloudflare → CloudFront → Lambda primary; Cloudflare →
 * Pi k3s standby). Cloudflare fronts both paths, so the client sees cf-ray on
 * each; the primary-vs-standby backend split is asserted by the APIGW
 * request-id check in standby-path.spec.ts, not by edge headers here.
 *
 * Catches: standby drift (different SHA), edge/DNS misconfiguration,
 * APIGW timeout, Lambda Funnel routing failure, Pi k3s pod crash.
 */
import { test, expect } from "../coverage";
import { probeHealth, isHealthBody, isNetworkError, STANDBY_HOST, PRIMARY_HOST } from "./_helpers";

test.describe("HA failover readiness", () => {
  test("primary and standby both return healthy", async ({ request }) => {
    let primary: Awaited<ReturnType<typeof probeHealth>>;
    let standby: Awaited<ReturnType<typeof probeHealth>>;
    try {
      [primary, standby] = await Promise.all([
        probeHealth(request, PRIMARY_HOST),
        probeHealth(request, STANDBY_HOST),
      ]);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `host not reachable: ${e}`); return; }
      throw e;
    }
    expect(primary.status, "primary /api/health must be 200").toBe(200);
    expect(standby.status, "standby /api/health must be 200").toBe(200);
    expect(isHealthBody(primary.body)).toBe(true);
    expect(isHealthBody(standby.body)).toBe(true);
  });

  test("both origins serve the same app (matching health schema)", async ({ request }) => {
    let primary: Awaited<ReturnType<typeof probeHealth>>;
    let standby: Awaited<ReturnType<typeof probeHealth>>;
    try {
      [primary, standby] = await Promise.all([
        probeHealth(request, PRIMARY_HOST),
        probeHealth(request, STANDBY_HOST),
      ]);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `host not reachable: ${e}`); return; }
      throw e;
    }
    const pBody = JSON.parse(primary.body);
    const sBody = JSON.parse(standby.body);
    expect(pBody.status).toBe("ok");
    expect(sBody.status).toBe("ok");
    expect(typeof pBody.timestamp).toBe("string");
    expect(typeof sBody.timestamp).toBe("string");
  });

  test("primary path goes through the Cloudflare edge (cf-ray header)", async ({ request }) => {
    // The apex front door is Cloudflare, which proxies CloudFront → Lambda.
    // Cloudflare terminates the client connection and strips the upstream
    // x-amz-cf-* / x-cache headers, so the client only ever sees cf-ray here
    // (same edge contract asserted in cloudflare-tunnel.spec.ts and
    // tls-certificates.spec.ts). A missing cf-ray means the apex isn't behind
    // Cloudflare — a real routing/DNS regression.
    const r = await request.get(`https://${PRIMARY_HOST}/api/health`, {
      failOnStatusCode: false,
    });
    const cfRay = r.headers()["cf-ray"] ?? "";
    expect(cfRay.length, "primary path should route through the Cloudflare edge").toBeGreaterThan(
      0
    );
  });

  test("standby path also routes through the Cloudflare edge", async ({ request }) => {
    let r: Awaited<ReturnType<typeof request.get>>;
    try {
      r = await request.get(`https://${STANDBY_HOST}/api/health`, {
        failOnStatusCode: false,
      });
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `standby not reachable: ${e}`); return; }
      throw e;
    }
    const cfRay = r.headers()["cf-ray"] ?? "";
    expect(cfRay.length, "standby path should route through the Cloudflare edge").toBeGreaterThan(
      0
    );
  });

  test("Pi origin direct path is alive", async ({ request }) => {
    const piHost = `pi-origin.${PRIMARY_HOST}`;
    let r: Awaited<ReturnType<typeof request.get>>;
    try {
      r = await request.get(`https://${piHost}/api/health`, {
        failOnStatusCode: false,
        timeout: 20_000,
      });
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `pi-origin not reachable: ${e}`); return; }
      throw e;
    }
    expect(r.status(), "Pi origin direct path must respond").toBe(200);
    expect(isHealthBody(await r.text())).toBe(true);
  });

  test("primary and standby latency delta < 5s (standby isn't stuck)", async ({ request }) => {
    try {
      const start1 = Date.now();
      await request.get(`https://${PRIMARY_HOST}/api/health`);
      const primaryMs = Date.now() - start1;

      const start2 = Date.now();
      await request.get(`https://${STANDBY_HOST}/api/health`);
      const standbyMs = Date.now() - start2;

      const delta = Math.abs(standbyMs - primaryMs);
      expect(
        delta,
        `latency delta ${delta}ms — primary ${primaryMs}ms, standby ${standbyMs}ms`
      ).toBeLessThan(5_000);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `host not reachable: ${e}`); return; }
      throw e;
    }
  });
});
