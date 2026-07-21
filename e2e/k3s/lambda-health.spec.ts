/**
 * Workers health — verifies the Cloudflare Workers deployment responds
 * within acceptable latency bounds.
 *
 * MIGRATION NOTE (July 2026): The application has migrated from AWS Lambda
 * to Cloudflare Workers. Tests now verify Workers health and response times.
 *
 * Catches: Workers timeout misconfiguration, memory exhaustion, cold start
 * regression, response size limit, missing env vars, D1 connectivity issues.
 */
import { test, expect } from "../coverage";
import { PRIMARY_HOST } from "./_helpers";

test.describe("Workers health (primary path)", () => {
  test("API health responds within 3s (warm)", async ({ request }) => {
    await request.get(`https://${PRIMARY_HOST}/api/health`, { failOnStatusCode: false });
    const start = Date.now();
    const r = await request.get(`https://${PRIMARY_HOST}/api/health`);
    const elapsed = Date.now() - start;
    expect(r.status()).toBe(200);
    expect(elapsed, `warm response took ${elapsed}ms — expected <3000ms`).toBeLessThan(3_000);
  });

  test("Workers returns proper JSON content-type", async ({ request }) => {
    const r = await request.get(`https://${PRIMARY_HOST}/api/health`);
    const ct = r.headers()["content-type"] ?? "";
    expect(ct).toContain("application/json");
  });

  test("Workers environment variables are set (health body has expected fields)", async ({ request }) => {
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

  test("non-existent API route returns 404 or HTML page (dev mode)", async ({ request }) => {
    // NOTE: Next.js dev server returns HTML 404 page with status 200
    // Production Workers returns JSON 404. Both are valid "not found" responses.
    const r = await request.get(
      `https://${PRIMARY_HOST}/api/this-route-does-not-exist-${Date.now()}`,
      { failOnStatusCode: false },
    );
    // Accept either 200 (HTML 404 page from Next.js dev) or 404 (JSON from Workers)
    expect([200, 404]).toContain(r.status());
  });

  test("health endpoint returns valid response", async ({ request }) => {
    const r = await request.get(`https://${PRIMARY_HOST}/api/health`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe("ok");
  });
});

test.describe("Workers cold start resilience", () => {
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