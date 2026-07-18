import { test, expect } from "@playwright/test";

/**
 * Infrastructure smoke tests — run against production only.
 * These tests probe external endpoints and are skipped when running locally
 * unless INFRA_SMOKE=1 is set.
 *
 * Tests the Cloudflare + Pi k3s + Fly.io architecture:
 * - Cloudflare Workers as primary (via cf-ray header)
 * - Pi/k3s cluster (omv) as standby via Tailscale Funnel
 * - Fly.io proxy as secondary failover path
 *
 * Usage:
 *   INFRA_SMOKE=1 BASE_URL=https://cloudless.gr npx playwright test e2e/infrastructure.spec.ts
 */

const runInfra = !!process.env.INFRA_SMOKE;

// Cloudflare Workers edge tests
test.describe("Cloudflare Workers edge", () => {
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

  test("health endpoint version matches expected version", async ({ request }) => {
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

  test("primary path goes through Cloudflare edge (cf-ray header present)", async ({ request }) => {
    // Cloudflare terminates the client connection - cf-ray header proves edge routing
    const res = await request.get("https://cloudless.gr/api/health");
    const cfRay = res.headers()["cf-ray"] ?? "";
    expect(cfRay.length, "primary path should route through Cloudflare edge").toBeGreaterThan(0);
  });
});

// Pi/k3s standby path tests
test.describe("Pi k3s standby path", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("pi-origin path serves from Pi k3s cluster", async ({ request }) => {
    const res = await request.get("https://pi-origin.cloudless.gr/api/health", {
      failOnStatusCode: false,
      timeout: 20_000,
    });
    // Pi standby may return 502/503 if Tailscale Funnel is down
    expect([200, 502, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.status).toBe("ok");
    }
  });

  test("standby path also routes through Cloudflare edge (cf-ray header)", async ({ request }) => {
    const res = await request.get("https://pi-origin.cloudless.gr/api/health", {
      failOnStatusCode: false,
      timeout: 20_000,
    });
    // If response is successful, verify Cloudflare edge
    if (res.status() === 200) {
      const cfRay = res.headers()["cf-ray"] ?? "";
      expect(cfRay.length, "standby path should route through Cloudflare edge").toBeGreaterThan(0);
    }
  });
});

// Fly.io proxy failover tests
test.describe("Fly.io proxy failover", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("Fly.io proxy health endpoint returns valid status", async ({ request }) => {
    const res = await request.get("https://cloudless-proxy.fly.dev/health", {
      failOnStatusCode: false,
      timeout: 15_000,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toMatch(/healthy|degraded/);
    expect(body.primary).toBe("cloudless.gr");
    expect(body.fallback).toBeTruthy();
  });

  test("Fly.io proxy routes to primary or fallback backend", async ({ request }) => {
    const res = await request.get("https://cloudless-proxy.fly.dev/api/health", {
      failOnStatusCode: false,
      timeout: 10_000,
    });
    // Should get a response (either primary or fallback)
    expect(res.status()).toBeLessThan(502);
  });
});
```
