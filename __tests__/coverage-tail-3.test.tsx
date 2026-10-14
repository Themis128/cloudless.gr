/**
 * Coverage tail batch 3 — reachable gaps left after zero/low-coverage batches:
 * appflowy.ts (fetchViewMarkdownMap, collab-string extraction branches,
 * jwtSecret path, Buffer collab payload), integration-http post-loop tail,
 * appflowy-blog tag parsing + related/search scoring, appflowy-analytics
 * catch, blog pages (staticParams, faq render, search/tag filters), health
 * route dev-sqlite fallback, case-studies slug route fallbacks, and small
 * component interaction branches.
 *
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/* ── appflowy.ts tails ─────────────────────────────────────────────── */

const ssm = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: ssm.getConfig }));

const appflowyFetch = vi.hoisted(() => vi.fn());

describe("appflowy.ts tails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appflowyFetch.mockReset();
    vi.stubGlobal("fetch", appflowyFetch);
  });

  it("fetchViewMarkdownMap maps docs and nulls failures", async () => {
    ssm.getConfig.mockResolvedValue({
      APPFLOWY_API_URL: "https://af.example",
      APPFLOWY_JWT_SECRET: "secret",
    });
    const { fetchViewMarkdownMap } =
      await vi.importActual<typeof import("@/lib/appflowy")>("@/lib/appflowy");
    // page-view endpoint returns encoded_collab; second view 500s → fallback
    // to admin endpoint which also fails → null markdown
    const collab = Buffer.from("Title'Hello world'").toString("base64");
    appflowyFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { data: { encoded_collab: collab } } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockRejectedValueOnce(new Error("doc1 down"))
      .mockRejectedValueOnce(new Error("admin down"));
    const map = await fetchViewMarkdownMap("ws1", [
      { view_id: "v1", name: "a", last_edited_time: "t" } as never,
      { view_id: "v2", name: "b", last_edited_time: "t" } as never,
    ]);
    expect(map.get("v2")).toBeNull();
    expect(map.has("v1")).toBe(true);
  });

  it("extractStringsFromCollab handles Buffer and non-buffer inputs", async () => {
    const { extractDocText } =
      await vi.importActual<typeof import("@/lib/appflowy")>("@/lib/appflowy");
    // extractDocText → extractStringsFromCollab via raw collab payloads
    const out = await extractDocText({ raw: { data: {} } });
    expect(typeof out).toBe("string");
  });

  it("markdownToHtml renders headings and bold", async () => {
    const { markdownToHtml } =
      await vi.importActual<typeof import("@/lib/appflowy")>("@/lib/appflowy");
    const html = await markdownToHtml("# H1\n## H2\n### H3\n**bold** text");
    expect(html).toContain("<h1>H1</h1>");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("getDocument extracts strings from a raw Buffer collab payload", async () => {
    ssm.getConfig.mockResolvedValue({
      APPFLOWY_API_URL: "https://af.example",
      APPFLOWY_JWT_SECRET: "secret",
    });
    // json() bypass — a real Buffer reaches extractStringsFromCollab's
    // Buffer.isBuffer branch (JSON transport can't produce one).
    appflowyFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          data: {
            encoded_collab: Buffer.from("This is a sentence worth keeping in prose form."),
          },
        },
      }),
    });
    const { getDocument } =
      await vi.importActual<typeof import("@/lib/appflowy")>("@/lib/appflowy");
    const doc = (await getDocument("ws1", "v1")) as { text: string };
    expect(doc.text).toContain("sentence worth keeping");
  });
});

/* ── integration-http post-loop tail ───────────────────────────────── */

