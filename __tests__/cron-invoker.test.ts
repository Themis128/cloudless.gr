/**
 * Unit tests for the Lambda cron-invoker.
 *
 * Cloudflare-first: CRON_SECRET comes from env (k8s / Wrangler), not SSM.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

async function loadHandler() {
  const mod = await import("../src/lambda/cron-invoker");
  return mod.handler;
}

describe("cron-invoker handler", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      SITE_URL: "https://example.test",
      CRON_ROUTE: "/api/cron/foo",
      CRON_SECRET: "s3cret",
      AWS_REGION: "us-east-1",
    };
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("throws when SITE_URL is missing", async () => {
    delete process.env.SITE_URL;
    const handler = await loadHandler();
    await expect(handler()).rejects.toThrow(/Missing env: SITE_URL=/);
  });

  it("throws when CRON_ROUTE is missing", async () => {
    delete process.env.CRON_ROUTE;
    const handler = await loadHandler();
    await expect(handler()).rejects.toThrow(/CRON_ROUTE=undefined/);
  });

  it("throws when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const handler = await loadHandler();
    await expect(handler()).rejects.toThrow(/CRON_SECRET env is required/);
  });

  it("calls the route with the env secret and returns the parsed body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, processed: 7 }),
      text: () => Promise.resolve(""),
    });
    globalThis.fetch = fetchMock;

    const handler = await loadHandler();
    const result = await handler();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/api/cron/foo");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer s3cret",
    });
    expect(result).toEqual({
      statusCode: 200,
      route: "/api/cron/foo",
      payload: { ok: true, processed: 7 },
    });
  });

  it("throws with a truncated body when the route responds non-OK", async () => {
    const longBody = "x".repeat(500);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve(null),
      text: () => Promise.resolve(longBody),
    });
    const handler = await loadHandler();
    await expect(handler()).rejects.toThrow(/Cron \/api\/cron\/foo responded 503: x{200}$/);
  });

  it("returns a null payload when the response body is not JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error("no body")),
      text: () => Promise.resolve(""),
    });
    const handler = await loadHandler();
    const result = await handler();
    expect(result).toEqual({
      statusCode: 204,
      route: "/api/cron/foo",
      payload: null,
    });
  });
});
