/**
 * k3s Cluster System Integration Tests
 *
 * Validates:
 * - k3s cluster health and readiness
 * - Traefik ingress controller
 * - Docker image availability (ECR)
 * - Tailscale Funnel connectivity
 * - Pi standby app deployment
 * - Local app running on Pi cluster
 *
 * Run against: https://pi-origin.cloudless.gr (or set K3S_BASE_URL)
 * Requires INFRA_SMOKE=1 for external infrastructure tests.
 */
import { test, expect } from "../coverage";
import {
  PRIMARY_HOST,
  STANDBY_HOST,
  probeHealth,
  isHealthBody,
  isNetworkError,
  isOriginDown,
  getWithRetry,
} from "./_helpers";

const runInfra = !!process.env.INFRA_SMOKE;

// k3s cluster health tests
test.describe("k3s Cluster Health", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("k3s health endpoint returns 200 with valid body", async ({ request }) => {
    let r: Awaited<ReturnType<typeof probeHealth>>;
    try {
      r = await probeHealth(request);
    } catch (e) {
      if (isNetworkError(e)) {
        test.skip(true, `k3s cluster not reachable: ${e}`);
        return;
      }
      throw e;
    }

    if (isOriginDown(r.status)) {
      test.skip(true, `k3s returned ${r.status}`);
      return;
    }

    expect(r.status, "k3s /api/health must return 200").toBe(200);
    expect(isHealthBody(r.body), `unexpected body: ${r.body.slice(0, 200)}`).toBe(true);
  });

  test("k3s clusters responds with secure headers", async ({ request }) => {
    let r: Awaited<ReturnType<typeof probeHealth>>;
    try {
      r = await probeHealth(request, STANDBY_HOST);
    } catch (e) {
      if (isNetworkError(e)) {
        test.skip(true, `standby not reachable: ${e}`);
        return;
      }
      throw e;
    }

    if (isOriginDown(r.status)) {
      test.skip(true, `origin returned ${r.status}`);
      return;
    }

    expect(r.headers["strict-transport-security"]).toBeTruthy();
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-frame-options"]).toBe("DENY");
  });

  test("Traefik ingress is running on expected routes", async ({ request }) => {
    // Hit known app routes to verify Traefik routing
    const routes = ["/api/health", "/en", "/en/store"];

    for (const route of routes) {
      const r = await request.get(`https://${STANDBY_HOST}${route}`, {
        failOnStatusCode: false,
        timeout: 20_000,
      });

      if (isOriginDown(r.status())) {
        test.skip(true, `route ${route} returned ${r.status()}`);
        return;
      }

      expect(r.status(), `${route} should be accessible through Traefik`).toBeLessThan(500);
    }
  });

  test("k3s pod is responding (not stuck on crashloop)", async ({ request }) => {
    // Make multiple requests - if pod was restarting, we'd see 502s or timeouts
    const responses = await Promise.all([
      request.get(`https://${STANDBY_HOST}/api/health`),
      request.get(`https://${STANDBY_HOST}/api/health`),
      request.get(`https://${STANDBY_HOST}/api/health`),
    ]);

    for (const r of responses) {
      expect(r.status()).toBe(200);
    }
  });
});

// Tailscale Funnel connectivity tests
test.describe("Tailscale Funnel Connectivity", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("pi-origin host resolves through Funnel", async ({ request }) => {
    const r = await request.get(`https://${STANDBY_HOST}/api/health`, {
      failOnStatusCode: false,
      timeout: 20_000,
    });

    if (isOriginDown(r.status())) {
      test.skip(true, `Funnel returned ${r.status()}`);
      return;
    }

    expect(r.status()).toBe(200);
  });

  test("Funnel does not expose raw Pi LAN IP", async ({ request }) => {
    const r = await request.get(`https://${STANDBY_HOST}/api/health`, {
      failOnStatusCode: false,
    });

    if (isOriginDown(r.status())) {
      test.skip(true, `Funnel returned ${r.status()}`);
      return;
    }

    // Response should come through Tailscale Funnel, not direct LAN
    const server = (r.headers()["server"] ?? "").toLowerCase();
    // Tailscale Funnel uses specific headers
    expect(server).not.toMatch(/nginx|pihole|traefik/i);
  });

  test("Tailscale Funnel TLS is valid", async ({ request }) => {
    const r = await request.get(`https://${STANDBY_HOST}/api/health`, {
      ignoreHTTPSErrors: false,
      failOnStatusCode: false,
    });

    // If we can get here without certificate error, Funnel TLS is valid
    expect(r.status()).toBe(200);
  });
});