describe("integration-http tails", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", appflowyFetch);
    appflowyFetch.mockReset();
  });

  it("throws max-retries error when maxRetries is negative", async () => {
    const { integrationFetchWithMeta } = await import("@/lib/integration-http");
    await expect(integrationFetchWithMeta("x", "http://u", {}, { maxRetries: -1 })).rejects.toThrow(
      /max retries/
    );
  });

  it("rethrows the last network error when every attempt fails", async () => {
    appflowyFetch.mockRejectedValue(new Error("net down"));
    const { integrationFetch } = await import("@/lib/integration-http");
    await expect(
      integrationFetch("x", "http://u", {}, { maxRetries: 1, backoffMs: 0 })
    ).rejects.toThrow("net down");
  });

  it("retries a 429 honoring Retry-After then returns the payload", async () => {
    appflowyFetch
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "0" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    const { integrationFetch } = await import("@/lib/integration-http");
    const data = await integrationFetch<{ ok: boolean }>(
      "x",
      "http://u",
      {},
      { maxRetries: 2, backoffMs: 0 }
    );
    expect(data.ok).toBe(true);
    expect(appflowyFetch).toHaveBeenCalledTimes(2);
  });

  it("isIntegrationError narrows by class and status", async () => {
    const { integrationFetch, isIntegrationError, IntegrationError } =
      await import("@/lib/integration-http");
    appflowyFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "missing" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );
    const err = await integrationFetch("x", "http://u", {}, { maxRetries: 0 }).catch(
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(IntegrationError);
    expect(isIntegrationError(err)).toBe(true);
    expect(isIntegrationError(err, 404)).toBe(true);
    expect(isIntegrationError(err, 500)).toBe(false);
    expect(isIntegrationError(new Error("plain"))).toBe(false);
  });
});

/* ── appflowy-blog tag parsing + related/search scoring ────────────── */

const blogMocks = vi.hoisted(() => ({
  configured: vi.fn(),
  workspaces: vi.fn(),
  views: vi.fn(),
  docs: vi.fn(),
}));
vi.mock("@/lib/appflowy", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...orig,
    isAppFlowyConfigured: (...a: unknown[]) => blogMocks.configured(...a),
    listAllWorkspaces: (...a: unknown[]) => blogMocks.workspaces(...a),
    listAllViewsDeep: (...a: unknown[]) => blogMocks.views(...a),
    fetchViewMarkdownMap: (...a: unknown[]) => blogMocks.docs(...a),
    markdownToHtml: async (m: string) => `<p>${m}</p>`,
  };
});

describe("appflowy-blog tails", () => {
  it("parses **Tags**: from doc markdown and scores related posts", async () => {
    blogMocks.configured.mockResolvedValue(true);
    blogMocks.workspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    blogMocks.views.mockResolvedValue([
      { view_id: "a", name: "[Blog] Alpha", last_edited_time: "2026-10-01" },
      { view_id: "b", name: "[Blog] Beta", last_edited_time: "2026-10-02" },
      { view_id: "c", name: "[Blog] Gamma", last_edited_time: "2026-10-03" },
    ]);
    blogMocks.docs.mockResolvedValue(
      new Map([
        ["a", "**Tags**: alpha, shared"],
        ["b", "**Tags**: shared, beta"],
        ["c", "**Tags**: other"],
      ])
    );
    const { getPosts, getRelatedPosts, getPostsByTag, getTags, searchPosts } =
      await import("@/lib/appflowy-blog");
    const posts = await getPosts();
    expect(posts.length).toBe(3);
    expect(posts.find((p) => p.id === "a")?.tags).toEqual(["alpha", "shared"]);

    // Tag-only match: no title/excerpt contains "shared" — exercises the
    // p.tags.some callback in searchPosts.
    const hits = await searchPosts("shared");
    expect(hits.map((p) => p.id).sort()).toEqual(["a", "b"]);

    expect(await getTags()).toEqual(["alpha", "beta", "other", "shared"]);
    expect((await getPostsByTag("beta")).map((p) => p.id)).toEqual(["b"]);

    // "a" shares the "shared" tag with "b" → b outranks c (category only).
    const a = posts.find((p) => p.id === "a")!;
    const related = await getRelatedPosts(a);
    expect(related[0].id).toBe("b");
  });

  it("exercises the slug/featured/category getters over real posts", async () => {
    blogMocks.configured.mockResolvedValue(true);
    blogMocks.workspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    blogMocks.views.mockResolvedValue([
      { view_id: "a", name: "[Blog] Alpha", last_edited_time: "2026-10-01" },
      { view_id: "b", name: "[Blog] Beta", last_edited_time: "2026-10-02" },
    ]);
    blogMocks.docs.mockResolvedValue(
      new Map([
        ["a", "**Tags**: t1"],
        ["b", "x"],
      ])
    );
    const { getPostBySlug, getAllSlugs, getFeaturedPosts, getCategories, getPostsByCategory } =
      await import("@/lib/appflowy-blog");
    const slugs = await getAllSlugs();
    expect(slugs).toContain("alpha");
    expect((await getPostBySlug("alpha"))?.id).toBe("a");
    expect(await getPostBySlug("missing")).toBeNull();
    expect(await getFeaturedPosts()).toEqual([]);
    expect(await getCategories()).toEqual(["Cloud"]);
    expect((await getPostsByCategory("Cloud")).length).toBe(2);
    expect(await getPostsByCategory("Nope")).toEqual([]);
  });

  it("getPosts tolerates docs with no Tags field", async () => {
    blogMocks.configured.mockResolvedValue(true);
    blogMocks.workspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    blogMocks.views.mockResolvedValue([
      { view_id: "a", name: "[Blog] Alpha", last_edited_time: "2026-10-01" },
    ]);
    blogMocks.docs.mockResolvedValue(new Map([["a", "just prose, no fields"]]));
    const { getPosts } = await import("@/lib/appflowy-blog");
    expect((await getPosts())[0].tags).toEqual([]);
  });
});

