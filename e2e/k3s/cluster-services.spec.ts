import { test, expect } from "../coverage";

/**
 * Cluster service smoke tests — OnCall, ntfy, Cloudless Manager, Home Assistant.
 * All services are exposed via Cloudflare tunnel → Traefik → k3s.
 * Requires INFRA_SMOKE=1.
 */

const runInfra = !!process.env.INFRA_SMOKE;

const K3S_HOST = process.env.K3S_HOST ?? "cloudless.gr";

test.describe("Grafana OnCall", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("API health returns 200", async ({ request }) => {
    // OnCall engine exposes /api/v1/live/ as a liveness check
    const res = await request.get(`https://oncall.${K3S_HOST}/api/v1/live/`, {
      maxRedirects: 3,
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("root is reachable (redirects to auth if protected)", async ({ request }) => {
    const res = await request.get(`https://oncall.${K3S_HOST}/`, {
      maxRedirects: 5,
    });
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("ntfy", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("root returns 200", async ({ request }) => {
    const res = await request.get(`https://ntfy.${K3S_HOST}/`);
    expect(res.status()).toBe(200);
  });

  test("v1 health endpoint returns healthy", async ({ request }) => {
    const res = await request.get(`https://ntfy.${K3S_HOST}/v1/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.healthy).toBe(true);
  });
});

test.describe("Cloudless Manager", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("root is reachable (redirects to SSO)", async ({ request }) => {
    const res = await request.get(`https://manage.${K3S_HOST}/`, {
      maxRedirects: 5,
    });
    // oauth2-proxy may redirect to the IdP — never a 5xx
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("Home Assistant", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("root is reachable", async ({ request }) => {
    const res = await request.get(`https://ha.${K3S_HOST}/`, {
      maxRedirects: 5,
    });
    expect(res.status()).toBeLessThan(500);
  });
});
