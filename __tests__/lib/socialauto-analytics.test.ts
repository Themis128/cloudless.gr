import { describe, it, expect, vi, afterEach } from "vitest";

import { sendSocialAutoEvent } from "@/lib/socialauto-analytics";

function makeStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    _store: store,
  };
}

function stubBrowserEnv(search = "") {
  vi.stubGlobal("sessionStorage", makeStorage());
  vi.stubGlobal("localStorage", makeStorage());
  vi.stubGlobal("location", { search, pathname: "/landing" });
  vi.stubGlobal("document", { referrer: "https://linkedin.com/feed" });
}

function lastPostedBody(mockFetch: ReturnType<typeof vi.fn>) {
  const call = mockFetch.mock.calls.at(-1);
  return JSON.parse((call?.[1] as { body: string }).body);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendSocialAutoEvent", () => {
  it("captures utm_* params from the landing URL into payload", async () => {
    stubBrowserEnv("?utm_source=linkedin&utm_medium=paid&utm_campaign=boost");
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await sendSocialAutoEvent({ event: "page_view", domain: "cloudless.gr" });

    const body = lastPostedBody(mockFetch);
    expect(body.payload.utm_source).toBe("linkedin");
    expect(body.payload.utm_medium).toBe("paid");
    expect(body.payload.utm_campaign).toBe("boost");
  });

  it("persists first-touch UTMs for later events without URL params", async () => {
    stubBrowserEnv("?utm_source=linkedin&utm_campaign=boost");
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await sendSocialAutoEvent({ event: "page_view", domain: "cloudless.gr" });
    // Navigate internally — URL params gone, stored first-touch should apply
    vi.stubGlobal("location", { search: "", pathname: "/pricing" });
    await sendSocialAutoEvent({ event: "cta_click", domain: "cloudless.gr" });

    const body = lastPostedBody(mockFetch);
    expect(body.payload.utm_source).toBe("linkedin");
    expect(body.payload.utm_campaign).toBe("boost");
  });

  it("explicit event.payload values override captured UTMs", async () => {
    stubBrowserEnv("?utm_source=linkedin");
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await sendSocialAutoEvent({
      event: "page_view",
      domain: "cloudless.gr",
      payload: { utm_source: "newsletter" },
    });

    expect(lastPostedBody(mockFetch).payload.utm_source).toBe("newsletter");
  });

  it("auto-fills session_id, visitor_id, referrer defaults", async () => {
    stubBrowserEnv();
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await sendSocialAutoEvent({ event: "page_view", domain: "cloudless.gr" });

    const body = lastPostedBody(mockFetch);
    expect(body.session_id).toBeTruthy();
    expect(body.visitor_id).toBeTruthy();
    expect(body.referrer).toBe("https://linkedin.com/feed");
  });

  it("never throws when fetch rejects", async () => {
    stubBrowserEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net down")));
    await expect(
      sendSocialAutoEvent({ event: "page_view", domain: "cloudless.gr" })
    ).resolves.toBeUndefined();
  });
});