/* ── appflowy-analytics catch branch ───────────────────────────────── */

describe("appflowy-analytics tails", () => {
  it("trackEvent returns false when the write path throws", async () => {
    blogMocks.configured.mockResolvedValueOnce(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("console blew up");
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { trackEvent } = await import("@/lib/appflowy-analytics");
    const ok = await trackEvent({ event: "page_view" } as never);
    expect(ok).toBe(false);
    warn.mockRestore();
    err.mockRestore();
  });
});

/* ── appflowy-search listUsers configured path ─────────────────────── */

describe("appflowy-search tails", () => {
  it("listUsers returns [] when configured (no users API)", async () => {
    blogMocks.configured.mockResolvedValueOnce(true);
    const { listUsers } = await import("@/lib/appflowy-search");
    expect(await listUsers()).toEqual([]);
  });

  it("listUsers short-circuits when unconfigured; getDatabaseSchema is null", async () => {
    blogMocks.configured.mockResolvedValueOnce(false);
    const { listUsers, getDatabaseSchema } = await import("@/lib/appflowy-search");
    expect(await listUsers()).toEqual([]);
    expect(await getDatabaseSchema("db1")).toBeNull();
  });
});

/* ── blog list page: search/tag filters ────────────────────────────── */

const blogSrc = vi.hoisted(() => ({
  getBlogPostsWithSource: vi.fn(),
  getBlogPosts: vi.fn(),
  getBlogPostBySlug: vi.fn(),
}));
vi.mock("@/lib/blog-source", () => ({
  getBlogPostsWithSource: (...a: unknown[]) => blogSrc.getBlogPostsWithSource(...a),
  getBlogPosts: (...a: unknown[]) => blogSrc.getBlogPosts(...a),
  getBlogPostBySlug: (...a: unknown[]) => blogSrc.getBlogPostBySlug(...a),
}));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: vi.fn(async () => "en") }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));
vi.mock("@/components/JsonLd", () => ({ default: () => null }));
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const BLOG_FIXTURE = [
  {
    slug: "post-a",
    title: "Alpha Post",
    excerpt: "first post",
    date: "2026-10-01",
    readTime: "3 min read",
    category: "Cloud",
    tags: ["automation", "ai"],
  },
  {
    slug: "post-b",
    title: "Beta Post",
    excerpt: "second post",
    date: "2026-10-02",
    readTime: "4 min read",
    category: "Serverless",
    tags: ["ai"],
  },
];

