import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  meiliRequest: vi.fn(),
  getMeiliAdminKey: vi.fn(),
  getMeiliSearchKey: vi.fn(),
  isMeilisearchConfigured: vi.fn(),
  getPosts: vi.fn(),
  getDocs: vi.fn(),
  isAppFlowyConfigured: vi.fn(),
}));

vi.mock("@/lib/meilisearch", () => ({
  meiliRequest: m.meiliRequest,
  getMeiliAdminKey: m.getMeiliAdminKey,
  getMeiliSearchKey: m.getMeiliSearchKey,
  isMeilisearchConfigured: m.isMeilisearchConfigured,
}));
vi.mock("@/lib/appflowy-blog", () => ({ getPosts: m.getPosts }));
vi.mock("@/lib/appflowy-docs", () => ({ getDocs: m.getDocs }));
vi.mock("@/lib/appflowy", () => ({ isAppFlowyConfigured: m.isAppFlowyConfigured }));

import { syncContentIndex, searchContent, CONTENT_INDEX } from "@/lib/content-index";

beforeEach(() => {
  vi.clearAllMocks();
  m.isMeilisearchConfigured.mockReturnValue(true);
  m.isAppFlowyConfigured.mockResolvedValue(true);
  m.getMeiliAdminKey.mockReturnValue("admin-key");
  m.getMeiliSearchKey.mockReturnValue("search-key");
  m.getPosts.mockResolvedValue([]);
  m.getDocs.mockResolvedValue([]);
  m.meiliRequest.mockResolvedValue({});
});

describe("syncContentIndex", () => {
  it("returns unconfigured when meili or appflowy is off", async () => {
    m.isMeilisearchConfigured.mockReturnValue(false);
    expect(await syncContentIndex()).toEqual({
      indexed: 0,
      configured: false,
      sources: { blog: 0, docs: 0 },
    });
    m.isMeilisearchConfigured.mockReturnValue(true);
    m.isAppFlowyConfigured.mockResolvedValue(false);
    expect((await syncContentIndex()).configured).toBe(false);
  });

  it("indexes published blog posts and docs only", async () => {
    m.getPosts.mockResolvedValue([
      {
        slug: "a",
        title: "Post A",
        html: "<p>Hello <b>world</b></p>",
        excerpt: "",
        category: "Cloud",
        date: "2026-01-01",
        published: true,
      },
      { slug: "draft", title: "Draft", html: "", published: false },
    ]);
    m.getDocs.mockResolvedValue([
      { slug: "d1", title: "Doc", html: "<i>x</i>", description: "desc", category: "Ops", published: true },
    ]);
    const out = await syncContentIndex();
    expect(out).toEqual({ indexed: 2, configured: true, sources: { blog: 1, docs: 1 } });
    const docsPost = m.meiliRequest.mock.calls.find((c) =>
      String(c[0]).includes("/documents")
    );
    const docs = JSON.parse(docsPost[1].body);
    expect(docs[0]).toMatchObject({
      id: "blog:a",
      type: "blog",
      body: "Hello world",
      url: "/blog/a",
    });
    expect(docs[0].excerpt).toBe("Hello world");
    expect(docs[1]).toMatchObject({ id: "doc:d1", type: "doc", url: "/docs/d1" });
  });

  it("skips indexing when nothing is published", async () => {
    const out = await syncContentIndex();
    expect(out.indexed).toBe(0);
    expect(m.meiliRequest).not.toHaveBeenCalled();
  });

  it("creates the index on 404 and configures its settings", async () => {
    m.getPosts.mockResolvedValue([
      { slug: "a", title: "A", html: "", published: true, category: "", date: "" },
    ]);
    m.meiliRequest
      .mockRejectedValueOnce(new Error("index_not_found 404"))
      .mockResolvedValue({});
    await syncContentIndex();
    const calls = m.meiliRequest.mock.calls.map((c) => c[0]);
    expect(calls).toContain(`/indexes/${CONTENT_INDEX}`);
    expect(calls).toContain("/indexes");
    expect(calls).toContain(`/indexes/${CONTENT_INDEX}/settings`);
    expect(calls).toContain(`/indexes/${CONTENT_INDEX}/documents`);
    const settings = m.meiliRequest.mock.calls[2][1];
    expect(JSON.parse(settings.body).filterableAttributes).toEqual(["type", "category"]);
  });

  it("rethrows non-404 index-check failures", async () => {
    m.getPosts.mockResolvedValue([
      { slug: "a", title: "A", html: "", published: true },
    ]);
    m.meiliRequest.mockRejectedValueOnce(new Error("connection refused"));
    await expect(syncContentIndex()).rejects.toThrow("connection refused");
  });
});

describe("searchContent", () => {
  it("returns [] when unconfigured or query is blank", async () => {
    m.isMeilisearchConfigured.mockReturnValue(false);
    expect(await searchContent("x")).toEqual([]);
    m.isMeilisearchConfigured.mockReturnValue(true);
    expect(await searchContent("  ")).toEqual([]);
  });

  it("maps hits to the public result shape", async () => {
    m.meiliRequest.mockResolvedValue({
      hits: [
        {
          id: "blog:a",
          type: "blog",
          title: "T",
          excerpt: "e",
          url: "/blog/a",
          category: "c",
          body: "stripped-away",
        },
      ],
    });
    const out = await searchContent("hello", 3);
    expect(out).toEqual([
      { id: "blog:a", type: "blog", title: "T", excerpt: "e", url: "/blog/a", category: "c" },
    ]);
    const body = JSON.parse(m.meiliRequest.mock.calls[0][1].body);
    expect(body.q).toBe("hello");
    expect(body.limit).toBe(3);
  });

  it("swallows search errors to []", async () => {
    m.meiliRequest.mockRejectedValue(new Error("meili down"));
    expect(await searchContent("x")).toEqual([]);
  });
});
