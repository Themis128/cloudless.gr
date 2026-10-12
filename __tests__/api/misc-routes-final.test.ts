/**
 * Final route batch — /api/debug-db, /api/experiments/[flagId],
 * /api/home-markdown, /api/internal/config, /api/newsletter/covers/[slug],
 * /api/products/recommendations, /api/recommendations, /api/search,
 * /api/user/delete, /api/workflows/hello.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const auth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    requireAuth: vi.fn(async () =>
      auth.ok
        ? { ok: true, user: { sub: "u1" } }
        : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
    ),
  };
});

const libs = vi.hoisted(() => ({
  getAuthDbFromEnv: vi.fn(),
  deleteUserAccount: vi.fn(),
  assignVariant: vi.fn(),
  getABFlags: vi.fn(async () => []),
  getDataLakeBucketFromEnv: vi.fn(),
  recommendProductsForProduct: vi.fn(),
  getProducts: vi.fn(),
  getSimilarProducts: vi.fn(),
  getTrendingProducts: vi.fn(),
  isMeilisearchConfigured: vi.fn(() => false),
  searchProductsFallback: vi.fn(),
  searchProductsWithMeili: vi.fn(),
  searchContent: vi.fn(),
}));
vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return {
    ...actual,
    getAuthDbFromEnv: libs.getAuthDbFromEnv,
    deleteUserAccount: libs.deleteUserAccount,
  };
});
vi.mock("@/lib/ab-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ab-flags")>();
  return {
    ...actual,
    assignVariant: libs.assignVariant,
    getABFlags: libs.getABFlags,
    DEFAULT_FLAGS: [
      {
        id: "hero",
        enabled: true,
        variants: { a: "Control", b: "Variant B" },
      },
    ],
  };
});
vi.mock("@/lib/r2-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/r2-client")>();
  return { ...actual, getDataLakeBucketFromEnv: libs.getDataLakeBucketFromEnv };
});
vi.mock("@/lib/product-recommendations", () => ({
  recommendProductsForProduct: libs.recommendProductsForProduct,
}));
vi.mock("@/lib/store-products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store-products")>();
  return { ...actual, getProducts: libs.getProducts };
});
vi.mock("@/lib/recommendations", () => libs);
vi.mock("@/lib/meilisearch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meilisearch")>();
  return { ...actual, isMeilisearchConfigured: libs.isMeilisearchConfigured };
});
vi.mock("@/lib/product-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/product-search")>();
  return {
    ...actual,
    searchProductsFallback: libs.searchProductsFallback,
    searchProductsWithMeili: libs.searchProductsWithMeili,
  };
});
vi.mock("@/lib/content-index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content-index")>();
  return { ...actual, searchContent: libs.searchContent };
});

import { GET as debugGet } from "@/app/api/debug-db/route";
import { GET as expGet } from "@/app/api/experiments/[flagId]/route";
import { GET as homeMdGet } from "@/app/api/home-markdown/route";
import { GET as internalConfigGet } from "@/app/api/internal/config/route";
import { GET as coverGet } from "@/app/api/newsletter/covers/[slug]/route";
import {
  GET as prodRecGet,
  POST as prodRecPost,
} from "@/app/api/products/recommendations/route";
import { GET as recGet } from "@/app/api/recommendations/route";
import { GET as searchGet } from "@/app/api/search/route";
import { POST as userDeletePost } from "@/app/api/user/delete/route";
import {
  GET as wfGet,
  POST as wfPost,
} from "@/app/api/workflows/hello/route";

const req = (url: string, init?: RequestInit) => new NextRequest(url, init);

beforeEach(() => {
  vi.clearAllMocks();
  auth.ok = true;
  libs.getABFlags.mockResolvedValue([]);
});

describe("debug-db", () => {
  it("reports connection states", async () => {
    libs.getAuthDbFromEnv.mockReturnValue(null);
    const j = await (await debugGet()).json();
    expect(j.dbConnected).toBe(false);
    expect(j.errorMessage).toContain("null");

    libs.getAuthDbFromEnv.mockReturnValue({});
    const j2 = await (await debugGet()).json();
    expect(j2.errorMessage).toContain("without prepare");

    libs.getAuthDbFromEnv.mockReturnValue({
      prepare: () => ({ first: async () => ({ ok: 1 }) }),
    });
    const j3 = await (await debugGet()).json();
    expect(j3.dbConnected).toBe(true);
    expect(j3.dbSource).toBe("getAuthDbFromEnv()");

    libs.getAuthDbFromEnv.mockReturnValue({
      prepare: () => ({ first: async () => null }),
    });
    expect((await (await debugGet()).json()).errorMessage).toContain(
      "Query failed"
    );

    libs.getAuthDbFromEnv.mockImplementation(() => {
      throw new Error("env boom");
    });
    expect((await (await debugGet()).json()).errorMessage).toContain(
      "Exception: env boom"
    );
  });
});

describe("experiments flag", () => {
  const params = (flagId: string) => ({
    params: Promise.resolve({ flagId }),
  });

  it("400 empty; 404 unknown; assigns + sets cookie only on change", async () => {
    expect(
      (await expGet(req("http://x/api/experiments/"), params(""))).status
    ).toBe(400);
    expect(
      (await expGet(req("http://x/api/experiments/nope"), params("nope"))).status
    ).toBe(404);

    libs.assignVariant.mockReturnValue("b");
    const res = await expGet(req("http://x/api/experiments/hero"), params("hero"));
    const j = await res.json();
    expect(j).toEqual({ id: "hero", enabled: true, variant: "b", label: "Variant B" });
    expect(res.headers.get("set-cookie")).toContain("ab_hero=b");

    // existing cookie == variant → no Set-Cookie
    const res2 = await expGet(
      req("http://x/api/experiments/hero", {
        headers: { cookie: "ab_hero=b" },
      }),
      params("hero")
    );
    expect(res2.headers.get("set-cookie")).toBeNull();
  });
});

describe("home-markdown", () => {
  it("serves markdown content type", async () => {
    const res = await homeMdGet();
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    expect(await res.text()).toContain("# Cloudless");
  });
});

describe("internal config", () => {
  it("503 unbound; key lookup 404/row; list without values; 500s", async () => {
    delete process.env.AUTH_DB;
    expect(
      (await internalConfigGet(req("http://x/api/internal/config?key=k"))).status
    ).toBe(503);

    const origEnv = process.env;
    const db = { prepare: vi.fn() };
    process.env = { AUTH_DB: db } as never;

    db.prepare.mockReturnValue({
      bind: () => ({ first: async () => null }),
    });
    expect(
      (await internalConfigGet(req("http://x/api/internal/config?key=k"))).status
    ).toBe(404);

    db.prepare.mockReturnValue({
      bind: () => ({
        first: async () => ({
          key: "k",
          value: "v",
          description: "d",
          updated_at: 1,
        }),
      }),
    });
    const j = await (
      await internalConfigGet(req("http://x/api/internal/config?key=k"))
    ).json();
    expect(j.value).toBe("v");

    db.prepare.mockReturnValue({
      bind: () => ({ first: async () => Promise.reject(new Error("d1 down")) }),
    });
    expect(
      (await internalConfigGet(req("http://x/api/internal/config?key=k"))).status
    ).toBe(500);

    db.prepare.mockReturnValue({
      all: async () => ({ results: [{ key: "a", description: "d", updated_at: 2 }] }),
    });
    const j2 = await (
      await internalConfigGet(req("http://x/api/internal/config"))
    ).json();
    expect(j2).toEqual({
      configs: [{ key: "a", description: "d", updated_at: 2 }],
      count: 1,
    });

    db.prepare.mockReturnValue({
      all: async () => Promise.reject(new Error("d1 list")),
    });
    expect(
      (await internalConfigGet(req("http://x/api/internal/config"))).status
    ).toBe(500);

    process.env = origEnv;
  });
});

describe("newsletter covers", () => {
  const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it("400 bad slug; 503 unbound; 404/200/500", async () => {
    expect(
      (await coverGet(req("http://x/api/newsletter/covers/a%20b"), params("a b")))
        .status
    ).toBe(400);

    libs.getDataLakeBucketFromEnv.mockReturnValue(null);
    expect(
      (await coverGet(req("http://x/api/newsletter/covers/x"), params("x"))).status
    ).toBe(503);

    const bucket = { get: vi.fn() };
    libs.getDataLakeBucketFromEnv.mockReturnValue(bucket);

    bucket.get.mockResolvedValue(null);
    expect(
      (await coverGet(req("http://x/api/newsletter/covers/x"), params("x"))).status
    ).toBe(404);
    expect(bucket.get).toHaveBeenCalledWith("newsletter/covers/x.png");

    // .png suffix stripped
    await coverGet(req("http://x/api/newsletter/covers/x.png"), params("x.png"));
    expect(bucket.get).toHaveBeenLastCalledWith("newsletter/covers/x.png");

    bucket.get.mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
    });
    const res = await coverGet(req("http://x/api/newsletter/covers/x"), params("x"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("immutable");

    bucket.get.mockRejectedValue(new Error("r2"));
    expect(
      (await coverGet(req("http://x/api/newsletter/covers/x"), params("x"))).status
    ).toBe(500);
  });
});

describe("products/recommendations", () => {
  it("GET: 400 missing id; clamps limit; similar recs", async () => {
    expect(
      (await prodRecGet(req("http://x/api/products/recommendations"))).status
    ).toBe(400);

    libs.recommendProductsForProduct.mockResolvedValue([{ id: "p2" }]);
    const j = await (
      await prodRecGet(
        req("http://x/api/products/recommendations?productId=p1&limit=99")
      )
    ).json();
    expect(j).toEqual({ productId: "p1", count: 1, recommendations: [{ id: "p2" }] });
    expect(libs.recommendProductsForProduct).toHaveBeenCalledWith("p1", 8);
  });

  it("POST: productId, context keyword match, 400 neither, 500 fail", async () => {
    const post = (body: unknown) =>
      prodRecPost(
        new Request("http://x/api/products/recommendations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      );

    libs.recommendProductsForProduct.mockResolvedValue([]);
    const j = await (await post({ productId: "p1" })).json();
    expect(j.productId).toBe("p1");

    libs.getProducts.mockResolvedValue([
      { name: "Cloud Audit", description: "infra review", category: "audit" },
      { name: "SEO Pack", description: "keywords", category: "seo" },
    ]);
    const j2 = await (await post({ context: "cloud infrastructure audit" })).json();
    expect(j2.count).toBe(1);
    expect(j2.recommendations[0].name).toBe("Cloud Audit");

    expect((await post({})).status).toBe(400);

    libs.getProducts.mockRejectedValue(new Error("store down"));
    expect((await post({ context: "x" })).status).toBe(500);
  });
});

describe("recommendations", () => {
  it("trending default; similar needs productIds; 500 → empty array", async () => {
    libs.getTrendingProducts.mockResolvedValue([
      {
        id: "p1",
        name: "n",
        description: "d",
        price: 1,
        currency: "EUR",
        category: "c",
        image: "i",
        extra: "stripped",
      },
    ]);
    const res = await recGet(req("http://x/api/recommendations?limit=5"));
    const j = await res.json();
    expect(j).toHaveLength(1);
    expect(j[0].extra).toBeUndefined();
    expect(libs.getTrendingProducts).toHaveBeenCalledWith({}, 30, 5);
    expect(res.headers.get("cache-control")).toContain("s-maxage=600");

    expect(
      (await recGet(req("http://x/api/recommendations?type=similar"))).status
    ).toBe(400);

    libs.getSimilarProducts.mockResolvedValue([]);
    await recGet(req("http://x/api/recommendations?type=similar&productIds=p1, p2"));
    expect(libs.getSimilarProducts).toHaveBeenCalledWith(
      {},
      ["p1", "p2"],
      4
    );

    libs.getTrendingProducts.mockRejectedValue(new Error("down"));
    const res2 = await recGet(req("http://x/api/recommendations"));
    expect(res2.status).toBe(500);
    expect(await res2.json()).toEqual([]);
  });
});

describe("search", () => {
  it("empty → source:empty; meilisearch path; fallback; meili failure fallback", async () => {
    const j = await (await searchGet(req("http://x/api/search"))).json();
    expect(j.source).toBe("empty");

    libs.isMeilisearchConfigured.mockReturnValue(true);
    libs.searchProductsWithMeili.mockResolvedValue([{ id: "p" }]);
    libs.searchContent.mockResolvedValue([{ slug: "s" }]);
    const j2 = await (
      await searchGet(req("http://x/api/search?q=cloud&limit=30"))
    ).json();
    expect(j2).toEqual({
      query: "cloud",
      source: "meilisearch",
      hits: [{ id: "p" }],
      content: [{ slug: "s" }],
    });
    expect(libs.searchProductsWithMeili).toHaveBeenCalledWith("cloud", 20);

    libs.searchProductsWithMeili.mockRejectedValue(new Error("meili down"));
    libs.searchProductsFallback.mockResolvedValue([{ id: "fb" }]);
    const j3 = await (
      await searchGet(req("http://x/api/search?q=cloud"))
    ).json();
    expect(j3.source).toBe("fallback");
    expect(j3.hits).toEqual([{ id: "fb" }]);

    libs.isMeilisearchConfigured.mockReturnValue(false);
    const j4 = await (
      await searchGet(req("http://x/api/search?q=x"))
    ).json();
    expect(j4.source).toBe("fallback");
  });
});

describe("user delete", () => {
  const del = () =>
    userDeletePost(req("http://x/api/user/delete", { method: "POST" }));

  it("401 anon; 503 unbound; 404 missing; ok; 500 on throw", async () => {
    auth.ok = false;
    expect((await del()).status).toBe(401);
    auth.ok = true;

    libs.getAuthDbFromEnv.mockReturnValue(null);
    expect((await del()).status).toBe(503);

    libs.getAuthDbFromEnv.mockReturnValue({});
    libs.deleteUserAccount.mockResolvedValue(false);
    expect((await del()).status).toBe(404);

    libs.deleteUserAccount.mockResolvedValue(true);
    const j = await (await del()).json();
    expect(j).toEqual({ ok: true, provider: "d1" });
    expect(libs.deleteUserAccount).toHaveBeenCalledWith({}, "u1");

    libs.deleteUserAccount.mockRejectedValue(new Error("d1"));
    expect((await del()).status).toBe(500);
  });
});

describe("workflows hello", () => {
  it("503s both verbs", async () => {
    for (const res of [await wfGet(), await wfPost()]) {
      expect(res.status).toBe(503);
      expect((await res.json()).error).toContain("Cloudflare Workers");
    }
  });
});
