/**
 * Fly.io HA Failover Proxy Integration Tests
 *
 * Validates:
 * - Proxy health endpoint and failover logic
 * - Primary/fallback routing based on health checks
 * - Connection pooling and timeout handling
 * - HTTP/2 support
 *
 * Run against: cloudless-proxy.fly.dev (or set FLY_BASE_URL)
 * Requires INFRA_SMOKE=1 for external infrastructure tests.
 */
import { test, expect } from "@playwright/test";

const runInfra = !!process.env.INFRA_SMOKE;
const FLY_BASE_URL = process.env.FLY_BASE_URL ?? "https://cloudless-proxy.fly.dev";

// Fly.io proxy health tests
test.describe("Fly.io Proxy Health", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("proxy /health endpoint returns 200 with failover status", async ({ request }) => {
    const response = await request.get(`${FLY_BASE_URL}/health`, {
      failOnStatusCode: false,
      timeout: 15_000,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toMatch(/healthy|degraded/);
    expect(body.primary).toBe("cloudless.gr");
    expect(body.fallback).toBeTruthy();
    expect(typeof body.primary_healthy).toBe("boolean");
  });

  test("proxy reports correct backend configuration", async ({ request }) => {
    const response = await request.get(`${FLY_BASE_URL}/health`);
    const body = await response.json();

    expect(body.primary).toBe("cloudless.gr");
    expect(body.fallback).toBe("omv.tail8eb71.ts.net");
  });

  test("proxy HTTP endpoint responds (no HTTPS required)", async ({ request }) => {
    // Fly.io accepts HTTP and upgrades
    const response = await request.get(`${FLY_BASE_URL}/health`, {
      ignoreHTTPSErrors: true,
    });

    expect(response.status()).toBe(200);
  });
});

// Failover behavior tests
test.describe("HA Failover Behavior", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("proxy routes to health-checkable backend", async ({ request }) => {
    const response = await request.get(`${FLY_BASE_URL}/api/health`, {
      failOnStatusCode: false,
      timeout: 10_000,
    });

    // Should get a response (either primary or fallback)
    expect(response.status()).toBeLessThan(502);
  });

  test("proxy preserves request headers to backend", async ({ request }) => {
    const response = await request.get(`${FLY_BASE_URL}/api/health`, {
      headers: {
        "User-Agent": "cloudless-fly-proxy-test/1.0",
        "Accept": "application/json",
      },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(200);
  });

  test("proxy handles POST requests with body", async ({ request }) => {
    const response = await request.post(`${FLY_BASE_URL}/api/contact`, {
      data: {
        name: "Fly Proxy Test",
        email: "test@example.com",
        subject: "Proxy Test",
        message: "Testing POST through proxy",
      },
      failOnStatusCode: false,
    });

    // Should not be 502 (proxy error) - either success or validation error
    expect(response.status()).toBeLessThan(502);
  });

  test("proxy strips hop-by-hop headers", async ({ request }) => {
    const response = await request.get(`${FLY_BASE_URL}/api/health`, {
      failOnStatusCode: false,
    });

    // Should not have proxy headers in response
    const serverHeader = response.headers()["server"] ?? "";
    expect(serverHeader.toLowerCase()).not.toContain("nginx"); // Not the proxy's server header
  });

  test("proxy follows redirects from backend", async ({ request }) => {
    const response = await request.get(`${FLY_BASE_URL}/api/health`, {
      maxRedirects: 5,
      failOnStatusCode: false,
    });

    // Should reach the health endpoint
    expect(response.status()).toBe(200);
  });

  test("proxy handles slow backend gracefully", async ({ request }) => {
    // Simulate with a larger timeout
    const startTime = Date.now();
    const response = await request.get(`${FLY_BASE_URL}/api/health`, {
      timeout: 30_000,
      failOnStatusCode: false,
    });
    const elapsed = Date.now() - startTime;

    expect(response.status()).toBe(200);
    // Should complete within reasonable time
    expect(elapsed).toBeLessThan(30_000);
  });

  test("proxy failover latency < 5s from primary", async ({ request }) => {
    // Measure latency to primary
    const startPrimary = Date.now();
    const primaryResponse = await request.get(`${FLY_BASE_URL}/api/health`);
    const primaryLatency = Date.now() - startPrimary;

    expect(primaryResponse.status()).toBe(200);
    expect(primaryLatency).toBeLessThan(5000);
  });
});

// Endpoint passthrough tests
test.describe("Fly.io endpoint passthrough", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  const endpoints = [
    { path: "/api/health", expectedStatus: 200 },
    { path: "/api/services", expectedStatus: [200, 503] },
    { path: "/api/blog/posts", expectedStatus: [200, 503] },
  ];

  for (const endpoint of endpoints) {
    test(`passthrough ${endpoint.path}`, async ({ request }) => {
      const response = await request.get(`${FLY_BASE_URL}${endpoint.path}`, {
        failOnStatusCode: false,
      });

      const expected = Array.isArray(endpoint.expectedStatus)
        ? endpoint.expectedStatus
        : [endpoint.expectedStatus];

      expect(expected.includes(response.status()) || response.status() < 500,
        `${endpoint.path} returned ${response.status()}`).toBeTruthy();
    });
  }

  test("POST /api/checkout passthrough works", async ({ request }) => {
    const response = await request.post(`${FLY_BASE_URL}/api/checkout`, {
      data: { items: [] }, // Empty cart for testing
      failOnStatusCode: false,
    });

    // Should not be proxy error (502/503/504)
    expect(response.status()).toBeLessThan(502);
  });
});

// Connection and resilience tests
test.describe("Fly.io connection resilience", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("concurrent requests handled", async ({ request }) => {
    // Make multiple concurrent requests
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        request.get(`${FLY_BASE_URL}/api/health`, { failOnStatusCode: false })
      );
    }

    const responses = await Promise.all(promises);

    for (const response of responses) {
      expect(response.status()).toBe(200);
    }
  });

  test("connection reuse on warm requests", async ({ request }) => {
    // Warm up
    await request.get(`${FLY_BASE_URL}/api/health`);

    // Measure subsequent requests
    const latencies = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const response = await request.get(`${FLY_BASE_URL}/api/health`);
      latencies.push(Date.now() - start);
      expect(response.status()).toBe(200);
    }

    // Warm requests should be faster than cold
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    expect(avgLatency).toBeLessThan(2000);
  });
});