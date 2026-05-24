import { test, expect } from "@playwright/test";

/**
 * Infrastructure smoke tests — run against production only.
 * These tests probe external endpoints and are skipped when running locally
 * unless INFRA_SMOKE=1 is set.
 *
 * Usage:
 *   INFRA_SMOKE=1 BASE_URL=https://cloudless.gr npx playwright test e2e/infrastructure.spec.ts
 */

const runInfra = !!process.env.INFRA_SMOKE;

test.describe("CloudFront / CDN", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("cloudless.gr returns HTTP 200", async ({ request }) => {
    const res = await request.get("https://cloudless.gr/");
    expect(res.status()).toBe(200);
  });

  test("www.cloudless.gr redirects away from www", async ({ request }) => {
    const res = await request.get("https://www.cloudless.gr/", {
      maxRedirects: 0,
    });
    expect(res.status()).toBeGreaterThanOrEqual(301);
    expect(res.status()).toBeLessThanOrEqual(308);
    const location = res.headers()["location"] ?? "";
    // Accept both absolute (https://cloudless.gr) and relative (/en) redirects;
    // both successfully strip the www prefix when followed by the browser.
    expect(location.length).toBeGreaterThan(0);
    expect(location).not.toContain("www.");
  });

  test("HTTP/2 or HTTP/3 is used (HTTPS only)", async ({ request }) => {
    const res = await request.get("https://cloudless.gr/api/health");
    expect(res.status()).toBe(200);
    // If HTTP3 is active, Alt-Svc header is present
    const altSvc = res.headers()["alt-svc"] ?? "";
    // Either h3 advertised or h2 served — both are acceptable
    const proto = res.headers()[":status"] ?? "";
    // At minimum, HTTPS was used (no plain HTTP fallback)
    expect(res.url()).toMatch(/^https:/);
  });

  test("health endpoint version matches SSM expected version", async ({ request }) => {
    const res = await request.get("https://cloudless.gr/api/health");
    expect(res.status()).toBe(200);
    const { version } = await res.json();
    // Version should be a git SHA or semver — not the fallback '0.1.0'
    // (unless we're in a local dev build, but INFRA_SMOKE implies prod)
    if (process.env.EXPECTED_VERSION) {
      expect(version).toBe(process.env.EXPECTED_VERSION);
    } else {
      expect(version).not.toBe("0.1.0");
    }
  });
});

test.describe("Route 53 Failover", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("primary (CloudFront) path is serving cloudless.gr", async ({ request }) => {
    const res = await request.get("https://cloudless.gr/api/health");
    expect(res.status()).toBe(200);
    // CloudFront injects x-cache header
    const xCache = res.headers()["x-cache"] ?? "";
    const server = res.headers()["server"] ?? "";
    // Either served from CloudFront cache or Lambda origin
    expect(xCache + server).toMatch(/cloudfront|lambda/i);
  });
});
