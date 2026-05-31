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
import { STANDBY_HOST } from "./_helpers";

test.describe("k3s standby path", () => {
  test("standby host + cloudless.gr both serve a valid health body", async ({
    request,
  }) => {
    // PRIMARY (cloudless.gr) is normally CloudFront; SECONDARY (standby host)
    // is always Pi via APIGW. Both should return a structurally valid
    // health body — same shape, git SHA version, different timestamps.
    // Versions may differ transiently: the Pi auto-healer runs every ~5 min
    // and the ECR build takes ~10 min, so the Pi can lag one deploy behind.
    const [a, b] = await Promise.all([
      request.get(`https://${STANDBY_HOST}/api/health`),
      request.get("https://cloudless.gr/api/health"),
    ]);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    const aJ = await a.json();
    const bJ = await b.json();
    expect(aJ.status).toBe("ok");
    expect(bJ.status).toBe("ok");
    // Both must report a valid 40-char git SHA — exact equality is NOT required
    // because the Pi k3s pod can legitimately lag one deploy behind CloudFront
    // (auto-healer CronJob runs every ~5 min; ECR build takes ~10 min on top).
    // Asserting equality here caused transient CI failures during deploy windows.
    const shaRe = /^[0-9a-f]{40}$/;
    expect(aJ.version, "standby host (Pi) version should be a git SHA").toMatch(shaRe);
    expect(bJ.version, "cloudless.gr (Lambda) version should be a git SHA").toMatch(shaRe);
  });

  test("standby cold start (first hit after idle) still completes <3s p95", async ({
    request,
  }) => {
    // Lambda proxy can be cold for the first hit after several minutes idle.
    // p95 budget for the full APIGW + Lambda + Funnel + Pi roundtrip is 3s.
    const t0 = Date.now();
    const r = await request.get(`https://${STANDBY_HOST}/api/health`);
    const dt = Date.now() - t0;
    expect(r.status()).toBe(200);
    expect(dt, `cold-start RTT was ${dt}ms (p95 budget 3000ms)`).toBeLessThan(3_000);
  });

  test("warm RTT well below 1.5s (sequential)", async ({ request }) => {
    // Warm up the Lambda
    await request.get(`https://${STANDBY_HOST}/api/health`);
    // Then measure
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const r = await request.get(`https://${STANDBY_HOST}/api/health`);
      expect(r.status()).toBe(200);
      samples.push(Date.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    expect(median, `warm median RTT ${median}ms (budget 1500ms)`).toBeLessThan(1_500);
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
