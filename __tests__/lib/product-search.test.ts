import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/store-products", () => ({
  getProducts: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/workers-ai-client", () => ({
  embedTextWithWorkersAi: vi.fn(),
  WORKERS_AI_EMBED_DIMENSIONS: 1024,
}));
vi.mock("@/lib/meilisearch", () => ({
  isMeilisearchConfigured: vi.fn().mockReturnValue(false),
  meiliRequest: vi.fn(),
  getMeiliAdminKey: vi.fn().mockReturnValue(""),
  PRODUCT_EMBEDDER: "productEmbedder",
  PRODUCTS_INDEX: "products",
}));

import { meiliRequest, isMeilisearchConfigured } from "@/lib/meilisearch";
import { productToSearchText, productToSearchDocument } from "@/lib/product-search";

const sampleProduct = {
  id: "srv-cloud",
  name: "Cloud Audit",
  description: "Full cloud audit",
  price: 200000,
  currency: "eur",
  category: "service" as const,
  image: "/store/cloud.svg",
  features: ["Cost savings", "Security review"],
};

describe("productToSearchText", () => {
  it("concatenates name, category, description, and features", () => {
    const text = productToSearchText(sampleProduct);
    expect(text).toContain("Cloud Audit");
    expect(text).toContain("service");
    expect(text).toContain("Full cloud audit");
    expect(text).toContain("Cost savings");
    expect(text).toContain("Security review");
  });

  it("handles missing features", () => {
    const text = productToSearchText({ ...sampleProduct, features: undefined });
    expect(text).toContain("Cloud Audit");
    expect(text).not.toContain("undefined");
  });

  it("handles empty strings gracefully", () => {
    const text = productToSearchText({ ...sampleProduct, name: "", description: "" });
    expect(typeof text).toBe("string");
  });
});

describe("productToSearchDocument", () => {
  it("maps a product to a search document", () => {
    const doc = productToSearchDocument(sampleProduct);
    expect(doc.id).toBe("srv-cloud");
    expect(doc.name).toBe("Cloud Audit");
    expect(doc.category).toBe("service");
    expect(doc.description).toBe("Full cloud audit");
    expect(doc.href).toBe("/store/srv-cloud");
    expect(typeof doc.text).toBe("string");
    expect(doc.text.length).toBeGreaterThan(0);
  });

  it("omits price field when product has no price string", () => {
    const product = { ...sampleProduct, price: 0 };
    const doc = productToSearchDocument(product as typeof sampleProduct & { price: number });
    expect(doc.price).toBeUndefined();
  });
});

describe("reindex task polling tails", () => {
  const meili = vi.mocked(meiliRequest);
  const configured = vi.mocked(isMeilisearchConfigured);

  beforeEach(() => {
    vi.clearAllMocks();
    configured.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls /tasks until the index task succeeds", async () => {
    const { reindexProductsWithEmbeddings } = await import("@/lib/product-search");
    meili.mockImplementation(async (path: string) => {
      if (path === "/tasks/2") {
        const calls = meili.mock.calls.filter(([u]) => u === "/tasks/2").length;
        return calls === 1 ? { status: "processing" } : { status: "succeeded" };
      }
      if (path.startsWith("/tasks/")) return { status: "succeeded" };
      return { taskUid: 2 };
    });

    const result = await reindexProductsWithEmbeddings();
    expect(result.indexed).toBe(0);
    const paths = meili.mock.calls.map(([u]) => u);
    expect(paths).toContain("/indexes/products");
    expect(paths).toContain("/tasks/2");
  }, 10_000);

  it("times out when the task never finishes", async () => {
    const { reindexProductsWithEmbeddings } = await import("@/lib/product-search");
    meili.mockImplementation(async (path: string) =>
      path.startsWith("/tasks/") ? { status: "processing" } : { taskUid: 9 }
    );

    vi.useFakeTimers();
    const pending = reindexProductsWithEmbeddings();
    const assertion = expect(pending).rejects.toThrow(
      "Timed out waiting for Meilisearch task 9"
    );
    await vi.advanceTimersByTimeAsync(61_000);
    await assertion;
  });

  it("tolerates a 409 index_already_exists on create, rethrows other errors", async () => {
    const { reindexProductsWithEmbeddings } = await import("@/lib/product-search");
    meili.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/tasks/")) return { status: "succeeded" };
      if (path === "/indexes" && init?.method === "POST")
        throw new Error("409 index_already_exists");
      return { taskUid: 3 };
    });
    const result = await reindexProductsWithEmbeddings();
    expect(result.indexed).toBe(0);

    meili.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/indexes" && init?.method === "POST")
        throw new Error("meili exploded");
      if (path.startsWith("/tasks/")) return { status: "succeeded" };
      return { taskUid: 3 };
    });
    await expect(reindexProductsWithEmbeddings()).rejects.toThrow("meili exploded");
  });
});
