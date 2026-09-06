/**
 * Tests for src/lib/meilisearch.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getMeiliHost,
  getMeiliAdminKey,
  getMeiliSearchKey,
  isMeilisearchConfigured,
  meiliRequest,
  indexProducts,
  resetIndex,
  PRODUCTS_INDEX,
  PRODUCT_EMBEDDER,
  type ProductDocument,
} from "@/lib/meilisearch";

type MockFetch = ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  delete process.env.MEILI_HOST;
  delete process.env.MEILI_ADMIN_KEY;
  delete process.env.MEILI_MASTER_KEY;
  delete process.env.MEILI_SEARCH_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.MEILI_HOST;
  delete process.env.MEILI_ADMIN_KEY;
  delete process.env.MEILI_MASTER_KEY;
  delete process.env.MEILI_SEARCH_KEY;
});

const DOC: ProductDocument = {
  id: "prod-1",
  name: "Hosting",
  description: "Fast hosting",
  price: 2900,
  currency: "EUR",
  category: "service",
};

function mockOk(body: unknown = {}) {
  return { ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve("") };
}

function mockErr(status: number, text = "error") {
  return { ok: false, status, json: () => Promise.resolve({}), text: () => Promise.resolve(text), statusText: "Error" };
}

describe("constants", () => {
  it("PRODUCTS_INDEX is a non-empty string", () => {
    expect(typeof PRODUCTS_INDEX).toBe("string");
    expect(PRODUCTS_INDEX.length).toBeGreaterThan(0);
  });

  it("PRODUCT_EMBEDDER is a non-empty string", () => {
    expect(typeof PRODUCT_EMBEDDER).toBe("string");
    expect(PRODUCT_EMBEDDER.length).toBeGreaterThan(0);
  });
});

describe("getMeiliHost", () => {
  it("returns empty string when not set", () => expect(getMeiliHost()).toBe(""));

  it("returns host from env", () => {
    process.env.MEILI_HOST = "https://search.example.com/";
    expect(getMeiliHost()).toBe("https://search.example.com");
  });
});

describe("getMeiliAdminKey", () => {
  it("returns empty string when not set", () => expect(getMeiliAdminKey()).toBe(""));

  it("returns MEILI_ADMIN_KEY when set", () => {
    process.env.MEILI_ADMIN_KEY = "admin-key";
    expect(getMeiliAdminKey()).toBe("admin-key");
  });

  it("falls back to MEILI_MASTER_KEY", () => {
    process.env.MEILI_MASTER_KEY = "master-key";
    expect(getMeiliAdminKey()).toBe("master-key");
  });
});

describe("getMeiliSearchKey", () => {
  it("returns MEILI_SEARCH_KEY when set", () => {
    process.env.MEILI_SEARCH_KEY = "search-key";
    expect(getMeiliSearchKey()).toBe("search-key");
  });

  it("falls back to admin key when search key absent", () => {
    process.env.MEILI_ADMIN_KEY = "admin-key";
    expect(getMeiliSearchKey()).toBe("admin-key");
  });
});

describe("isMeilisearchConfigured", () => {
  it("returns false when neither host nor key is set", () => {
    expect(isMeilisearchConfigured()).toBe(false);
  });

  it("returns false when only host is set", () => {
    process.env.MEILI_HOST = "https://search.example.com";
    expect(isMeilisearchConfigured()).toBe(false);
  });

  it("returns false when only key is set", () => {
    process.env.MEILI_SEARCH_KEY = "key";
    expect(isMeilisearchConfigured()).toBe(false);
  });

  it("returns true when both host and key are set", () => {
    process.env.MEILI_HOST = "https://search.example.com";
    process.env.MEILI_SEARCH_KEY = "key";
    expect(isMeilisearchConfigured()).toBe(true);
  });
});

describe("meiliRequest", () => {
  it("throws when MEILI_HOST is not configured", async () => {
    process.env.MEILI_SEARCH_KEY = "key";
    await expect(meiliRequest("/indexes")).rejects.toThrow("MEILI_HOST is not configured");
  });

  it("throws when no key is configured", async () => {
    process.env.MEILI_HOST = "https://search.example.com";
    await expect(meiliRequest("/indexes")).rejects.toThrow("not configured");
  });

  it("sends request to correct URL with auth header", async () => {
    process.env.MEILI_HOST = "https://search.example.com";
    process.env.MEILI_SEARCH_KEY = "my-search-key";
    (globalThis.fetch as MockFetch).mockResolvedValue(mockOk({ hits: [] }));
    await meiliRequest("/indexes");
    const [url, init] = (globalThis.fetch as MockFetch).mock.calls[0];
    expect(url).toBe("https://search.example.com/indexes");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer my-search-key");
  });

  it("throws on non-ok response", async () => {
    process.env.MEILI_HOST = "https://search.example.com";
    process.env.MEILI_SEARCH_KEY = "key";
    (globalThis.fetch as MockFetch).mockResolvedValue(mockErr(404, "Not found"));
    await expect(meiliRequest("/indexes/missing")).rejects.toThrow("Meilisearch 404");
  });
});

describe("indexProducts", () => {
  it("is a no-op when not configured", async () => {
    await indexProducts([DOC]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("is a no-op for empty documents array", async () => {
    process.env.MEILI_HOST = "https://s.example.com";
    process.env.MEILI_SEARCH_KEY = "key";
    await indexProducts([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("posts documents when configured", async () => {
    process.env.MEILI_HOST = "https://s.example.com";
    process.env.MEILI_SEARCH_KEY = "key";
    process.env.MEILI_ADMIN_KEY = "admin-key";
    (globalThis.fetch as MockFetch).mockResolvedValue(mockOk({ taskUid: 1 }));
    await indexProducts([DOC]);
    expect(globalThis.fetch).toHaveBeenCalled();
    const [url] = (globalThis.fetch as MockFetch).mock.calls[0];
    expect(url).toContain("/documents");
  });
});

describe("resetIndex", () => {
  it("is a no-op when Meilisearch is not configured", async () => {
    await resetIndex([DOC]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("deletes then recreates index and indexes documents", async () => {
    process.env.MEILI_HOST = "https://s.example.com";
    process.env.MEILI_SEARCH_KEY = "key";
    process.env.MEILI_ADMIN_KEY = "admin-key";
    (globalThis.fetch as MockFetch).mockResolvedValue(mockOk({ taskUid: 1 }));
    await resetIndex([DOC]);
    // Should have made 3 calls: DELETE, POST /indexes, POST /documents
    expect((globalThis.fetch as MockFetch).mock.calls.length).toBeGreaterThanOrEqual(3);
    const methods = (globalThis.fetch as MockFetch).mock.calls.map(
      ([, init]: [string, RequestInit]) => init.method
    );
    expect(methods).toContain("DELETE");
    expect(methods.filter((m: string) => m === "POST").length).toBeGreaterThanOrEqual(2);
  });

  it("ignores 404 when deleting non-existent index", async () => {
    process.env.MEILI_HOST = "https://s.example.com";
    process.env.MEILI_SEARCH_KEY = "key";
    process.env.MEILI_ADMIN_KEY = "admin-key";
    let callCount = 0;
    (globalThis.fetch as MockFetch).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockErr(404, "index_not_found"));
      return Promise.resolve(mockOk({ taskUid: callCount }));
    });
    await expect(resetIndex([DOC])).resolves.toBeUndefined();
  });
});
