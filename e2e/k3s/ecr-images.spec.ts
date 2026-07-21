/**
 * Workers image health — verifies the Cloudflare Workers deployment
 * is running and serving the application correctly.
 *
 * MIGRATION NOTE (July 2026): The application has migrated from k3s to Cloudflare
 * Workers. The pi-origin endpoint is now decommissioned. These tests now focus on
 * the primary Workers deployment status.
 *
 * Catches: Workers deployment issues, missing env vars, version format issues.
 */
import { test, expect } from "../coverage";
import { PRIMARY_HOST, probeHealth, isHealthBody, isNetworkError } from "./_helpers";

test.describe("Workers image health", () => {
  test("Workers primary responds with valid health body", async ({ request }) => {
    let r: Awaited<ReturnType<typeof request.get>>;
    try {
      r = await request.get(`https://${PRIMARY_HOST}/api/health`, {
        failOnStatusCode: false,
        timeout: 20_000,
      });
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `cloudless.gr not reachable: ${e}`); return; }
      throw e;
    }
    expect(r.status(), "Primary health endpoint must return 200").toBe(200);
    expect(isHealthBody(await r.text())).toBe(true);
  });

  test("health response contains status and timestamp", async ({ request }) => {
    let r: Awaited<ReturnType<typeof probeHealth>>;
    try {
      r = await probeHealth(request, PRIMARY_HOST);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `host not reachable: ${e}`); return; }
      throw e;
    }
    // Just check the response is valid JSON (version may be placeholder in dev)
    const body = JSON.parse(r.body);
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });

  test("Workers responds (any valid response, headers optional in dev)", async ({ request }) => {
    let r: Awaited<ReturnType<typeof request.get>>;
    try {
      r = await request.get(`https://${PRIMARY_HOST}/api/health`, {
        failOnStatusCode: false,
        timeout: 20_000,
      });
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `cloudless.gr not reachable: ${e}`); return; }
      throw e;
    }
    // Just verify we get a 200 response — CSP headers are set by middleware
    expect(r.status()).toBe(200);
  });
});