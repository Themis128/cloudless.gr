/**
 * Tests for src/lib/kuma.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetConfig } = vi.hoisted(() => ({ mockGetConfig: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

import { getKumaSummary, resetKumaCache } from "@/lib/kuma";

type MockFetch = ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetKumaCache();
  mockGetConfig.mockResolvedValue({
    KUMA_BASE_URL: "https://kuma.example.com",
    KUMA_STATUS_PAGE_SLUG: "testslug",
  });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  resetKumaCache();
});

function makePageResponse(groups: object[]) {
  return {
    ok: true,
    json: () => Promise.resolve({ publicGroupList: groups }),
  };
}

function makeHbResponse(heartbeatList: object) {
  return {
    ok: true,
    json: () => Promise.resolve({ heartbeatList }),
  };
}

function stubFetch(pageResp: object, hbResp: object) {
  let count = 0;
  (globalThis.fetch as MockFetch).mockImplementation(() =>
    Promise.resolve(count++ === 0 ? pageResp : hbResp)
  );
}

describe("getKumaSummary", () => {
  it("returns null when page fetch returns non-ok status", async () => {
    (globalThis.fetch as MockFetch).mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    expect(await getKumaSummary()).toBeNull();
  });

  it("returns null on network error", async () => {
    (globalThis.fetch as MockFetch).mockRejectedValue(new Error("Network error"));
    expect(await getKumaSummary()).toBeNull();
  });

  it("returns summary with baseUrl, slug, fetchedAt, and monitors", async () => {
    stubFetch(
      makePageResponse([
        { name: "Services", monitorList: [{ id: 1, name: "cloudless.gr" }] },
      ]),
      makeHbResponse({ "1": [{ status: 1, time: "2026-09-06T10:00:00Z", ping: 42 }] })
    );
    const result = await getKumaSummary();
    expect(result).not.toBeNull();
    expect(result!.baseUrl).toBe("https://kuma.example.com");
    expect(result!.slug).toBe("testslug");
    expect(result!.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result!.monitors).toHaveLength(1);
  });

  it("maps status 1 → up", async () => {
    stubFetch(
      makePageResponse([{ name: "G", monitorList: [{ id: 1, name: "M" }] }]),
      makeHbResponse({ "1": [{ status: 1, time: "t", ping: 10 }] })
    );
    const result = await getKumaSummary();
    expect(result!.monitors[0].status).toBe("up");
    expect(result!.monitors[0].pingMs).toBe(10);
  });

  it("maps status 0 → down", async () => {
    stubFetch(
      makePageResponse([{ name: "G", monitorList: [{ id: 2, name: "API" }] }]),
      makeHbResponse({ "2": [{ status: 0, time: "t", ping: 100 }] })
    );
    const result = await getKumaSummary();
    expect(result!.monitors[0].status).toBe("down");
  });

  it("maps status 2 → pending", async () => {
    stubFetch(
      makePageResponse([{ name: "G", monitorList: [{ id: 3, name: "DB" }] }]),
      makeHbResponse({ "3": [{ status: 2, time: "t" }] })
    );
    const result = await getKumaSummary();
    expect(result!.monitors[0].status).toBe("pending");
  });

  it("returns pending and null ping when no heartbeat for monitor", async () => {
    stubFetch(
      makePageResponse([{ name: "G", monitorList: [{ id: 99, name: "Orphan" }] }]),
      makeHbResponse({})
    );
    const result = await getKumaSummary();
    const m = result!.monitors[0];
    expect(m.status).toBe("pending");
    expect(m.pingMs).toBeNull();
    expect(m.lastHeartbeatAt).toBeNull();
  });

  it("sets groupName from page group name", async () => {
    stubFetch(
      makePageResponse([
        { name: "My Group", monitorList: [{ id: 1, name: "X" }] },
      ]),
      makeHbResponse({})
    );
    const result = await getKumaSummary();
    expect(result!.monitors[0].groupName).toBe("My Group");
  });

  it("falls back to Monitors when group name is missing", async () => {
    stubFetch(
      makePageResponse([{ monitorList: [{ id: 1, name: "X" }] }]),
      makeHbResponse({})
    );
    const result = await getKumaSummary();
    expect(result!.monitors[0].groupName).toBe("Monitors");
  });

  it("handles multiple groups and monitors", async () => {
    stubFetch(
      makePageResponse([
        { name: "G1", monitorList: [{ id: 1, name: "A" }, { id: 2, name: "B" }] },
        { name: "G2", monitorList: [{ id: 3, name: "C" }] },
      ]),
      makeHbResponse({
        "1": [{ status: 1, time: "t1", ping: 5 }],
        "2": [{ status: 0, time: "t2", ping: 50 }],
        "3": [{ status: 1, time: "t3", ping: 15 }],
      })
    );
    const result = await getKumaSummary();
    expect(result!.monitors).toHaveLength(3);
    expect(result!.monitors[0].groupName).toBe("G1");
    expect(result!.monitors[2].groupName).toBe("G2");
  });

  it("uses last heartbeat entry from the list", async () => {
    stubFetch(
      makePageResponse([{ name: "G", monitorList: [{ id: 1, name: "M" }] }]),
      makeHbResponse({
        "1": [
          { status: 0, time: "old", ping: 999 },
          { status: 1, time: "new", ping: 7 },
        ],
      })
    );
    const result = await getKumaSummary();
    expect(result!.monitors[0].status).toBe("up");
    expect(result!.monitors[0].pingMs).toBe(7);
    expect(result!.monitors[0].lastHeartbeatAt).toBe("new");
  });

  it("handles failed heartbeat fetch gracefully", async () => {
    let count = 0;
    (globalThis.fetch as MockFetch).mockImplementation(() => {
      count++;
      if (count === 1) return Promise.resolve(makePageResponse([{ name: "G", monitorList: [{ id: 1, name: "M" }] }]));
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    const result = await getKumaSummary();
    expect(result).not.toBeNull();
    expect(result!.monitors[0].status).toBe("pending");
  });
});

describe("resetKumaCache", () => {
  it("forces re-read of config on next call", async () => {
    stubFetch(
      makePageResponse([{ name: "G", monitorList: [{ id: 1, name: "M" }] }]),
      makeHbResponse({ "1": [{ status: 1, time: "t", ping: 1 }] })
    );
    await getKumaSummary(); // primes cache
    resetKumaCache();
    mockGetConfig.mockResolvedValue({
      KUMA_BASE_URL: "https://new.example.com",
      KUMA_STATUS_PAGE_SLUG: "newslug",
    });
    let count = 0;
    (globalThis.fetch as MockFetch).mockImplementation(() =>
      Promise.resolve(count++ === 0 ? makePageResponse([]) : makeHbResponse({}))
    );
    const result = await getKumaSummary();
    expect(result!.baseUrl).toBe("https://new.example.com");
    expect(result!.slug).toBe("newslug");
  });
});
