import { describe, it, expect, vi, afterEach } from "vitest";
import { clearSessionCache, fetchWithAuth } from "@/lib/fetch-with-auth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clearSessionCache", () => {
  it("is a no-op (does not throw)", () => {
    expect(() => clearSessionCache()).not.toThrow();
  });
});

describe("fetchWithAuth", () => {
  it("calls globalThis.fetch with same-origin credentials by default", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    await fetchWithAuth("http://localhost/api/test");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.credentials).toBe("same-origin");
  });

  it("merges caller-provided headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    await fetchWithAuth("http://localhost/api/test", {
      headers: { "X-Custom": "value" },
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Custom"]).toBe("value");
  });

  it("respects caller-provided credentials override", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    await fetchWithAuth("http://localhost/api/test", { credentials: "include" });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.credentials).toBe("include");
  });

  it("passes the URL through to fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    await fetchWithAuth("http://localhost/api/my-route");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost/api/my-route");
  });
});
