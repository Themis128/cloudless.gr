import { test, expect } from "@playwright/test";

/**
 * Analytics stack smoke tests — Metabase.
 * Requires INFRA_SMOKE=1. DuckDB API has no external ingress; it is
 * validated indirectly via Metabase being healthy (Metabase queries it).
 */

const runInfra = !!process.env.INFRA_SMOKE;

const METRICS_HOST = `metrics.${process.env.K3S_HOST ?? "cloudless.gr"}`;

test.describe("Metabase", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get(`https://${METRICS_HOST}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok" });
  });

  test("root redirects to login (not 5xx)", async ({ request }) => {
    const res = await request.get(`https://${METRICS_HOST}/`, {
      maxRedirects: 5,
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("responds within 5s", async ({ request }) => {
    const start = Date.now();
    await request.get(`https://${METRICS_HOST}/api/health`);
    expect(Date.now() - start).toBeLessThan(5_000);
  });
});
