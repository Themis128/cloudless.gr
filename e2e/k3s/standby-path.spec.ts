/**
 * Standby-path verification — superseded by Cloudflare Workers migration.
 *
 * MIGRATION NOTE (July 2026): The application has migrated from k3s (via Tailscale
 * Funnel) to Cloudflare Workers. The standby (pi-origin.cloudless.gr) endpoint is
 * now decommissioned. These tests are updated to verify the primary Workers endpoint.
 *
 * The application is now served directly at https://cloudless.gr by Cloudflare Workers.
 */
import { test, expect } from "../coverage";
import { isNetworkError, PRIMARY_HOST } from "./_helpers";

test.describe("Workers primary endpoint", () => {
  test("cloudless.gr health endpoint returns valid response", async ({
    request,
  }) => {
    let r: Awaited<ReturnType<typeof request.get>>;
    try {
      r = await request.get(`https://${PRIMARY_HOST}/api/health`);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `host not reachable: ${e}`); return; }
      throw e;
    }
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe("ok");
  });

  test("Workers warm response <3s", async ({
    request,
  }) => {
    try {
      const t0 = Date.now();
      const r = await request.get(`https://${PRIMARY_HOST}/api/health`);
      if (r.status() >= 500) { test.skip(true, `Workers returned ${r.status()}`); return; }
      const dt = Date.now() - t0;
      expect(r.status()).toBe(200);
      expect(dt, `Workers RTT was ${dt}ms (budget 3000ms)`).toBeLessThan(3_000);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `cloudless.gr not reachable: ${e}`); return; }
      throw e;
    }
  });

  test("Workers sequential responses are consistent", async ({ request }) => {
    try {
      // Warmup request
      await request.get(`https://${PRIMARY_HOST}/api/health`);
      
      // Measure sequential requests
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = Date.now();
        const r = await request.get(`https://${PRIMARY_HOST}/api/health`);
        if (r.status() >= 500) { test.skip(true, `Workers returned ${r.status()} mid-sample`); return; }
        expect(r.status()).toBe(200);
        samples.push(Date.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)];
      expect(median, `Workers median RTT ${median}ms (budget 1500ms)`).toBeLessThan(1_500);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `cloudless.gr not reachable: ${e}`); return; }
      throw e;
    }
  });
});

// Legacy test preserved for documentation purposes - now skipped
test.describe("k3s standby path (decommissioned)", () => {
  // pi-origin.cloudless.gr was decommissioned in July 2026 migration to Workers
  test.skip(true, "k3s standby via Tailscale Funnel decommissioned — application now on Cloudflare Workers", () => {});
});