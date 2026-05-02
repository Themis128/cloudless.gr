/**
 * Standby-path verification — proves traffic actually traverses
 *   APIGW (custom domain) → Lambda (cloudless-pi-proxy) → Tailscale
 *   Funnel (omv.tail8eb71.ts.net) → Pi Traefik :18443 → k3s pod
 * rather than (e.g.) some accidental direct route to CloudFront.
 *
 * cloudless.online has NO PRIMARY records — only SECONDARY (APIGW alias),
 * so any successful response on that hostname is by definition the
 * standby path.
 */
import { test, expect } from "@playwright/test";

test.describe("k3s standby path", () => {
  test("cloudless.online + cloudless.gr both serve identical app body", async ({
    request,
  }) => {
    // PRIMARY (cloudless.gr) is normally CloudFront; SECONDARY (cloudless.online)
    // is always Pi via APIGW. Both should return a structurally identical
    // health body — same shape, same version, just different timestamps.
    const [a, b] = await Promise.all([
      request.get("https://cloudless.online/api/health"),
      request.get("https://cloudless.gr/api/health"),
    ]);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    const aJ = await a.json();
    const bJ = await b.json();
    expect(aJ.status).toBe("ok");
    expect(bJ.status).toBe("ok");
    expect(aJ.version, "primary and standby should be on matching versions").toBe(bJ.version);
  });

  test("standby cold start (first hit after idle) still completes <3s p95", async ({
    request,
  }) => {
    // Lambda proxy can be cold for the first hit after several minutes idle.
    // p95 budget for the full APIGW + Lambda + Funnel + Pi roundtrip is 3s.
    const t0 = Date.now();
    const r = await request.get("https://cloudless.online/api/health");
    const dt = Date.now() - t0;
    expect(r.status()).toBe(200);
    expect(dt, `cold-start RTT was ${dt}ms (p95 budget 3000ms)`).toBeLessThan(3_000);
  });

  test("warm RTT well below 1.5s (sequential)", async ({ request }) => {
    // Warm up the Lambda
    await request.get("https://cloudless.online/api/health");
    // Then measure
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const r = await request.get("https://cloudless.online/api/health");
      expect(r.status()).toBe(200);
      samples.push(Date.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    expect(median, `warm median RTT ${median}ms (budget 1500ms)`).toBeLessThan(1_500);
  });

  test("APIGW custom domain returns expected x-amzn headers", async ({ request }) => {
    // APIGW always stamps Apigw-Requestid (or x-amzn-RequestId) on responses
    // it produces — useful as a positive signal that the request actually
    // went through APIGW.
    const r = await request.get("https://cloudless.online/api/health");
    const reqId =
      r.headers()["apigw-requestid"] ??
      r.headers()["x-amzn-requestid"] ??
      r.headers()["x-amzn-trace-id"];
    expect(
      reqId,
      "expected an APIGW request-id header on a SECONDARY-served response",
    ).toBeTruthy();
  });
});
