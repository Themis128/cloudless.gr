/**
 * Lambda / serverless function health — verifies the Lambda-backed API
 * routes respond within acceptable latency bounds and handle cold starts.
 *
 * Catches: Lambda timeout misconfiguration, memory exhaustion, cold start
 * regression, response size limit, missing env vars.
 */
import { test, expect } from "../coverage";
import { PRIMARY_HOST } from "./_helpers";

test.describe("Lambda health (primary path)", () => {
  test("API health responds within 3s (warm)", async ({ request }) => {
    await request.get(`https://${PRIMARY_HOST}/api/health`, { failOnStatusCode: false });
    const start = Date.now();
    const r = await request.get(`https://${PRIMARY_HOST}/api/health`);
    const elapsed = Date.now() - start;
    expect(r.status()).toBe(200);
    expect(elapsed, `warm response took ${elapsed}ms — expected <3000ms`).toBeLessThan(3_000);
  });

  test("Lambda returns proper JSON content-type", async ({ request }) => {
    const r = await request.get(`https://${PRIMARY_HOST}/api/health`);
    const ct = r.headers()["content-type"] ?? "";
    expect(ct).toContain("application/json");
  });

  test("Lambda environment variables are set (health body has expected fields)", async ({ request }) => {
    const r = await request.get(`https://${PRIMARY_HOST}/api/health`);
    const body = await r.json();
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("timestamp");
  });

  test("SSR page renders within 5s (not just API routes)", async ({ request }) => {
    const start = Date.now();
    const r = await request.get(`https://${PRIMARY_HOST}/en`, { failOnStatusCode: false });
    const elapsed = Date.now() - start;
    expect(r.status()).toBeLessThan(400);
    expect(elapsed, `SSR page took ${elapsed}ms — expected <5000ms`).toBeLessThan(5_000);
    const ct = r.headers()["content-type"] ?? "";
    expect(ct).toContain("text/html");
  });

  test("non-existent API route returns 404, not Lambda 502", async ({ request }) => {
    const r = await request.get(
      `https://${PRIMARY_HOST}/api/this-route-does-not-exist-${Date.now()}`,
      { failOnStatusCode: false },
    );
    expect(r.status()).toBe(404);
  });

  test("response headers include cache control directives", async ({ request }) => {
    const r = await request.get(`https://${PRIMARY_HOST}/api/health`);
    const cc = r.headers()["cache-control"] ?? "";
    expect(cc.length, "API response missing cache-control header").toBeGreaterThan(0);
  });
});

test.describe("Lambda cold start resilience", () => {
  test("10 sequential health checks all return 200 (no intermittent 502s)", async ({ request }) => {
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await request.get(`https://${PRIMARY_HOST}/api/health`, { failOnStatusCode: false });
      results.push(r.status());
    }
    const failures = results.filter((s) => s >= 500);
    expect(failures.length, `${failures.length}/10 requests returned 5xx: ${JSON.stringify(results)}`).toBe(0);
  });
});