// ECR image availability tests
test.describe("ECR Image Availability", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("standby app responds (ECR image is deployed and running)", async ({ request }) => {
    // If this passes, the ECR image is pulled and container is running
    const r = await request.get(`https://${STANDBY_HOST}/api/health`, {
      failOnStatusCode: false,
      timeout: 20_000,
    });

    expect(r.status()).toBe(200);
  });

  test("standby app version matches current deployment", async ({ request }) => {
    const r = await request.get(`https://${STANDBY_HOST}/api/health`);
    const body = await r.json();

    // Version should be a git SHA, not fallback "1.0.0"
    const shaMatch = /^[0-9a-f]{40}$/.test(body.version);
    expect(shaMatch, `Expected git SHA version, got: ${body.version}`).toBe(true);
  });

  test("standby and primary run same app version (sync check)", async ({ request }) => {
    let primary, standby;

    try {
      [primary, standby] = await Promise.all([
        request.get(`https://${PRIMARY_HOST}/api/health`),
        request.get(`https://${STANDBY_HOST}/api/health`),
      ]);
    } catch (e) {
      if (isNetworkError(e)) {
        test.skip(true, `host not reachable: ${e}`);
        return;
      }
      throw e;
    }

    if (isOriginDown(primary.status()) || isOriginDown(standby.status())) {
      test.skip(true, `origin returned 5xx`);
      return;
    }

    const pBody = await primary.json();
    const sBody = await standby.json();

    expect(pBody.version).toBe(sBody.version);
  });
});

// Full local k3s system tests (standby app)
test.describe("Local k3s System (Standby App)", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("full stack responds: tunnel -> Pi -> k3s -> Next.js app", async ({ request }) => {
    // This proves the entire stack is operational:
    // Cloudflare Tunnel -> Tailscale Funnel -> Pi Traefik -> k3s cloudless-app pod
    const r = await request.get(`https://${STANDBY_HOST}/api/health`, {
      failOnStatusCode: false,
      timeout: 20_000,
    });

    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe("ok");
    expect(body.authProvider).toBe("d1");
  });

  test("homepage loads through full k3s stack", async ({ page }) => {
    const r = await page.goto(`https://${STANDBY_HOST}/en`, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    expect(r?.status(), "k3s homepage navigation must succeed").toBeLessThan(400);
  });

  test("store page accessible on k3s standby", async ({ request }) => {
    const r = await request.get(`https://${STANDBY_HOST}/en/store`, {
      failOnStatusCode: false,
      timeout: 20_000,
    });

    expect(r.status()).toBeLessThan(500);
  });

  test("blog API works on k3s standby", async ({ request }) => {
    const r = await request.get(`https://${STANDBY_HOST}/api/blog/posts`, {
      failOnStatusCode: false,
    });

    if (r.status() === 200) {
      const body = await r.json();
      expect(Array.isArray(body.posts)).toBe(true);
      expect(body.source).toMatch(/appflowy|static/);
    }
  });

  test("API routes respond correctly on k3s", async ({ request }) => {
    const apiRoutes = [
      "/api/health",
      "/api/services",
      "/api/faqs",
      "/api/testimonials",
    ];

    for (const route of apiRoutes) {
      const r = await request.get(`https://${STANDBY_HOST}${route}`, {
        failOnStatusCode: false,
        timeout: 15_000,
      });

      expect(r.status(), `${route} returned ${r.status()}`).toBeLessThan(502);
    }
  });
});

// Latency and performance tests
test.describe("k3s Performance & Latency", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("cold start (first hit after idle) completes within 3s p95", async ({ request }) => {
    const t0 = Date.now();
    const r = await request.get(`https://${STANDBY_HOST}/api/health`);
    const elapsed = Date.now() - t0;

    expect(r.status()).toBe(200);
    expect(elapsed, `cold-start RTT was ${elapsed}ms (p95 budget 3000ms)`).toBeLessThan(3_000);
  });

  test("warm RTT well below 1.5s (sequential)", async ({ request }) => {
    // Warm up
    await request.get(`https://${STANDBY_HOST}/api/health`);

    // Measure 5 sequential requests
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

  test("latency delta between primary and standby < 5s", async ({ request }) => {
    const startPrimary = Date.now();
    await request.get(`https://${PRIMARY_HOST}/api/health`);
    const primaryMs = Date.now() - startPrimary;

    const startStandby = Date.now();
    const r = await request.get(`https://${STANDBY_HOST}/api/health`);
    const standbyMs = Date.now() - startStandby;

    if (isOriginDown(r.status())) {
      test.skip(true, `standby returned ${r.status()}`);
      return;
    }

    const delta = Math.abs(standbyMs - primaryMs);
    expect(delta, `latency delta ${delta}ms — primary ${primaryMs}ms, standby ${standbyMs}ms`).toBeLessThan(5_000);
  });
});

// Diagnostic and monitoring endpoints
test.describe("k3s Monitoring Endpoints", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("health endpoint includes all expected fields", async ({ request }) => {
    const r = await request.get(`https://${STANDBY_HOST}/api/health`);
    const body = await r.json();

    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("authProvider");
    expect(body).toHaveProperty("dbConnected");

    expect(body.status).toBe("ok");
    expect(body.authProvider).toBe("d1");
    expect(body.dbConnected).toBe(true);
  });

  test("uptime tracking via repeated requests", async ({ request }) => {
    // Make a burst of requests to verify stability
    const results = [];
    for (let i = 0; i < 20; i++) {
      const r = await request.get(`https://${STANDBY_HOST}/api/health`);
      results.push(r.status() === 200);
    }

    const successRate = results.filter(Boolean).length / results.length;
    expect(successRate, `Success rate ${successRate * 100}%`).toBeGreaterThanOrEqual(0.95);
  });
});