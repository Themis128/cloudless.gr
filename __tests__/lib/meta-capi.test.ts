import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isCapiConfigured, sendCapiEvent } from "@/lib/meta-capi";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal("fetch", mockFetch);
  delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  delete process.env.META_CAPI_ACCESS_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isCapiConfigured", () => {
  it("returns false when both env vars are missing", () => {
    expect(isCapiConfigured()).toBe(false);
  });

  it("returns false when only pixel ID is set", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "12345";
    expect(isCapiConfigured()).toBe(false);
  });

  it("returns false when only access token is set", () => {
    process.env.META_CAPI_ACCESS_TOKEN = "token";
    expect(isCapiConfigured()).toBe(false);
  });

  it("returns true when both env vars are set", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "12345";
    process.env.META_CAPI_ACCESS_TOKEN = "token";
    expect(isCapiConfigured()).toBe(true);
  });
});

describe("sendCapiEvent", () => {
  it("returns skipped result when not configured", async () => {
    const result = await sendCapiEvent("Lead", { eventId: "evt-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain("not configured");
    }
  });

  it("returns skipped result when eventId is missing", async () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "12345";
    process.env.META_CAPI_ACCESS_TOKEN = "token";
    const result = await sendCapiEvent("Lead", { eventId: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain("eventId");
    }
  });

  it("sends POST to Meta CAPI when configured", async () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "12345";
    process.env.META_CAPI_ACCESS_TOKEN = "access-token";
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    });

    const result = await sendCapiEvent("Lead", {
      eventId: "evt-abc",
      email: "user@example.com",
      clientUserAgent: "Mozilla/5.0",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.lastCall as [string, RequestInit];
    expect(url).toContain("12345");
    expect(url).toContain("events");
    const body = JSON.parse(init.body as string);
    expect(body.data[0].event_name).toBe("Lead");
    expect(body.data[0].event_id).toBe("evt-abc");
    expect(result.ok).toBe(true);
  });

  it("returns error result when fetch fails", async () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "12345";
    process.env.META_CAPI_ACCESS_TOKEN = "access-token";
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await sendCapiEvent("Lead", { eventId: "evt-xyz" });
    expect(result.ok).toBe(false);
  });
});
