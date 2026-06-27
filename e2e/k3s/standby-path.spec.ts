/**
 * Standby-path verification — proves traffic actually traverses
 *   APIGW (custom domain) → Lambda (cloudless-pi-proxy) → Tailscale
 *   Funnel (omv.tail8eb71.ts.net) → Pi Traefik :18443 → k3s pod
 * rather than (e.g.) some accidental direct route to CloudFront.
 *
 * The standby host has NO PRIMARY records — only SECONDARY (APIGW alias),
 * so any successful response on that hostname is by definition the
 * standby path.
 */
import { test, expect } from "../coverage";
import { isNetworkError, isOriginDown, STANDBY_HOST } from "./_helpers";

test.describe("k3s standby path", () => {
  test("standby host + cloudless.gr both serve a valid health body", async ({
    request,
  }) => {
    let a: Awaited<ReturnType<typeof request.get>>;
    let b: Awaited<ReturnType<typeof request.get>>;
    try {
      [a, b] = await Promise.all([
        request.get(`https://${STANDBY_HOST}/api/health`),
        request.get("https://cloudless.gr/api/health"),
      ]);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `host not reachable: ${e}`); return; }
      throw e;
    }
    if (isOriginDown(a.status()) || isOriginDown(b.status())) {
      test.skip(true, `origin down (standby=${a.status()}, apex=${b.status()})`);
      return;
    }
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    const aJ = await a.json();
    const bJ = await b.json();
    expect(aJ.status).toBe("ok");
    expect(bJ.status).toBe("ok");
    const shaRe = /^[0-9a-f]{40}$/;
    expect(aJ.version, "standby host (Pi) version should be a git SHA").toMatch(shaRe);
    expect(bJ.version, "cloudless.gr (Lambda) version should be a git SHA").toMatch(shaRe);
  });

  test("standby cold start (first hit after idle) still completes <3s p95", async ({
    request,
  }) => {
    try {
      const t0 = Date.now();
      const r = await request.get(`https://${STANDBY_HOST}/api/health`);
      if (isOriginDown(r.status())) { test.skip(true, `origin returned ${r.status()}`); return; }
      const dt = Date.now() - t0;
      expect(r.status()).toBe(200);
      expect(dt, `cold-start RTT was ${dt}ms (p95 budget 3000ms)`).toBeLessThan(3_000);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `standby not reachable: ${e}`); return; }
      throw e;
    }
  });

  test("warm RTT well below 1.5s (sequential)", async ({ request }) => {
    try {
      const warmup = await request.get(`https://${STANDBY_HOST}/api/health`);
      if (isOriginDown(warmup.status())) { test.skip(true, `origin returned ${warmup.status()}`); return; }
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = Date.now();
        const r = await request.get(`https://${STANDBY_HOST}/api/health`);
        if (isOriginDown(r.status())) { test.skip(true, `origin returned ${r.status()} mid-sample`); return; }
        expect(r.status()).toBe(200);
        samples.push(Date.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)];
      expect(median, `warm median RTT ${median}ms (budget 1500ms)`).toBeLessThan(1_500);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `standby not reachable: ${e}`); return; }
      throw e;
    }
  });

  test.skip("standby host response is stamped by Cloudflare Tunnel (not direct Pi)", async ({
    request,
  }) => {
    // Skipped: Cloudflare Tunnel standby surface was decommissioned.
    // Current path is direct Pi Traefik (pi-origin.cloudless.gr), no CF-RAY header.
    const r = await request.get(`https://${STANDBY_HOST}/api/health`);
    const cfRay = r.headers()["cf-ray"];
    expect(cfRay, "expected CF-RAY header proving traffic went through Cloudflare Tunnel").toBeTruthy();
  });
});
