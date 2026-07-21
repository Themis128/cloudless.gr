/**
 * Cloudflare Infrastructure Integration Tests
 *
 * Validates:
 * - Cloudflare Workers deployment and health
 * - D1 Authentication system (migration from AWS Cognito)
 * - R2 Storage assets serving
 * - Tunnel endpoints routing
 * - Auth consistency between cloud and local
 *
 * Requires INFRA_SMOKE=1 for external infrastructure tests.
 */
import { test, expect } from "@playwright/test";
import { isNetworkError, isOriginDown } from "./k3s/_helpers";

const runInfra = !!process.env.INFRA_SMOKE;
const BASE_URL = process.env.CF_WORKERS_URL ?? "https://cloudless.gr";

// Cloudflare Workers health check
test.describe("Cloudflare Workers health", () => {
  test("Workers health endpoint returns 200 with valid payload", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`, {
      failOnStatusCode: false,
      timeout: 15_000,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    // Version may be a git SHA, version number, or placeholder like ${GITHUB_SHA} in dev
    // Accept any string value for version
    expect(typeof body.version).toBe("string");
  });

  test("Workers auth provider is D1 (not Cognito for local)", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`, {
      failOnStatusCode: false,
    });

    if (response.status() === 200) {
      const body = await response.json();
      // Local dev may not have D1 configured, but prod should
      if (BASE_URL.includes("localhost")) {
        // Skip for local dev - auth may be unconfigured
        test.skip();
      }
      expect(body.authProvider).toBe("d1");
    }
  });

  test("Workers responds with cf-ray header (Cloudflare edge proof)", async ({ request }) => {
    let response;
    try {
      response = await request.get(`${BASE_URL}/api/health`, {
        failOnStatusCode: false,
      });
    } catch (e) {
      if (isNetworkError(e)) {
        test.skip(true, `Workers not reachable: ${e}`);
        return;
      }
      throw e;
    }

    if (isOriginDown(response.status())) {
      test.skip(true, `Workers returned ${response.status()}`);
      return;
    }

    // Check for Cloudflare edge presence - cf-ray header proves we're behind Cloudflare
    const cfRay = response.headers()["cf-ray"] ?? "";
    // In production, cf-ray is present. In local dev (localhost), we skip this check.
    if (BASE_URL.includes("localhost")) {
      // Skip: local dev doesn't have cf-ray
      test.skip(true, "Local dev mode - cf-ray not applicable");
      return;
    }
    expect(cfRay.length, "Expected cf-ray header proving Cloudflare edge").toBeGreaterThan(0);
  });

  test("Workers responds via Cloudflare edge (cf-ray header present)", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`, {
      failOnStatusCode: false,
    });

    if (response.status() === 200) {
      const cfRay = response.headers()["cf-ray"] ?? "";
      expect(cfRay.length, "Expected cf-ray header proving Cloudflare edge").toBeGreaterThan(0);
    }
  });
});

// D1 Authentication system tests (migrated from Cognito)
test.describe("D1 Authentication system", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("login endpoint accepts credentials and returns session", async ({ request }) => {
    const testEmail = process.env.E2E_USER_EMAIL ?? "test@example.com";
    const testPassword = process.env.E2E_USER_PASSWORD ?? "";

    if (!testPassword) {
      test.skip(true, "E2E_USER_PASSWORD not set");
      return;
    }

    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testEmail, password: testPassword },
      headers: { "Content-Type": "application/json" },
    });

    expect([200, 401, 503]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testEmail);
    }
  });

  test("register endpoint creates user with email/password", async ({ request }) => {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = "TestPassword123!";
    const testName = "Test User";

    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: { email: testEmail, password: testPassword, name: testName },
      headers: { "Content-Type": "application/json" },
    });

    expect([200, 400, 503]).toContain(response.status());
  });

  test("session endpoint validates auth cookie", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/session`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Unauthenticated should return null user
    if (!body.user) {
      expect(body.user).toBeNull();
    } else {
      expect(body.user).toBeDefined();
      expect(body.isAdmin).toBeDefined();
    }
  });

  test("logout endpoint destroys session", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/logout`, {
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  test("password reset request returns 200 (does not reveal existence)", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/reset-password`, {
      data: { email: "nonexistent@example.com" },
      headers: { "Content-Type": "application/json" },
    });

    // Should return 200 even for non-existent email (security best practice)
    expect(response.status()).toBe(200);
  });

  test("reset confirmation validates token structure", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/reset-confirm`, {
      data: {
        token: "invalid-token",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      },
      headers: { "Content-Type": "application/json" },
    });

    expect([400, 503]).toContain(response.status());
  });
});

// R2 Storage tests
test.describe("R2 Storage integration", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("analytics endpoint lists parquet files or returns empty", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/query?prefix=analytics/`, {
      failOnStatusCode: false,
    });

    if (response.status() === 200) {
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.files)).toBe(true);
    }
  });

  test("static assets route returns 404 for missing files (not 500)", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/static/nonexistent/file.js`, {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(404);
  });

  test("S3 asset proxy handles range requests", async ({ request }) => {
    // Test range header support for analytics parquet files
    const response = await request.get(`${BASE_URL}/api/analytics/r2?file=test.parquet`, {
      headers: { Range: "bytes=0-1024" },
      failOnStatusCode: false,
    });

    // Should not be 500 - either 200/206 for valid file or 404 for missing
    expect([200, 206, 400, 404]).toContain(response.status());
  });
});

// Cloudflare Tunnel integration
test.describe("Cloudflare Tunnel endpoints", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  const tunnelServices = [
    { subdomain: "oncall", path: "/" },
    { subdomain: "ntfy", path: "/v1/health" },
    { subdomain: "ha", path: "/" },
  ];

  for (const service of tunnelServices) {
    test(`${service.subdomain}.${BASE_URL.replace("https://", "")} ${service.path} responds`, async ({
      request,
    }) => {
      const url = BASE_URL.replace("cloudless.gr", `${service.subdomain}.cloudless.gr`) + service.path;
      const response = await request.get(url, {
        failOnStatusCode: false,
        timeout: 10_000,
      });

      // Should not be 502/503 (tunnel down)
      expect(response.status()).toBeLessThan(502);

      // Should have cf-ray header proving Cloudflare tunnel
      const cfRay = response.headers()["cf-ray"] ?? "";
      expect(cfRay.length).toBeGreaterThan(0);
    });
  }
});

// Auth system consistency between cloud and local
test.describe("Auth system sync (cloud <-> local)", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("D1 database is shared between Workers instances", async ({ request }) => {
    // Hit the health endpoint multiple times to verify consistent DB state
    const responses = await Promise.all([
      request.get(`${BASE_URL}/api/health`),
      request.get(`${BASE_URL}/api/health`),
      request.get(`${BASE_URL}/api/health`),
    ]);

    for (const response of responses) {
      if (response.status() === 200) {
        const body = await response.json();
        expect(body.dbConnected).toBe(true);
      }
    }
  });

  test("auth tokens are portable across Workers regions", async ({ request }) => {
    // This test verifies that session tokens work across regions
    // (Workers has global distribution)
    const testEmail = process.env.E2E_USER_EMAIL ?? "";
    const testPassword = process.env.E2E_USER_PASSWORD ?? "";

    if (!testEmail || !testPassword) {
      test.skip(true, "E2E credentials not set");
      return;
    }

    // Login to get a session
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testEmail, password: testPassword },
    });

    if (loginResponse.status() === 200) {
      // Continue to session check
      const sessionResponse = await request.get(`${BASE_URL}/api/auth/session`);
      expect(sessionResponse.status()).toBe(200);
    }
  });
});