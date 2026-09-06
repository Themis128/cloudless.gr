/**
 * Tests for src/lib/espocrm-queue.ts
 *
 * Covers:
 *  - isEspoQueueConfigured() — env var presence
 *  - enqueueEspoWebhook() — not configured, success, HTTP error, network error
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal("fetch", mockFetch);

import { isEspoQueueConfigured, enqueueEspoWebhook } from "@/lib/espocrm-queue";

beforeEach(() => {
  mockFetch.mockReset();
  // Clear env vars
  delete process.env.ESPOCRM_QUEUE_PRODUCER_URL;
  delete process.env.ESPOCRM_QUEUE_PRODUCER_SECRET;
});

// ---------------------------------------------------------------------------
describe("isEspoQueueConfigured", () => {
  it("returns false when both env vars are absent", () => {
    expect(isEspoQueueConfigured()).toBe(false);
  });

  it("returns false when only URL is set", () => {
    process.env.ESPOCRM_QUEUE_PRODUCER_URL = "https://queue.example.com";
    expect(isEspoQueueConfigured()).toBe(false);
  });

  it("returns false when only SECRET is set", () => {
    process.env.ESPOCRM_QUEUE_PRODUCER_SECRET = "secret";
    expect(isEspoQueueConfigured()).toBe(false);
  });

  it("returns true when both are set", () => {
    process.env.ESPOCRM_QUEUE_PRODUCER_URL = "https://queue.example.com";
    process.env.ESPOCRM_QUEUE_PRODUCER_SECRET = "secret";
    expect(isEspoQueueConfigured()).toBe(true);
  });

  it("returns false when values are only whitespace", () => {
    process.env.ESPOCRM_QUEUE_PRODUCER_URL = "   ";
    process.env.ESPOCRM_QUEUE_PRODUCER_SECRET = "   ";
    expect(isEspoQueueConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("enqueueEspoWebhook", () => {
  const MSG = { entity: "Contact", action: "create", records: [{ id: "c1" }] };

  it("returns false when not configured", async () => {
    await expect(enqueueEspoWebhook(MSG)).resolves.toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts JSON with Authorization header and returns true on 200", async () => {
    process.env.ESPOCRM_QUEUE_PRODUCER_URL = "https://queue.example.com/enqueue";
    process.env.ESPOCRM_QUEUE_PRODUCER_SECRET = "tok-secret";
    mockFetch.mockResolvedValue({ ok: true });

    const result = await enqueueEspoWebhook(MSG);
    expect(result).toBe(true);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://queue.example.com/enqueue");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-secret");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body.entity).toBe("Contact");
    expect(body.action).toBe("create");
    expect(body.records).toEqual([{ id: "c1" }]);
    expect(typeof body.enqueuedAt).toBe("string");
  });

  it("throws with HTTP error message on non-ok response", async () => {
    process.env.ESPOCRM_QUEUE_PRODUCER_URL = "https://queue.example.com/enqueue";
    process.env.ESPOCRM_QUEUE_PRODUCER_SECRET = "tok-secret";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue("Service Unavailable"),
    });

    await expect(enqueueEspoWebhook(MSG)).rejects.toThrow("503");
  });

  it("propagates network errors", async () => {
    process.env.ESPOCRM_QUEUE_PRODUCER_URL = "https://queue.example.com/enqueue";
    process.env.ESPOCRM_QUEUE_PRODUCER_SECRET = "tok-secret";
    mockFetch.mockRejectedValue(new Error("timeout"));

    await expect(enqueueEspoWebhook(MSG)).rejects.toThrow("timeout");
  });

  it("includes enqueuedAt ISO timestamp in payload", async () => {
    process.env.ESPOCRM_QUEUE_PRODUCER_URL = "https://q.example.com";
    process.env.ESPOCRM_QUEUE_PRODUCER_SECRET = "s";
    mockFetch.mockResolvedValue({ ok: true });

    const before = Date.now();
    await enqueueEspoWebhook(MSG);
    const after = Date.now();

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const { enqueuedAt } = JSON.parse(init.body as string);
    const ts = new Date(enqueuedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
