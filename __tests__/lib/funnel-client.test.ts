import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/search-funnel", () => ({}));

import { getFunnelSessionId, trackFunnelEvent } from "@/lib/funnel-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getFunnelSessionId", () => {
  it("returns anon_ prefix when sessionStorage is undefined", () => {
    const original = globalThis.sessionStorage;
    Object.defineProperty(globalThis, "sessionStorage", { value: undefined, configurable: true });
    const id = getFunnelSessionId();
    expect(id.startsWith("anon_")).toBe(true);
    Object.defineProperty(globalThis, "sessionStorage", { value: original, configurable: true });
  });

  it("returns a non-empty string in normal env", () => {
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
    };
    vi.stubGlobal("sessionStorage", mockStorage);
    const id = getFunnelSessionId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns the same id on second call (session-stable)", () => {
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
    };
    vi.stubGlobal("sessionStorage", mockStorage);
    const id1 = getFunnelSessionId();
    const id2 = getFunnelSessionId();
    expect(id1).toBe(id2);
  });
});

describe("trackFunnelEvent", () => {
  it("is a no-op when fetch is not available", () => {
    const origFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", { value: undefined, configurable: true });
    expect(() => trackFunnelEvent("search_query" as never, {})).not.toThrow();
    Object.defineProperty(globalThis, "fetch", { value: origFetch, configurable: true });
  });

  it("is a no-op when no analytics consent", () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    Object.defineProperty(globalThis, "document", {
      value: { cookie: "" },
      configurable: true,
    });
    trackFunnelEvent("search_query" as never, {});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fires fetch when consent is granted", () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    const cookieValue = encodeURIComponent(JSON.stringify({ analytics: true }));
    Object.defineProperty(globalThis, "document", {
      value: { cookie: `cookieConsent=${cookieValue}` },
      configurable: true,
    });
    trackFunnelEvent("search_query" as never, { q: "test" });
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.lastCall as [string, RequestInit];
    expect(url).toBe("/api/analytics/track");
    expect((init as { method: string }).method).toBe("POST");
  });
});
