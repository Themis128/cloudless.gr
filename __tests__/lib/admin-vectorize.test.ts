/**
 * Tests for src/lib/admin-vectorize.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockIsWorkersAiConfigured, mockCallWorkersAiEmbed } = vi.hoisted(() => ({
  mockIsWorkersAiConfigured: vi.fn(),
  mockCallWorkersAiEmbed: vi.fn(),
}));

vi.mock("@/lib/workers-ai-client", () => ({
  isWorkersAiConfigured: mockIsWorkersAiConfigured,
  callWorkersAiEmbed: mockCallWorkersAiEmbed,
}));

import {
  isAdminVectorizeConfigured,
  upsertAdminVectors,
  queryAdminVectorize,
  type AdminVectorHit,
} from "@/lib/admin-vectorize";

type MockFetch = ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockIsWorkersAiConfigured.mockReset().mockReturnValue(true);
  mockCallWorkersAiEmbed.mockReset().mockResolvedValue([0.1, 0.2, 0.3]);
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_VECTORIZE_INDEX;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
});

function setupEnv() {
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct-123";
  process.env.CLOUDFLARE_API_TOKEN = "tok-xyz";
}

describe("isAdminVectorizeConfigured", () => {
  it("returns false when workers-ai is not configured", () => {
    mockIsWorkersAiConfigured.mockReturnValue(false);
    expect(isAdminVectorizeConfigured()).toBe(false);
  });

  it("returns false when CLOUDFLARE_ACCOUNT_ID is missing", () => {
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    expect(isAdminVectorizeConfigured()).toBe(false);
  });

  it("returns false when CLOUDFLARE_API_TOKEN is missing", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    expect(isAdminVectorizeConfigured()).toBe(false);
  });

  it("returns true when workers-ai and both CF vars are configured", () => {
    setupEnv();
    expect(isAdminVectorizeConfigured()).toBe(true);
  });
});

describe("upsertAdminVectors", () => {
  it("returns 0 immediately for empty docs array", async () => {
    expect(await upsertAdminVectors([])).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("throws when CF credentials are missing", async () => {
    const docs = [{ id: "d1", text: "text", title: "Title", source: "src" }];
    await expect(upsertAdminVectors(docs)).rejects.toThrow("CLOUDFLARE_ACCOUNT_ID");
  });

  it("upserts and returns the count of vectors", async () => {
    setupEnv();
    (globalThis.fetch as MockFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { count: 1 } }),
      text: () => Promise.resolve(""),
    });
    const docs = [{ id: "d1", text: "some text", title: "Title", source: "faq" }];
    const result = await upsertAdminVectors(docs);
    expect(result).toBe(1);
    expect(mockCallWorkersAiEmbed).toHaveBeenCalledWith("some text");
  });

  it("throws on non-ok response", async () => {
    setupEnv();
    (globalThis.fetch as MockFetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal error"),
    });
    const docs = [{ id: "d1", text: "text", title: "T", source: "s" }];
    await expect(upsertAdminVectors(docs)).rejects.toThrow("Vectorize upsert failed");
  });

  it("uses correct API URL with index name", async () => {
    setupEnv();
    process.env.CLOUDFLARE_VECTORIZE_INDEX = "my-custom-index";
    (globalThis.fetch as MockFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    });
    await upsertAdminVectors([{ id: "d1", text: "text", title: "T", source: "s" }]);
    const [url] = (globalThis.fetch as MockFetch).mock.calls[0];
    expect(url).toContain("my-custom-index");
    expect(url).toContain("acct-123");
  });
});

describe("queryAdminVectorize", () => {
  it("returns empty array when not configured", async () => {
    mockIsWorkersAiConfigured.mockReturnValue(false);
    expect(await queryAdminVectorize("test query")).toEqual([]);
  });

  it("returns empty array for empty/whitespace query", async () => {
    setupEnv();
    expect(await queryAdminVectorize("")).toEqual([]);
    expect(await queryAdminVectorize("  ")).toEqual([]);
  });

  it("returns mapped hits on success", async () => {
    setupEnv();
    (globalThis.fetch as MockFetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: {
            matches: [
              { id: "faq:1", score: 0.95, metadata: { title: "My FAQ", text: "Answer here", source: "appflowy-faq" } },
            ],
          },
        }),
    });
    const hits = await queryAdminVectorize("test");
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("faq:1");
    expect(hits[0].score).toBe(0.95);
    expect(hits[0].title).toBe("My FAQ");
    expect(hits[0].source).toBe("appflowy-faq");
  });

  it("returns empty array on failed fetch", async () => {
    setupEnv();
    (globalThis.fetch as MockFetch).mockResolvedValue({ ok: false, status: 503 });
    const hits = await queryAdminVectorize("query");
    expect(hits).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("uses topK from options", async () => {
    setupEnv();
    (globalThis.fetch as MockFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { matches: [] } }),
    });
    await queryAdminVectorize("query", { topK: 10 });
    const [, init] = (globalThis.fetch as MockFetch).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.topK).toBe(10);
  });

  it("uses default topK=5 when not specified", async () => {
    setupEnv();
    (globalThis.fetch as MockFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { matches: [] } }),
    });
    await queryAdminVectorize("query");
    const [, init] = (globalThis.fetch as MockFetch).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.topK).toBe(5);
  });

  it("falls back to id for title when metadata is missing", async () => {
    setupEnv();
    (globalThis.fetch as MockFetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: { matches: [{ id: "orphan-id", score: 0.5, metadata: {} }] },
        }),
    });
    const hits = await queryAdminVectorize("test");
    expect(hits[0].title).toBe("orphan-id");
    expect(hits[0].source).toBe("cms");
  });
});