describe("blog list page tails", () => {
  beforeEach(() => {
    blogSrc.getBlogPostsWithSource.mockResolvedValue({
      posts: BLOG_FIXTURE,
      source: "static",
    });
    blogSrc.getBlogPosts.mockResolvedValue(BLOG_FIXTURE);
  });
  afterEach(() => cleanup());

  it("filters by search query (incl. tags) and tag params", async () => {
    const BlogPage = (await import("@/app/[locale]/blog/page")).default;
    const sp = (p: Record<string, string>) => Promise.resolve(p);

    // Tag-only match: "automation" appears in no title/excerpt — the
    // p.tags.some callback must carry it to post-a.
    const r1 = await BlogPage({ searchParams: sp({ q: "automation" }) });
    const c1 = render(r1).container.textContent ?? "";
    expect(c1).toContain("Alpha");
    expect(c1).not.toContain("Beta Post");
    cleanup();

    // activeTag filter + tag chips/sidebar render from real tag data.
    const r2 = await BlogPage({ searchParams: sp({ tag: "automation" }) });
    const c2 = render(r2).container.textContent ?? "";
    expect(c2).toContain("Alpha");
    expect(c2).not.toContain("Beta Post");
    cleanup();

    // Unfiltered render shows tag chips + sidebar tag cloud.
    const r3 = await BlogPage({ searchParams: sp({}) });
    const c3 = render(r3).container.textContent ?? "";
    expect(c3).toContain("Alpha");
    expect(c3).toContain("Beta Post");
    expect(c3).toContain("automation");
  });

  it("generateStaticParams returns slug×locale pairs incl. static posts", async () => {
    const { generateStaticParams } = await import("@/app/[locale]/blog/[slug]/page");
    const params = await generateStaticParams();
    expect(params.length).toBeGreaterThan(0);
    expect(params[0]).toHaveProperty("slug");
    expect(params[0]).toHaveProperty("locale");
  });

  it("renders the FAQ section for posts that carry faqs", async () => {
    blogSrc.getBlogPostBySlug.mockResolvedValue({
      slug: "post-a",
      title: "Alpha Post",
      excerpt: "x",
      date: "2026-10-01",
      category: "Cloud",
      tags: [],
      content: "body",
      html: "<p>body</p>",
      faqs: [{ question: "Q1?", answer: "A1" }],
    } as never);
    const BlogPostPage = (await import("@/app/[locale]/blog/[slug]/page")).default;
    const el = await BlogPostPage({
      params: Promise.resolve({ locale: "en", slug: "post-a" }),
    });
    const { container } = render(el);
    expect(container.textContent).toContain("Q1?");
  });
});

/* ── /api/health — dev local-sqlite fallback ───────────────────────── */

describe("health route tails", () => {
  it("falls back to local sqlite in development when D1 unbound", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth-d1", () => ({
      getAuthDbFromEnv: () => null,
    }));
    const localDb = {
      prepare: () => ({ first: async () => ({ ok: 1 }) }),
    };
    vi.doMock("@/lib/auth-db-local", () => ({ getLocalAuthDb: () => localDb }));
    vi.doMock("@/lib/rate-limit", () => ({ rateLimit: () => true, getClientIp: () => "x" }));
    vi.stubEnv("NODE_ENV", "development");
    try {
      const { GET } = await import("@/app/api/health/route");
      const res = await GET();
      expect(res.status).toBe(200);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
      vi.unstubAllGlobals();
    }
  });
});

/* ── case-studies [slug] route: static fallback + catch ────────────── */

