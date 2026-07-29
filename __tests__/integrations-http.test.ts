/**
 * Tests for src/lib/integration-http.ts — the shared integrationFetch wrapper.
 *
 * Phase 1 of the Integration Improvement Plan: prove the wrapper handles
 * timeout, retry, 429/5xx backoff, error wrapping, and passthrough mode
 * correctly before migrating existing clients onto it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  integrationFetch,
  integrationFetchWithMeta,
  IntegrationError,
  isIntegrationError,
} from "../src/lib/integration-http";

/**
 * Build a fake fetch that returns successive Response objects (one per call).
 * Lets us script the retry behaviour deterministically.
 */
function scriptedFetch(...responses: Array<Response | (() => Response)>) {
  let i = 0;
  return vi.fn(async (): Promise<Response> => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return typeof r === "function" ? r() : r;
  });
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("integrationFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on a 200", async () => {
    globalThis.fetch = scriptedFetch(jsonResponse({ hello: "world" }));
    const data = await integrationFetch<{ hello: string }>("test", "https://example.test/x");
    expect(data).toEqual({ hello: "world" });
  });

  it("retries on 500 then succeeds", async () => {
    const fetchMock = scriptedFetch(
      jsonResponse({ err: "x" }, 500),
      jsonResponse({ err: "x" }, 500),
      jsonResponse({ ok: true })
    );
    globalThis.fetch = fetchMock;

    const promise = integrationFetchWithMeta<{ ok: boolean }>(
      "test",
      "https://example.test/x",
      undefined,
      { backoffMs: 1 } // fast backoff for the test
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.data).toEqual({ ok: true });
    expect(result.status).toBe(200);
    expect(result.retries).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries on 429 honoring Retry-After header (seconds)", async () => {
    const fetchMock = scriptedFetch(
      new Response("rate limit", {
        status: 429,
        headers: { "Retry-After": "2" },
      }),
      jsonResponse({ ok: true })
    );
    globalThis.fetch = fetchMock;

    const promise = integrationFetchWithMeta<{ ok: boolean }>(
      "test",
      "https://example.test/x",
      undefined,
      { backoffMs: 1 }
    );
    await vi.advanceTimersByTimeAsync(2_500); // 2 s for Retry-After + slack
    const result = await promise;

    expect(result.data).toEqual({ ok: true });
    expect(result.retries).toBe(1);
  });

  it("retries on 429 without Retry-After, using exponential backoff", async () => {
    const fetchMock = scriptedFetch(
      new Response("limit", { status: 429 }),
      jsonResponse({ ok: true })
    );
    globalThis.fetch = fetchMock;

    const promise = integrationFetchWithMeta<{ ok: boolean }>(
      "test",
      "https://example.test/x",
      undefined,
      { backoffMs: 10 }
    );
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result.retries).toBe(1);
    expect(result.data).toEqual({ ok: true });
  });

  it("throws IntegrationError on non-retried 4xx", async () => {
    globalThis.fetch = scriptedFetch(
      () => new Response("nope", { status: 404, headers: { "x-debug": "1" } })
    );
    let caught: unknown;
    try {
      await integrationFetch("test", "https://example.test/x");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(IntegrationError);
    expect(isIntegrationError(caught)).toBe(true);
    expect(isIntegrationError(caught, 404)).toBe(true);
    expect(isIntegrationError(caught, 500)).toBe(false);
    if (caught instanceof IntegrationError) {
      expect(caught.integration).toBe("test");
      expect(caught.status).toBe(404);
      expect(caught.body).toBe("nope");
    }
  });

  it("does not retry 4xx (other than 429)", async () => {
    const fetchMock = scriptedFetch(
      new Response("bad", { status: 400 }),
      jsonResponse({ ok: true })
    );
    globalThis.fetch = fetchMock;
    await expect(integrationFetch("test", "https://example.test/x")).rejects.toThrow(
      IntegrationError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns body even on non-ok when passthroughErrors=true", async () => {
    globalThis.fetch = scriptedFetch(jsonResponse({ msg: "conflict" }, 409));
    const result = await integrationFetchWithMeta<{ msg: string }>(
      "test",
      "https://example.test/x",
      undefined,
      { passthroughErrors: true }
    );
    expect(result.status).toBe(409);
    expect(result.data).toEqual({ msg: "conflict" });
  });

  it("handles 204 No Content cleanly", async () => {
    globalThis.fetch = scriptedFetch(new Response(null, { status: 204 }));
    const result = await integrationFetchWithMeta("test", "https://example.test/x");
    expect(result.status).toBe(204);
    expect(result.data).toBeUndefined();
  });

  it("returns text for non-JSON content-type", async () => {
    globalThis.fetch = scriptedFetch(
      new Response("hello", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    const data = await integrationFetch<string>("test", "https://example.test/x");
    expect(data).toBe("hello");
  });

  it("gives up after maxRetries 5xx in a row", async () => {
    const fetchMock = scriptedFetch(
      jsonResponse({}, 500),
      jsonResponse({}, 500),
      jsonResponse({}, 500),
      jsonResponse({}, 500)
    );
    globalThis.fetch = fetchMock;
    const promise = integrationFetch("test", "https://example.test/x", undefined, {
      backoffMs: 1,
      maxRetries: 2,
    });
    const assertion = expect(promise).rejects.toThrow(IntegrationError);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("propagates network errors after exhausting retries", async () => {
    const netErr = new Error("ECONNREFUSED");
    globalThis.fetch = vi.fn(async () => {
      throw netErr;
    });
    const promise = integrationFetch("test", "https://example.test/x", undefined, {
      backoffMs: 1,
      maxRetries: 1,
    });
    const assertion = expect(promise).rejects.toThrow("ECONNREFUSED");
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
  });
});

describe("isIntegrationError", () => {
  it("narrows IntegrationError", () => {
    const err = new IntegrationError("x", 500, "boom");
    expect(isIntegrationError(err)).toBe(true);
    expect(isIntegrationError(err, 500)).toBe(true);
    expect(isIntegrationError(err, 404)).toBe(false);
  });
  it("returns false for non-IntegrationError", () => {
    expect(isIntegrationError(new Error("plain"))).toBe(false);
    expect(isIntegrationError("string")).toBe(false);
    expect(isIntegrationError(null)).toBe(false);
  });
});
