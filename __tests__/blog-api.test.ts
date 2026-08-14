import { beforeEach, describe, expect, it, vi } from "vitest";

const getBlogPostsWithSourceMock = vi.fn();
const getBlogPostBySlugMock = vi.fn();
const isAppFlowyConfiguredMock = vi.fn();

vi.mock("@/lib/blog-source", () => ({
  getBlogPostsWithSource: (...a: unknown[]) => getBlogPostsWithSourceMock(...a),
  getBlogPostBySlug: (...a: unknown[]) => getBlogPostBySlugMock(...a),
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: (...a: unknown[]) => isAppFlowyConfiguredMock(...a),
}));

vi.mock("@/lib/blog", () => ({
  posts: [
    {
      slug: "hello-world",
      title: "Hello World",
      excerpt: "static fallback post",
    },
  ],
}));

describe("Blog API dual-run fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    isAppFlowyConfiguredMock.mockResolvedValue(false);
  });

  it("GET /api/blog/posts returns static posts when CMS is not configured", async () => {
    const { GET } = await import("@/app/api/blog/posts/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("not-configured");
    expect(response.headers.get("x-blog-source")).toBe("static");
    expect(getBlogPostsWithSourceMock).not.toHaveBeenCalled();
  });

  it("GET /api/blog/posts returns CMS source metadata when upstream succeeds", async () => {
    isAppFlowyConfiguredMock.mockResolvedValue(true);
    getBlogPostsWithSourceMock.mockResolvedValueOnce({
      posts: [{ slug: "from-appflowy" }],
      source: "appflowy",
    });

    const { GET } = await import("@/app/api/blog/posts/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe("appflowy");
    expect(data.fallbackReason).toBeUndefined();
    expect(response.headers.get("x-blog-source")).toBe("appflowy");
  });

  it("GET /api/blog/posts falls back to static with cms-error when fetch throws", async () => {
    isAppFlowyConfiguredMock.mockResolvedValue(true);
    getBlogPostsWithSourceMock.mockRejectedValueOnce(new Error("cms down"));

    const { GET } = await import("@/app/api/blog/posts/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe("static");
    expect(data.fallbackReason).toBe("cms-error");
    expect(response.headers.get("x-blog-source")).toBe("static");
  });

  it("GET /api/blog/[slug] falls back to static when blog-source fetch throws", async () => {
    isAppFlowyConfiguredMock.mockResolvedValue(true);
    getBlogPostBySlugMock.mockRejectedValueOnce(new Error("cms timeout"));

    const { GET } = await import("@/app/api/blog/[slug]/route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ slug: "hello-world" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe("static");
    expect(data.post.slug).toBe("hello-world");
  });

  it("GET /api/blog/[slug] uses static fallback when blog-source returns null", async () => {
    isAppFlowyConfiguredMock.mockResolvedValue(true);
    getBlogPostBySlugMock.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/blog/[slug]/route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ slug: "hello-world" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe("static");
    expect(data.post.slug).toBe("hello-world");
  });
});