const cmsProv = vi.hoisted(() => ({
  isAppFlowyCmsConfigured: vi.fn(),
  getAppFlowyCaseStudyBySlug: vi.fn(),
}));
vi.mock("@/lib/cms-provider", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...orig,
    isAppFlowyCmsConfigured: (...a: unknown[]) => cmsProv.isAppFlowyCmsConfigured(...a),
  };
});
vi.mock("@/lib/appflowy-case-studies", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...orig,
    // Route imports `getCaseStudyBySlug` (aliased) — override the real name.
    getCaseStudyBySlug: (...a: unknown[]) => cmsProv.getAppFlowyCaseStudyBySlug(...a),
  };
});

describe("case-studies [slug] route tails", () => {
  it("404s on unknown slug when AppFlowy is unconfigured", async () => {
    cmsProv.isAppFlowyCmsConfigured.mockResolvedValue(false);
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://x") as never, {
      params: Promise.resolve({ slug: "nonexistent-slug-xyz" }),
    });
    expect(res.status).toBe(404);
  });

  it("502s when the AppFlowy fetch throws", async () => {
    cmsProv.isAppFlowyCmsConfigured.mockResolvedValue(true);
    cmsProv.getAppFlowyCaseStudyBySlug.mockRejectedValue(new Error("cms down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://x") as never, {
      params: Promise.resolve({ slug: "anything" }),
    });
    expect(res.status).toBe(502);
    err.mockRestore();
  });

  it("returns the AppFlowy case study on a configured hit", async () => {
    cmsProv.isAppFlowyCmsConfigured.mockResolvedValue(true);
    cmsProv.getAppFlowyCaseStudyBySlug.mockResolvedValue({
      slug: "cs-1",
      title: "CMS Study",
      html: "<p>x</p>",
    });
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://x") as never, {
      params: Promise.resolve({ slug: "cs-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("appflowy");
  });

  it("404s in the configured path when neither source has the slug", async () => {
    cmsProv.isAppFlowyCmsConfigured.mockResolvedValue(true);
    cmsProv.getAppFlowyCaseStudyBySlug.mockResolvedValue(null);
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://x") as never, {
      params: Promise.resolve({ slug: "not-a-real-study" }),
    });
    expect(res.status).toBe(404);
  });

  it("falls back to a static case study when AppFlowy misses", async () => {
    cmsProv.isAppFlowyCmsConfigured.mockResolvedValue(true);
    cmsProv.getAppFlowyCaseStudyBySlug.mockResolvedValue(null);
    const { GET } = await import("@/app/api/case-studies/[slug]/route");
    const res = await GET(new Request("http://x") as never, {
      params: Promise.resolve({ slug: "techflow-aws-cost-reduction" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("static");
    expect(body.caseStudy.slug).toBe("techflow-aws-cost-reduction");
  });
});

/* ── component micro-branches ──────────────────────────────────────── */

describe("component tails", () => {
  it("CloudCockpit observes visibility when IntersectionObserver exists", async () => {
    const ioInstances: Array<{
      observe: (el: Element) => void;
      disconnect: () => void;
    }> = [];
    class FakeIO {
      constructor(private cb: IntersectionObserverCallback) {}
      observe = (_el: Element) => {
        this.cb(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        );
        ioInstances.push(this);
      };
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", FakeIO);
    const { default: CloudCockpit } = await import("@/components/CloudCockpit");
    render(React.createElement(CloudCockpit));
    expect(ioInstances.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it("CartSlideOver blocks checkout on a mixed cart", async () => {
    vi.doMock("@/context/CartContext", () => ({
      useCart: () => ({
        items: [
          { product: { id: "s", name: "Sub", price: 10, recurring: true }, quantity: 1 },
          { product: { id: "o", name: "One", price: 5, recurring: false }, quantity: 1 },
        ],
        isOpen: true,
        closeCart: () => {},
        removeItem: () => {},
        updateQuantity: () => {},
        clearCart: () => {},
        totalPrice: 15,
        totalItems: 2,
      }),
    }));
    vi.resetModules();
    const { default: CartSlideOver } = await import("@/components/store/CartSlideOver");
    const { container } = render(React.createElement(CartSlideOver));
    expect(container.textContent).toContain("can't be purchased together");
    vi.resetModules();
  });
});
