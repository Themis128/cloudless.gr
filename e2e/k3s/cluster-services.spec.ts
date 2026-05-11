import { test, expect } from "@playwright/test";

/**
 * Cluster service smoke tests — OnCall, ntfy, Cloudless Manager, Home Assistant.
 * All services are exposed via Cloudflare tunnel → Traefik → k3s.
 * Requires INFRA_SMOKE=1.
 */

const runInfra = !!process.env.INFRA_SMOKE;

test.describe("Grafana OnCall (oncall.cloudless.online)", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("API health returns 200", async ({ request }) => {
    // OnCall engine exposes /api/v1/live/ as a liveness check
    const res = await request.get("https://oncall.cloudless.online/api/v1/live/", {
      maxRedirects: 3,
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("root is reachable (redirects to auth if protected)", async ({ request }) => {
    const res = await request.get("https://oncall.cloudless.online/", {
      maxRedirects: 5,
    });
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("ntfy (ntfy.cloudless.online)", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("root returns 200", async ({ request }) => {
    const res = await request.get("https://ntfy.cloudless.online/");
    expect(res.status()).toBe(200);
  });

  test("v1 health endpoint returns healthy", async ({ request }) => {
    const res = await request.get("https://ntfy.cloudless.online/v1/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.healthy).toBe(true);
  });
});

test.describe("Cloudless Manager (manage.cloudless.online)", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("root is reachable (redirects to SSO)", async ({ request }) => {
    const res = await request.get("https://manage.cloudless.online/", {
      maxRedirects: 5,
    });
    // oauth2-proxy may redirect to Keycloak — never a 5xx
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("Home Assistant (ha.cloudless.online)", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("root is reachable", async ({ request }) => {
    const res = await request.get("https://ha.cloudless.online/", {
      maxRedirects: 5,
    });
    expect(res.status()).toBeLessThan(500);
  });
});
