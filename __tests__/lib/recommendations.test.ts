import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getProducts: vi.fn() }));
vi.mock("@/lib/store-products", () => ({ getProducts: m.getProducts }));

import {
  getSimilarProducts,
  getTrendingProducts,
  resetRecommendationCache,
} from "@/lib/recommendations";

const PRODUCTS = [
  { id: "p1", name: "Cloud Audit", description: "audit", price: 300, category: "svc" },
  { id: "p2", name: "Migration", description: "move", price: 200, category: "svc" },
  { id: "p3", name: "Course", description: "learn", price: 100, category: "digital" },
];

const ai = (vec: number[] | null = [1, 0]) => ({
  run: vi.fn(async () => ({ data: vec ? [vec] : [] })),
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRecommendationCache();
  m.getProducts.mockResolvedValue(PRODUCTS);
});

describe("getSimilarProducts", () => {
  it("returns [] when no product matches the requested ids", async () => {
    expect(await getSimilarProducts({}, ["nope"])).toEqual([]);
  });

  it("falls back to same-category when there is no AI binding", async () => {
    const out = await getSimilarProducts({}, ["p1"]);
    expect(out.map((p) => p.id)).toEqual(["p2"]); // same category, excludes p1
  });

  it("falls back to same-category when embedding generation fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = { AI: { run: vi.fn(async () => Promise.reject(new Error("ai down"))) } };
    const out = await getSimilarProducts(env as never, ["p1"]);
    expect(out.map((p) => p.id)).toEqual(["p2"]);
    expect(warn).toHaveBeenCalledWith("[Recommendations] Workers AI embedding failed:", "ai down");
    warn.mockRestore();
  });

  it("returns [] data → category fallback too", async () => {
    const out = await getSimilarProducts({ AI: ai(null) } as never, ["p1"]);
    expect(out.map((p) => p.id)).toEqual(["p2"]);
  });

  it("ranks by cosine similarity when embeddings exist", async () => {
    const perCall = {
      p1: [1, 0],
      p2: [0.9, 0.1],
      p3: [-1, 0],
    };
    const env = {
      AI: {
        run: vi.fn(async (_model: string, inputs: { text: string[] }) => {
          const text = inputs.text[0];
          const id = Object.keys(perCall).find((k) => text.includes(k === "p1" ? "Cloud Audit" : k === "p2" ? "Migration" : "Course"));
          return { data: [perCall[id as keyof typeof perCall]] };
        }),
      },
    };
    const out = await getSimilarProducts(env as never, ["p1"]);
    expect(out.map((p) => p.id)).toEqual(["p2", "p3"]); // p2 more similar than p3
    expect(out).toHaveLength(2);
  });

  it("reuses the embedding cache across calls", async () => {
    const env = { AI: ai() };
    await getSimilarProducts(env as never, ["p1"]);
    const calls = env.AI.run.mock.calls.length;
    await getSimilarProducts(env as never, ["p1"]);
    expect(env.AI.run.mock.calls.length).toBe(calls); // cache hit — no new embeds
  });
});

describe("getTrendingProducts", () => {
  it("price-sorts when no D1 binding", async () => {
    const out = await getTrendingProducts({});
    expect(out.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("queries stripe_transaction and price-sorts on empty or populated rows", async () => {
    const all = vi.fn(async () => ({ results: [] }));
    const env = {
      AUTH_DB: { prepare: () => ({ bind: () => ({ all }) }) },
    };
    const out = await getTrendingProducts(env as never, 7, 2);
    expect(out.map((p) => p.id)).toEqual(["p1", "p2"]);

    const all2 = vi.fn(async () => ({ results: [{ payload_json: "{}" }] }));
    const env2 = { AUTH_DB: { prepare: () => ({ bind: () => ({ all: all2 }) }) } };
    expect((await getTrendingProducts(env2 as never)).length).toBe(3);
  });

  it("warns and price-sorts when the D1 query throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = {
      AUTH_DB: {
        prepare: () => ({ bind: () => ({ all: async () => Promise.reject(new Error("d1")) }) }),
      },
    };
    const out = await getTrendingProducts(env as never);
    expect(out.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(warn).toHaveBeenCalledWith(
      "[Recommendations] D1 trending failed, falling back to price sort:",
      "d1"
    );
    warn.mockRestore();
  });
});
