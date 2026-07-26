/**
 * Unit tests for the Lambda cron-invoker.
 *
 * The handler fetches CRON_SECRET from SSM, then GETs a route on the public
 * site with the secret in an Authorization header. These tests cover the
 * env-validation branches, the SSM lookup, the HTTP path, and the error
 * messages — without touching the network or AWS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: class {
    send = sendMock;
  },
  GetParameterCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

async function loadHandler() {
  const mod = await import("../src/lambda/cron-invoker");
  return mod.handler;
}

describe("cron-invoker handler", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    process.env = {
      ...ORIGINAL_ENV,
      SITE_URL: "https://example.test",
      CRON_ROUTE: "/api/cron/foo",
      SSM_PREFIX: "/test/prefix",
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

  it("throws when SSM returns no secret value", async () => {
    sendMock.mockResolvedValueOnce({ Parameter: { Value: "" } });
    const handler = await loadHandler();
    await expect(handler()).rejects.toThrow("CRON_SECRET not found at /test/prefix/CRON_SECRET");
  });

  it("calls the route with the SSM secret and returns the parsed body", async () => {
    sendMock.mockResolvedValueOnce({ Parameter: { Value: "s3cret" } });
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

  it("uses default SSM_PREFIX when env var is unset", async () => {
    delete process.env.SSM_PREFIX;
    sendMock.mockResolvedValueOnce({ Parameter: { Value: "x" } });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(null),
      text: () => Promise.resolve(""),
    });
    const handler = await loadHandler();
    await handler();
    const ssmCallArg = sendMock.mock.calls[0][0];
    expect(ssmCallArg.input.Name).toBe("/cloudless/production/CRON_SECRET");
  });

  it("throws with a truncated body when the route responds non-OK", async () => {
    sendMock.mockResolvedValueOnce({ Parameter: { Value: "s" } });
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
    sendMock.mockResolvedValueOnce({ Parameter: { Value: "s" } });
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
